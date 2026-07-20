import { NextResponse } from 'next/server'
import { verifyQStashRequest } from '@/lib/qstash'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { scrapeGitHub, scrapeDevTo, scrapeHackerNews, scrapeNpm, scoreLeads } from '@/lib/gtm/scraper'
import { getPlanStatus, incrementLeadsScraped, deductAddonCredits } from '@/lib/plan'
import type { Campaign } from '@/lib/types/gtm'
import type { PlanStatus } from '@/lib/plan'
import { phCapture } from '@/lib/posthog'

// Cache plan status per user within a single cron run to avoid N×DB calls
const planCache = new Map<string, PlanStatus>()

export const maxDuration = 300  // 5 min — scraping takes time

// Per-source scrape caps per run. npm is fast and email-rich, so it gets the
// highest cap; github/devto do slow per-profile commit-email enrichment, so keep
// them moderate to stay within maxDuration. Runs are meant to accumulate daily
// (upsert ignores duplicates), so these bound a single run, not the total.
const SOURCE_LIMITS = {
  github: 30,     // slow per-profile commit-email enrichment — keep modest for maxDuration
  devto: 30,      // also does commit-email enrichment — keep modest
  hackernews: 50,
  npm: 100,       // fast + email-rich, safe to push high
  linkedin: 40,
} as const

// Supabase/PostgREST errors are plain objects, not Error instances, so String(err)
// collapses them to "[object Object]". Pull out the fields that actually explain
// the failure (e.g. a check-constraint violation) for logging.
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    const parts = [e.message, e.code && `code=${e.code}`, e.details, e.hint].filter(Boolean)
    if (parts.length) return parts.join(' | ')
    try { return JSON.stringify(err) } catch { /* fall through */ }
  }
  return String(err)
}

export async function POST(req: Request) {
  // Verify caller is QStash or internal (CRON_SECRET)
  const sig = req.headers.get('upstash-signature')
  const rawBody = await req.text()

  if (sig) {
    const valid = await verifyQStashRequest(sig, rawBody)
    if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  } else {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { campaignId } = JSON.parse(rawBody) as { campaignId?: string }

  // Load campaign(s)
  let query = supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('status', 'active')

  if (campaignId) query = query.eq('id', campaignId)

  const { data: campaigns, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!campaigns?.length) return NextResponse.json({ ok: true, message: 'No active campaigns' })

  planCache.clear()
  const results: Record<string, { scraped: number; inserted: number; skipped?: boolean; error?: string }> = {}

  for (const campaign of campaigns as Campaign[]) {
    try {
      // ── Credit gate ────────────────────────────────────────────────────────
      if (!planCache.has(campaign.user_id)) {
        planCache.set(campaign.user_id, await getPlanStatus(campaign.user_id))
      }
      const ps = planCache.get(campaign.user_id)!
      if (!ps.hasGtm) {
        results[campaign.id] = { scraped: 0, inserted: 0, skipped: true, error: 'No GTM access on current plan' }
        continue
      }
      if (ps.creditsBalance < 1) {
        results[campaign.id] = { scraped: 0, inserted: 0, skipped: true, error: 'No credits remaining' }
        continue
      }

      const allLeads: Awaited<ReturnType<typeof scrapeGitHub>> = []

      if (campaign.sources.includes('github')) {
        const leads = await scrapeGitHub(campaign.icp_config, SOURCE_LIMITS.github)
        allLeads.push(...leads)
      }

      if (campaign.sources.includes('devto')) {
        const leads = await scrapeDevTo(campaign.icp_config, SOURCE_LIMITS.devto)
        allLeads.push(...leads)
      }

      if (campaign.sources.includes('hackernews')) {
        const leads = await scrapeHackerNews(campaign.icp_config, SOURCE_LIMITS.hackernews)
        allLeads.push(...leads)
      }

      if (campaign.sources.includes('npm')) {
        const leads = await scrapeNpm(campaign.icp_config, SOURCE_LIMITS.npm)
        allLeads.push(...leads)
      }

      // LinkedIn source — delegate to the worker which has the browser session
      if (campaign.sources.includes('linkedin')) {
        const workerUrl = process.env.LINKEDIN_WORKER_URL ?? 'http://localhost:8080'
        try {
          await fetch(`${workerUrl}/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.WORKER_SECRET}`,
            },
            body: JSON.stringify({
              userId:     campaign.user_id,
              campaignId: campaign.id,
              icpConfig:  campaign.icp_config,
              limit:      SOURCE_LIMITS.linkedin,
            }),
          })
          console.log(`[gtm/cron/scrape] LinkedIn search triggered for campaign ${campaign.id}`)
        } catch (e) {
          console.warn(`[gtm/cron/scrape] LinkedIn worker not reachable:`, e)
        }
      }

      // LinkedIn outreach runs through a separate worker/pipeline, so this route
      // only cares about email as a contact channel. Drop leads with no email
      // before scoring (saves a Gemini call) and before insert (saves a credit
      // on a lead that could never be emailed).
      const contactableLeads = allLeads.filter(l => l.email)
      const uncontactable = allLeads.length - contactableLeads.length
      if (uncontactable > 0) {
        console.log(`[gtm/cron/scrape] campaign ${campaign.id}: dropped ${uncontactable} lead(s) with no email`)
      }

      if (contactableLeads.length === 0) {
        results[campaign.id] = { scraped: allLeads.length, inserted: 0 }
        continue
      }

      // Score against ICP — batch to avoid huge Gemini prompts
      const BATCH = 20
      const scored = []
      for (let i = 0; i < contactableLeads.length; i += BATCH) {
        const batch = contactableLeads.slice(i, i + BATCH)
        const scoredBatch = await scoreLeads(batch, campaign.icp_config)
        scored.push(...scoredBatch)
      }

      // Drop leads scoring below 0.3
      const qualified = scored.filter(l => (l.icp_match_score ?? 0) >= 0.3)

      if (qualified.length === 0) {
        results[campaign.id] = { scraped: allLeads.length, inserted: 0 }
        continue
      }

      const rows = qualified.map(l => ({
        ...l,
        campaign_id: campaign.id,
        user_id: campaign.user_id,
        status: 'pending' as const,
      }))

      // Cap insertion at remaining credit balance
      const ps2 = planCache.get(campaign.user_id)!
      const maxInsert = ps2.creditsLimit === -1
        ? rows.length
        : Math.min(rows.length, Math.floor(ps2.creditsBalance))
      const cappedRows = rows.slice(0, maxInsert)

      let inserted = 0
      const { error: upsertError, count } = await supabaseAdmin
        .from('leads')
        .upsert(cappedRows, {
          onConflict: 'campaign_id,source,source_id',
          ignoreDuplicates: true,
          count: 'exact',
        })

      if (upsertError) {
        // The batch is atomic, so a single invalid row (e.g. a source not yet
        // allowed by the leads_source_check constraint) rejects every lead. Fall
        // back to per-row upserts so one bad row can't zero out the whole scrape,
        // and log the aggregated reasons so the failure is diagnosable.
        console.error(
          `[gtm/cron/scrape] batch upsert failed for campaign ${campaign.id}: ${describeError(upsertError)} — retrying per-row`
        )
        const rowFailures: Record<string, number> = {}
        for (const row of cappedRows) {
          const { error: rowErr, count: rowCount } = await supabaseAdmin
            .from('leads')
            .upsert([row], {
              onConflict: 'campaign_id,source,source_id',
              ignoreDuplicates: true,
              count: 'exact',
            })
          if (rowErr) {
            const key = describeError(rowErr)
            rowFailures[key] = (rowFailures[key] ?? 0) + 1
          } else {
            inserted += rowCount ?? 0
          }
        }
        if (Object.keys(rowFailures).length) {
          console.error(`[gtm/cron/scrape] campaign ${campaign.id} per-row failures:`, JSON.stringify(rowFailures))
        }
      } else {
        inserted = count ?? 0
      }

      // Deduct credits (fire-and-forget)
      if (inserted > 0 && ps2.creditsLimit !== -1) {
        if (ps2.plan === 'starter') {
          // Starter has no monthly credits — draw from addon balance only
          deductAddonCredits(campaign.user_id, inserted).catch(() => {})
        } else {
          // Free / Growth — track via monthly counter
          incrementLeadsScraped(campaign.user_id, inserted).catch(() => {})
        }
        // Bust cache so next campaign in this run sees updated balance
        planCache.delete(campaign.user_id)
      }

      results[campaign.id] = { scraped: allLeads.length, inserted }

      phCapture(campaign.user_id, 'gtm_leads_scraped', {
        campaignId: campaign.id,
        sources: campaign.sources,
        totalScraped: allLeads.length,
        qualified: qualified.length,
        inserted,
        plan: ps.plan,
        creditsRemaining: ps.creditsBalance - inserted,
      }).catch(() => {})
    } catch (err) {
      const msg = describeError(err)
      console.error(`[gtm/cron/scrape] campaign ${campaign.id}:`, msg)
      results[campaign.id] = { scraped: 0, inserted: 0, error: msg }
    }
  }

  return NextResponse.json({ ok: true, results })
}

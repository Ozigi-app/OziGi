import { NextResponse } from 'next/server'
import { verifyQStashRequest } from '@/lib/qstash'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { scrapeGitHub, scrapeDevTo, scoreLeads } from '@/lib/gtm/scraper'
import type { Campaign } from '@/lib/types/gtm'

export const maxDuration = 300  // 5 min — scraping takes time

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

  const results: Record<string, { scraped: number; inserted: number; error?: string }> = {}

  for (const campaign of campaigns as Campaign[]) {
    try {
      const allLeads: Awaited<ReturnType<typeof scrapeGitHub>> = []

      if (campaign.sources.includes('github')) {
        const leads = await scrapeGitHub(campaign.icp_config, 30)
        allLeads.push(...leads)
      }

      if (campaign.sources.includes('devto')) {
        const leads = await scrapeDevTo(campaign.icp_config, 30)
        allLeads.push(...leads)
      }

      if (allLeads.length === 0) {
        results[campaign.id] = { scraped: 0, inserted: 0 }
        continue
      }

      // Score against ICP — batch to avoid huge Gemini prompts
      const BATCH = 20
      const scored = []
      for (let i = 0; i < allLeads.length; i += BATCH) {
        const batch = allLeads.slice(i, i + BATCH)
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

      const { error: upsertError, count } = await supabaseAdmin
        .from('leads')
        .upsert(rows, {
          onConflict: 'campaign_id,source,source_id',
          ignoreDuplicates: true,
          count: 'exact',
        })

      if (upsertError) throw upsertError

      results[campaign.id] = { scraped: allLeads.length, inserted: count ?? 0 }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[gtm/cron/scrape] campaign ${campaign.id}:`, msg)
      results[campaign.id] = { scraped: 0, inserted: 0, error: msg }
    }
  }

  return NextResponse.json({ ok: true, results })
}

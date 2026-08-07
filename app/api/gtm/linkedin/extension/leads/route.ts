import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { userIdFromExtensionToken, extensionCors } from '@/lib/gtm/extensionAuth'

// Receives profiles the extension found in the user's own LinkedIn search and
// saves them as leads. These are the only leads carrying a linkedin_url — every
// server-side scraper sets it null — so this is what feeds the connect flow.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCors })
}

interface FoundProfile {
  url?: string
  name?: string
  title?: string
  location?: string
}

// linkedin.com/in/<slug>/ -> slug. Doubles as source_id, which is the dedupe key
// in unique (campaign_id, source, source_id).
function slugOf(url: string): string | null {
  return url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? null
}

export async function POST(req: Request) {
  const userId = await userIdFromExtensionToken(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: extensionCors })

  const body = await req.json().catch(() => null) as
    { campaignId?: string; profiles?: FoundProfile[] } | null
  const { campaignId, profiles } = body ?? {}
  if (!campaignId || !Array.isArray(profiles)) {
    return NextResponse.json({ error: 'campaignId and profiles required' }, { status: 400, headers: extensionCors })
  }

  // The campaign must belong to this user — the token identifies the user, not
  // the campaign, so never trust a campaignId straight off the wire.
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: extensionCors })

  const seen = new Set<string>()
  const rows = profiles.flatMap((p) => {
    const url = (p.url ?? '').split('?')[0].split('#')[0]
    const slug = url ? slugOf(url) : null
    if (!slug || seen.has(slug)) return []
    seen.add(slug)
    return [{
      campaign_id: campaignId,
      user_id: userId,
      source: 'linkedin',
      source_id: slug,
      name: (p.name ?? '').trim() || null,
      linkedin_url: `https://www.linkedin.com/in/${slug}/`,
      linkedin_profile_id: slug,
      bio: (p.title ?? '').trim().slice(0, 500) || null,
      location: (p.location ?? '').trim().slice(0, 120) || null,
      status: 'pending',
    }]
  })

  if (!rows.length) return NextResponse.json({ inserted: 0, skipped: profiles.length }, { headers: extensionCors })

  // Batch first, then fall back to per-row. A single bad row failing the whole
  // batch has silently wiped an entire scrape run before — per-row keeps the
  // good ones and surfaces the real reason for the rest.
  let inserted = 0
  const errors: string[] = []
  const { error: batchErr, count } = await supabaseAdmin
    .from('leads')
    .upsert(rows, { onConflict: 'campaign_id,source,source_id', ignoreDuplicates: true, count: 'exact' })

  if (!batchErr) {
    inserted = count ?? 0
  } else {
    for (const row of rows) {
      const { error } = await supabaseAdmin
        .from('leads')
        .upsert(row, { onConflict: 'campaign_id,source,source_id', ignoreDuplicates: true })
      if (error) errors.push(`${row.source_id}: ${error.message}`)
      else inserted++
    }
    console.warn('[extension/leads] batch upsert failed, fell back per-row:', batchErr.message, errors.slice(0, 5))
  }

  // Queue the connection requests here, rather than waiting for the send cron.
  //
  // Sourcing and sending were otherwise joined by a scheduled job running on its
  // own clock: the extension could find 25 people and then sit idle for hours
  // with nothing explaining the wait. Since LinkedIn now lives entirely in the
  // extension, its queue should be filled by the same round trip that found the
  // leads — no cron, no manual trigger.
  const queued = inserted > 0 ? await enqueueConnects(userId, campaignId) : 0

  return NextResponse.json({
    inserted,
    queued,
    received: profiles.length,
    errors: errors.slice(0, 5),
  }, { headers: extensionCors })
}

// Creates connect rows for leads in this campaign that don't have one yet.
// Notes are NOT written here: composing 25 of them would mean 25 AI calls inside
// one request. /pending writes each note as it hands the action out instead.
async function enqueueConnects(userId: string, campaignId: string): Promise<number> {
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, sequence_steps, daily_linkedin_limit')
    .eq('id', campaignId)
    .maybeSingle()
  if (!campaign) return 0

  const steps = Array.isArray(campaign.sequence_steps) ? campaign.sequence_steps : []
  const liStep = steps
    .filter((s: { channel?: string }) => s?.channel === 'linkedin')
    .sort((a: { step: number }, b: { step: number }) => a.step - b.step)[0]
  if (!liStep) return 0 // campaign has no LinkedIn step — nothing to queue

  const dailyLimit = campaign.daily_linkedin_limit ?? 20
  const since = new Date(); since.setUTCHours(0, 0, 0, 0)
  const { count: queuedToday } = await supabaseAdmin
    .from('linkedin_queue')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('created_at', since.toISOString())
  const room = dailyLimit - (queuedToday ?? 0)
  if (room <= 0) return 0

  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq('campaign_id', campaignId)
    .in('status', ['pending', 'contacted'])
    .not('linkedin_url', 'is', null)
    .order('icp_match_score', { ascending: false, nullsFirst: false })
    .limit(200)
  if (!leads?.length) return 0

  // Anyone already queued or already actioned is excluded — a second invite to
  // the same person is the one mistake outreach can't take back.
  const { data: existing } = await supabaseAdmin
    .from('linkedin_queue')
    .select('lead_id')
    .eq('campaign_id', campaignId)
    .eq('action', 'connect')
    .in('lead_id', leads.map(l => l.id))
  const seen = new Set((existing ?? []).map(r => r.lead_id))

  const rows = leads
    .filter(l => !seen.has(l.id))
    .slice(0, room)
    .map(l => ({
      lead_id: l.id,
      campaign_id: campaignId,
      user_id: userId,
      action: 'connect',
      message: null,          // written by /pending, one at a time
      sequence_step: liStep.step ?? 1,
      scheduled_at: new Date().toISOString(),
    }))
  if (!rows.length) return 0

  const { error } = await supabaseAdmin.from('linkedin_queue').insert(rows)
  if (error) {
    console.warn('[extension/leads] could not queue connects:', error.message)
    return 0
  }
  return rows.length
}

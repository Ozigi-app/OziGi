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

  return NextResponse.json({
    inserted,
    received: profiles.length,
    errors: errors.slice(0, 5),
  }, { headers: extensionCors })
}

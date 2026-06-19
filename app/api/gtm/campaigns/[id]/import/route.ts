import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { scoreLeads } from '@/lib/gtm/scraper'

interface ImportRow {
  name: string
  email?: string
  company?: string
  linkedin_url?: string
  twitter_handle?: string
  bio?: string
  location?: string
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify campaign belongs to user
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id, icp_config')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (campErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { rows } = await req.json() as { rows: ImportRow[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  // Cap at 500 rows per import to avoid runaway Gemini costs
  const capped = rows.slice(0, 500)

  const rawLeads = capped.map(r => ({
    source: 'manual' as const,
    // Use email as the dedup key when available, else slugify name
    source_id: r.email?.toLowerCase().trim() || `manual_${r.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`,
    name: r.name.trim(),
    email: r.email?.trim() || null,
    github_username: null,
    linkedin_url: r.linkedin_url?.trim() || null,
    linkedin_profile_id: null,
    twitter_handle: r.twitter_handle?.replace(/^@/, '').trim() || null,
    bio: r.bio?.trim() || null,
    company: r.company?.trim() || null,
    location: r.location?.trim() || null,
    tags: [] as string[],
    icp_match_score: null as number | null,
  }))

  // Score against ICP in batches of 20 (same as cron scraper)
  const BATCH = 20
  const scored = []
  for (let i = 0; i < rawLeads.length; i += BATCH) {
    const batch = rawLeads.slice(i, i + BATCH)
    const scoredBatch = await scoreLeads(batch, campaign.icp_config)
    scored.push(...scoredBatch)
  }

  const rows_to_insert = scored.map(l => ({
    ...l,
    campaign_id: id,
    user_id: user.id,
    status: 'pending' as const,
  }))

  const { error: upsertErr, count } = await supabaseAdmin
    .from('leads')
    .upsert(rows_to_insert, {
      onConflict: 'campaign_id,source,source_id',
      ignoreDuplicates: true,
      count: 'exact',
    })

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  return NextResponse.json({ inserted: count ?? 0, total: rows_to_insert.length })
}

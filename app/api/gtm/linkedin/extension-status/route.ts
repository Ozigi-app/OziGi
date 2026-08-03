import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Dashboard-facing view of the browser extension: is it actually running, when
// did it last find leads, and is anything stuck. Searching and sending moved
// into the extension, which made both invisible from the app — an expired
// LinkedIn session looked identical to "nothing due today".
//
// Session-authenticated (not the extension bearer token): this is the user
// looking at their own dashboard.

// The extension polls every 30s, so anything fresher than a few minutes means
// it is genuinely alive right now.
const LIVE_WINDOW_MS = 5 * 60 * 1000

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [tokenRes, lastLeadRes, leadsTodayRes, queuedRes] = await Promise.all([
    supabaseAdmin
      .from('linkedin_extension_tokens')
      .select('last_used_at, created_at, search_requested_at')
      .eq('user_id', user.id)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('leads')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('source', 'linkedin')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('source', 'linkedin')
      .gte('created_at', dayAgo),
    supabaseAdmin
      .from('linkedin_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'queued')
      .eq('action', 'connect'),
  ])

  const token = tokenRes.data
  const lastUsedAt = token?.last_used_at ?? null

  return NextResponse.json({
    hasToken: !!token,
    connected: !!lastUsedAt && Date.now() - new Date(lastUsedAt).getTime() < LIVE_WINDOW_MS,
    lastUsedAt,
    lastSearchAt: lastLeadRes.data?.created_at ?? null,
    leadsFoundToday: leadsTodayRes.count ?? 0,
    queuedConnects: queuedRes.count ?? 0,
    searchRequestedAt: token?.search_requested_at ?? null,
  })
}

// "Search now" — flags a request the extension picks up on its next poll,
// bypassing the once-per-campaign-per-day rule.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('linkedin_extension_tokens')
    .update({ search_requested_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('revoked', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

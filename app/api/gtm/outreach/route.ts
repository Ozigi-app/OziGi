import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sends, error } = await supabaseAdmin
    .from('sequence_sends')
    .select('id, lead_id, campaign_id, subject, status, sent_at, opened_at, channel')
    .eq('user_id', user.id)
    .eq('channel', 'email')
    .order('sent_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch campaign names for all unique campaign_ids
  const campaignIds = [...new Set((sends ?? []).map(s => s.campaign_id).filter(Boolean))]
  let campaignNames: Record<string, string> = {}
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, name')
      .in('id', campaignIds)
    for (const c of campaigns ?? []) campaignNames[c.id] = c.name
  }

  const emails = (sends ?? []).map(s => ({
    id:            s.id,
    lead_id:       s.lead_id ?? '—',
    subject:       s.subject ?? '(no subject)',
    status:        s.status,
    sent_at:       s.sent_at,
    opened_at:     s.opened_at,
    campaign_id:   s.campaign_id ?? '',
    campaign_name: s.campaign_id ? (campaignNames[s.campaign_id] ?? '—') : 'Manual',
  }))

  return NextResponse.json({ emails })
}

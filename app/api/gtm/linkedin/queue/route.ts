import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Activity for the LinkedIn page: connection requests the extension has sent or
// is about to send, newest first.
//
// Connect only. Message/follow_up rows exist historically but Ozigi does not
// send LinkedIn messages, so listing them described a channel that no longer
// exists — and made a queue of things that would never happen look like a
// backlog of things that would.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('linkedin_queue')
    .select('id, lead_id, campaign_id, action, status, attempts, error, scheduled_at, processed_at')
    .eq('user_id', user.id)
    .eq('action', 'connect')
    .neq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = data ?? []
  if (!items.length) return NextResponse.json({ items })

  // Attach who each row is actually for. A queue of opaque ids isn't a history;
  // the name is the point.
  const leadIds = [...new Set(items.map(i => i.lead_id))]
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('id, name, linkedin_url, bio')
    .in('id', leadIds)
  const byId = new Map((leads ?? []).map(l => [l.id, l]))

  return NextResponse.json({
    items: items.map(i => {
      const lead = byId.get(i.lead_id)
      return {
        ...i,
        leadName: lead?.name ?? null,
        leadUrl: lead?.linkedin_url ?? null,
        leadHeadline: lead?.bio ?? null,
      }
    }),
  })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch IDs of all failed items for this user
  const { data: failed, error: fetchErr } = await supabaseAdmin
    .from('linkedin_queue')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'failed')

  if (fetchErr) {
    console.error('[retry-failed] fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!failed?.length) return NextResponse.json({ ok: true, reset: 0 })

  const ids = failed.map(r => r.id)

  // Reset all failed items in a single update — schedule them 2 minutes from
  // now so the worker picks them up on the next poll without flooding LinkedIn.
  const scheduledAt = new Date(Date.now() + 2 * 60_000).toISOString()

  const { error: updateErr } = await supabaseAdmin
    .from('linkedin_queue')
    .update({
      status:       'queued',
      attempts:     0,
      error:        null,
      scheduled_at: scheduledAt,
      updated_at:   new Date().toISOString(),
    })
    .in('id', ids)
    .eq('user_id', user.id)

  if (updateErr) {
    console.error('[retry-failed] update error:', updateErr.message)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, reset: ids.length })
}

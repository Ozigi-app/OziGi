import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { spreadScheduledAt } from '@/lib/gtm/schedule'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch failed items for this user
  const { data: failed } = await supabaseAdmin
    .from('linkedin_queue')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'failed')

  if (!failed?.length) return NextResponse.json({ ok: true, reset: 0 })

  // Spread retries across business hours starting from next available slot
  const updates = failed.map((item, i) => ({
    id: item.id,
    status: 'queued',
    attempts: 0,
    error: null,
    scheduled_at: spreadScheduledAt(i, 20),
    updated_at: new Date().toISOString(),
  }))

  for (const update of updates) {
    await supabaseAdmin
      .from('linkedin_queue')
      .update({ status: update.status, attempts: update.attempts, error: update.error, scheduled_at: update.scheduled_at, updated_at: update.updated_at })
      .eq('id', update.id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true, reset: failed.length })
}

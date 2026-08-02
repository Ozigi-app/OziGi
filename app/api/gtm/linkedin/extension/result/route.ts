import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { userIdFromExtensionToken, extensionCors } from '@/lib/gtm/extensionAuth'

// The extension reports the outcome of each action here. Mirrors the essential
// bookkeeping the old worker did: mark the queue row, advance lead/sequence state
// on success, and reschedule (without burning an attempt) for "not connected yet"
// or transient blocks so the sequence keeps flowing.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCors })
}

type Outcome = 'done' | 'not_connected' | 'retry_later' | 'failed'

export async function POST(req: Request) {
  const userId = await userIdFromExtensionToken(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: extensionCors })

  const body = await req.json().catch(() => null) as { id?: string; outcome?: Outcome; error?: string } | null
  const { id, outcome } = body ?? {}
  if (!id || !outcome) {
    return NextResponse.json({ error: 'id and outcome required' }, { status: 400, headers: extensionCors })
  }

  // Confirm the item belongs to this user before touching it.
  const { data: item } = await supabaseAdmin
    .from('linkedin_queue')
    .select('id, lead_id, action, sequence_step, attempts')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: extensionCors })

  const now = new Date().toISOString()
  const err = (body?.error ?? '').slice(0, 500) || null

  if (outcome === 'done') {
    await supabaseAdmin
      .from('linkedin_queue')
      .update({ status: 'done', processed_at: now, error: null })
      .eq('id', id)

    if (item.action === 'connect') {
      await supabaseAdmin.from('leads').update({ status: 'contacted', updated_at: now }).eq('id', item.lead_id)
    }
    if (item.sequence_step > 0) {
      await supabaseAdmin
        .from('sequence_sends')
        .update({ status: 'sent', sent_at: now })
        .eq('lead_id', item.lead_id)
        .eq('step', item.sequence_step)
        .eq('channel', 'linkedin')
        .eq('status', 'queued')
    }
    return NextResponse.json({ ok: true }, { headers: extensionCors })
  }

  if (outcome === 'not_connected') {
    // Connection not accepted yet — check again tomorrow, don't consume an attempt.
    const retryAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabaseAdmin
      .from('linkedin_queue')
      .update({ status: 'queued', scheduled_at: retryAt, attempts: item.attempts, error: null })
      .eq('id', id)
    return NextResponse.json({ ok: true }, { headers: extensionCors })
  }

  if (outcome === 'retry_later') {
    // Transient block / page didn't load — try again in an hour, no attempt burned.
    const retryAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    await supabaseAdmin
      .from('linkedin_queue')
      .update({ status: 'queued', scheduled_at: retryAt, attempts: item.attempts, error: err })
      .eq('id', id)
    return NextResponse.json({ ok: true }, { headers: extensionCors })
  }

  // failed — burn an attempt; permanently fail after 3.
  const newStatus = item.attempts + 1 >= 3 ? 'failed' : 'queued'
  await supabaseAdmin
    .from('linkedin_queue')
    .update({
      status: newStatus,
      attempts: item.attempts + 1,
      error: err,
      processed_at: newStatus === 'failed' ? now : null,
    })
    .eq('id', id)

  if (newStatus === 'failed' && item.sequence_step > 0) {
    await supabaseAdmin
      .from('sequence_sends')
      .update({ status: 'failed', error: err })
      .eq('lead_id', item.lead_id)
      .eq('step', item.sequence_step)
      .eq('channel', 'linkedin')
      .eq('status', 'queued')
  }

  return NextResponse.json({ ok: true }, { headers: extensionCors })
}

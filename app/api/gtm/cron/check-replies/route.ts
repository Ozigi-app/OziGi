import { NextResponse } from 'next/server'
import { verifyQStashRequest } from '@/lib/qstash'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { threadHasReply } from '@/lib/gtm/gmail'

export const maxDuration = 300

export async function POST(req: Request) {
  const sig     = req.headers.get('upstash-signature')
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

  // Find all sent email sequence_sends that have a gmail_thread_id but
  // whose lead hasn't replied yet — limit to last 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: sends, error } = await supabaseAdmin
    .from('sequence_sends')
    .select('id, lead_id, campaign_id, user_id, gmail_thread_id, sent_at')
    .eq('channel', 'email')
    .eq('status', 'sent')
    .not('gmail_thread_id', 'is', null)
    .gte('sent_at', cutoff)
    .order('sent_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!sends?.length) return NextResponse.json({ ok: true, checked: 0, replied: 0 })

  // Exclude leads already marked replied or opted_out — fetch their statuses
  const leadIds = [...new Set(sends.map(s => s.lead_id))]
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('id, status')
    .in('id', leadIds)

  const skipLeads = new Set(
    (leads ?? []).filter(l => l.status === 'replied' || l.status === 'opted_out').map(l => l.id)
  )

  const pending = sends.filter(s => !skipLeads.has(s.lead_id))

  // Get one email_account per user_id (for the access token)
  const userIds = [...new Set(pending.map(s => s.user_id))]
  const { data: accounts } = await supabaseAdmin
    .from('email_accounts')
    .select('id, user_id')
    .in('user_id', userIds)
    .eq('provider', 'gmail')
    .eq('is_active', true)

  const accountByUser: Record<string, string> = {}
  for (const acc of accounts ?? []) {
    if (!accountByUser[acc.user_id]) accountByUser[acc.user_id] = acc.id
  }

  let checked = 0
  let replied = 0

  for (const send of pending) {
    const accountId = accountByUser[send.user_id]
    if (!accountId) continue

    const hasReply = await threadHasReply(accountId, send.gmail_thread_id!, send.sent_at!)
    checked++

    if (hasReply) {
      const now = new Date().toISOString()
      await Promise.all([
        // Mark this specific send as replied
        supabaseAdmin
          .from('sequence_sends')
          .update({ status: 'replied' })
          .eq('id', send.id),

        // Mark the lead as replied — stops all future sequence steps
        supabaseAdmin
          .from('leads')
          .update({ status: 'replied', updated_at: now })
          .eq('id', send.lead_id),
      ])

      console.log(`[check-replies] lead ${send.lead_id} replied — sequence stopped`)
      replied++
    }

    // Polite delay to avoid hammering Gmail API
    await new Promise(r => setTimeout(r, 200))
  }

  return NextResponse.json({ ok: true, checked, replied })
}

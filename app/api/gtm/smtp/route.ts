import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendViaGmail } from '@/lib/gtm/gmail'
import { sendViaSmtp } from '@/lib/gtm/smtp'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, subject, body, firstName } = await req.json() as {
    to: string; subject: string; body: string; firstName?: string
  }

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'to, subject, and body are required' }, { status: 400 })
  }

  const name = (firstName ?? '').trim()
  const resolvedSubject = subject.replace(/\{\{first_name\}\}/gi, name)
  const resolvedBody    = body.replace(/\{\{first_name\}\}/gi, name)

  const { data: account, error } = await supabaseAdmin
    .from('email_accounts')
    .select('id, email_address, display_name, provider')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !account) {
    return NextResponse.json(
      { error: 'No email account connected. Add one in Settings.' },
      { status: 400 }
    )
  }

  try {
    const sender = account.provider === 'gmail' ? sendViaGmail : sendViaSmtp
    await sender(
      account.id,
      to,
      resolvedSubject,
      resolvedBody,
      account.display_name ?? '',
      account.email_address
    )

    // Log the send so it appears in the outreach email list
    await supabaseAdmin
      .from('sequence_sends')
      .insert({
        user_id:    user.id,
        lead_id:    null,
        campaign_id: null,
        step:       0,
        channel:    'email',
        subject:    resolvedSubject,
        body:       resolvedBody,
        status:     'sent',
        sent_at:    new Date().toISOString(),
      })
      .then(() => {})  // fire-and-forget; don't fail the response if DB rejects null FKs

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendViaGmail } from '@/lib/gtm/gmail'
import { sendViaSmtp } from '@/lib/gtm/smtp'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, subject, body } = await req.json() as { to: string; subject: string; body: string }

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'to, subject, and body are required' }, { status: 400 })
  }

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
      subject,
      body,
      account.display_name ?? '',
      account.email_address
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

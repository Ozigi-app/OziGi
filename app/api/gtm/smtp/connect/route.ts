import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/gtm/encrypt'
import { getPlanStatus } from '@/lib/plan'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { host, port, username, password, from_email } = await req.json() as {
    host: string; port: number; username: string; password: string; from_email?: string
  }

  if (!host || !username || !password) {
    return NextResponse.json({ error: 'host, username, and password are required' }, { status: 400 })
  }

  // Multi-inbox gate — first account always allowed; second requires Pro
  const planStatus = await getPlanStatus(user.id)
  if (!planStatus.hasMultiInbox) {
    const { count } = await supabaseAdmin
      .from('email_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)
    if ((count ?? 0) >= 1) {
      return NextResponse.json(
        { error: 'Multi-inbox rotation requires a Pro plan. Upgrade to add more sending accounts.' },
        { status: 403 }
      )
    }
  }

  // Test the credentials before saving
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: port ?? 587,
      secure: (port ?? 587) === 465,
      auth: { user: username, pass: password },
    })
    await transporter.verify()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `SMTP test failed: ${msg}` }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('email_accounts')
    .upsert({
      user_id:           user.id,
      provider:          'smtp',
      email_address:     username,
      display_name:      from_email ?? null,
      smtp_host:         host,
      smtp_port:         port ?? 587,
      smtp_username:     username,
      smtp_password_enc: encrypt(password),
      is_active:         true,
      daily_send_count:  0,
      last_send_date:    null,
    }, { onConflict: 'user_id,email_address' })
    .select('id, email_address, display_name, provider, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, account: data }, { status: 201 })
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SendMailClient } from 'zeptomail'
import fs from 'fs'
import path from 'path'

/**
 * POST /api/gtm/notify/session-expired
 *
 * Called by the LinkedIn worker when it marks a session as needs_login.
 * Looks up the user's email, and sends a "reconnect your LinkedIn" notification.
 *
 * Auth: Bearer WORKER_SECRET (same secret the worker uses for /login and /search)
 */
export async function POST(req: Request) {
  // Verify the request comes from our worker
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.WORKER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, linkedinEmail } = await req.json() as {
    userId: string
    linkedinEmail: string
  }

  if (!userId || !linkedinEmail) {
    return NextResponse.json({ error: 'userId and linkedinEmail required' }, { status: 400 })
  }

  try {
    // Look up the user's real email from Supabase auth
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error || !user?.email) {
      console.error(`[notify/session-expired] could not find user ${userId}:`, error?.message)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userName = user.user_metadata?.full_name
      || user.email.split('@')[0]
      || 'there'

    const settingsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/gtm/settings`

    // Load and fill the email template
    const templatePath = path.join(process.cwd(), 'emails', 'linkedin-session-expired.html')
    let html = fs.readFileSync(templatePath, 'utf8')
    html = html
      .replace(/{{name}}/g, userName)
      .replace(/{{linkedin_email}}/g, linkedinEmail)
      .replace(/{{settings_url}}/g, settingsUrl)

    const mailClient = new SendMailClient({
      url: 'https://api.zeptomail.com/v1.1/email',
      token: `Zoho-enczapikey ${process.env.ZEPTOMAIL_API_KEY}`,
    })

    await mailClient.sendMail({
      from: {
        address: process.env.WELCOME_EMAIL_FROM_ADDRESS || 'hello@ozigi.app',
        name:    process.env.WELCOME_EMAIL_FROM_NAME    || 'Ozigi Reminders',
      },
      to: [{
        email_address: {
          address: user.email,
          name:    userName,
        },
      }],
      subject: `Action needed: reconnect your LinkedIn account (${linkedinEmail})`,
      htmlbody: html,
    })

    console.log(`[notify/session-expired] sent reconnect email to ${user.email} for LinkedIn ${linkedinEmail}`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[notify/session-expired] failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

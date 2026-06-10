import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SendMailClient } from 'zeptomail'
import fs from 'fs'
import path from 'path'

/**
 * POST /api/gtm/notify/queue-empty
 *
 * Called by the LinkedIn worker when it finds the outreach queue empty for
 * a user who has an active session. Sends a "time to add more leads" nudge.
 *
 * The worker rate-limits calls to once per 24 h per user (in-memory), so
 * this endpoint does not need its own throttle — just send the email.
 *
 * Auth: Bearer WORKER_SECRET
 */
export async function POST(req: Request) {
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
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error || !user?.email) {
      console.error(`[notify/queue-empty] could not find user ${userId}:`, error?.message)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userName = user.user_metadata?.full_name
      || user.email.split('@')[0]
      || 'there'

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/gtm`

    const templatePath = path.join(process.cwd(), 'emails', 'queue-empty.html')
    let html = fs.readFileSync(templatePath, 'utf8')
    html = html
      .replace(/{{name}}/g, userName)
      .replace(/{{linkedin_email}}/g, linkedinEmail)
      .replace(/{{dashboard_url}}/g, dashboardUrl)

    const mailClient = new SendMailClient({
      url: 'https://api.zeptomail.com/v1.1/email',
      token: `Zoho-enczapikey ${process.env.ZEPTOMAIL_API_KEY}`,
    })

    await mailClient.sendMail({
      from: {
        address: process.env.WELCOME_EMAIL_FROM_ADDRESS || 'hello@ozigi.app',
        name:    process.env.WELCOME_EMAIL_FROM_NAME    || 'Ozigi',
      },
      to: [{
        email_address: {
          address: user.email,
          name:    userName,
        },
      }],
      subject: `Your LinkedIn outreach queue is empty — time to add more leads`,
      htmlbody: html,
    })

    console.log(`[notify/queue-empty] sent queue-empty email to ${user.email} for LinkedIn ${linkedinEmail}`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[notify/queue-empty] failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SendMailClient } from 'zeptomail'
import fs from 'fs'
import path from 'path'

/**
 * POST /api/gtm/notify/first-campaign
 *
 * Called by /api/gtm/cron/send when a user successfully sends outreach
 * for the very first time across any campaign. Sends a "here's what happens
 * next" onboarding email explaining the LinkedIn pipeline flow.
 *
 * Auth: Bearer CRON_SECRET
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, campaignId } = await req.json() as {
    userId: string
    campaignId: string
  }

  if (!userId || !campaignId) {
    return NextResponse.json({ error: 'userId and campaignId required' }, { status: 400 })
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error || !user?.email) {
      console.error(`[notify/first-campaign] could not find user ${userId}:`, error?.message)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userName = user.user_metadata?.full_name
      || user.email.split('@')[0]
      || 'there'

    const campaignUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/gtm/${campaignId}`

    const templatePath = path.join(process.cwd(), 'emails', 'first-campaign.html')
    let html = fs.readFileSync(templatePath, 'utf8')
    html = html
      .replace(/{{name}}/g, userName)
      .replace(/{{campaign_url}}/g, campaignUrl)

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
      subject: `Your first campaign just went live — here's what happens next`,
      htmlbody: html,
    })

    console.log(`[notify/first-campaign] sent first-campaign email to ${user.email} for campaign ${campaignId}`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[notify/first-campaign] failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

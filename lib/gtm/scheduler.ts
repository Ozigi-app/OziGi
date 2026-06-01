import { qstashClient } from '@/lib/qstash'
import { supabaseAdmin } from '@/lib/supabase/admin'

const SCRAPE_CRON        = '0 7 * * *'   // 7am UTC daily
const SEND_CRON          = '0 9 * * *'   // 9am UTC daily
const CHECK_REPLIES_CRON = '0 */4 * * *' // every 4 hours

function requireAppUrl(): string {
  const url = process.env.APP_URL
  if (!url || url.includes('localhost')) {
    throw new Error('APP_URL must be a public URL for QStash to deliver webhooks')
  }
  return url
}

export async function createCampaignSchedules(campaignId: string): Promise<void> {
  const appUrl = requireAppUrl()

  const [scrapeSchedule, sendSchedule, repliesSchedule] = await Promise.all([
    qstashClient.schedules.create({
      destination: `${appUrl}/api/gtm/cron/scrape`,
      cron: SCRAPE_CRON, retries: 2,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
      body: JSON.stringify({ campaignId }),
    }),
    qstashClient.schedules.create({
      destination: `${appUrl}/api/gtm/cron/send`,
      cron: SEND_CRON, retries: 2,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
      body: JSON.stringify({ campaignId }),
    }),
    qstashClient.schedules.create({
      destination: `${appUrl}/api/gtm/cron/check-replies`,
      cron: CHECK_REPLIES_CRON, retries: 1,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
      body: JSON.stringify({}),
    }),
  ])

  await supabaseAdmin.from('campaign_schedules').upsert({
    campaign_id:         campaignId,
    scrape_schedule_id:  scrapeSchedule.scheduleId,
    send_schedule_id:    sendSchedule.scheduleId,
    replies_schedule_id: repliesSchedule.scheduleId,
    updated_at:          new Date().toISOString(),
  }, { onConflict: 'campaign_id' })
}

export async function deleteCampaignSchedules(campaignId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('campaign_schedules')
    .select('scrape_schedule_id, send_schedule_id')
    .eq('campaign_id', campaignId)
    .single()

  if (!data) return

  await Promise.allSettled([
    data.scrape_schedule_id
      ? qstashClient.schedules.delete(data.scrape_schedule_id)
      : Promise.resolve(),
    data.send_schedule_id
      ? qstashClient.schedules.delete(data.send_schedule_id)
      : Promise.resolve(),
  ])

  await supabaseAdmin
    .from('campaign_schedules')
    .delete()
    .eq('campaign_id', campaignId)
}

// Trigger an immediate one-off run (useful after campaign creation or manual re-scrape)
export async function triggerImmediateScrape(campaignId: string): Promise<void> {
  const appUrl = requireAppUrl()

  await qstashClient.publishJSON({
    url: `${appUrl}/api/gtm/cron/scrape`,
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    body: { campaignId },
    retries: 2,
  })
}

export async function triggerImmediateSend(campaignId: string): Promise<void> {
  const appUrl = requireAppUrl()

  await qstashClient.publishJSON({
    url: `${appUrl}/api/gtm/cron/send`,
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    body: { campaignId },
    retries: 2,
  })
}

import { NextResponse } from 'next/server'
import { verifyQStashRequest } from '@/lib/qstash'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { composeEmail } from '@/lib/gtm/composer'
import { sendViaGmail } from '@/lib/gtm/gmail'
import type { Campaign, Lead, SequenceStep } from '@/lib/types/gtm'

export const maxDuration = 300

export async function POST(req: Request) {
  const sig = req.headers.get('upstash-signature')
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

  const { campaignId } = JSON.parse(rawBody) as { campaignId?: string }

  let query = supabaseAdmin.from('campaigns').select('*').eq('status', 'active')
  if (campaignId) query = query.eq('id', campaignId)

  const { data: campaigns, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!campaigns?.length) return NextResponse.json({ ok: true, message: 'No active campaigns' })

  const results: Record<string, { sent: number; skipped: number; error?: string }> = {}

  for (const campaign of campaigns as Campaign[]) {
    try {
      // Get the user's active Gmail account for this campaign
      const { data: emailAccount } = await supabaseAdmin
        .from('email_accounts')
        .select('id, email_address, display_name, daily_send_count, last_send_date')
        .eq('user_id', campaign.user_id)
        .eq('provider', 'gmail')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!emailAccount) {
        results[campaign.id] = { sent: 0, skipped: 0, error: 'No active Gmail account' }
        continue
      }

      // Reset daily count if it's a new day
      const today = new Date().toISOString().split('T')[0]
      let sentToday = emailAccount.last_send_date === today ? emailAccount.daily_send_count : 0
      const dailyLimit = campaign.daily_email_limit

      if (sentToday >= dailyLimit) {
        results[campaign.id] = { sent: 0, skipped: 0, error: 'Daily limit reached' }
        continue
      }

      const steps: SequenceStep[] = campaign.sequence_steps ?? []
      let campaignSent = 0
      let campaignSkipped = 0

      for (const step of steps.sort((a, b) => a.step - b.step)) {
        if (sentToday >= dailyLimit) break
        if (step.channel !== 'email') continue

        const leadsForStep = await getLeadsDueForStep(campaign.id, step, steps)

        for (const lead of leadsForStep) {
          if (sentToday >= dailyLimit) break

          try {
            const email = await composeEmail(lead, campaign, step)

            if (!lead.email) {
              campaignSkipped++
              continue
            }

            // Record the send attempt before sending (idempotency)
            const { data: sendRecord, error: insertErr } = await supabaseAdmin
              .from('sequence_sends')
              .insert({
                lead_id: lead.id,
                campaign_id: campaign.id,
                user_id: campaign.user_id,
                step: step.step,
                channel: 'email',
                subject: email.subject,
                body: email.body,
                status: 'queued',
              })
              .select('id')
              .single()

            if (insertErr) {
              // Unique constraint hit — already sent this step to this lead
              campaignSkipped++
              continue
            }

            await sendViaGmail(
              emailAccount.id,
              lead.email,
              email.subject,
              email.body,
              emailAccount.display_name ?? 'Dumebi',
              emailAccount.email_address
            )

            // Mark sent and update lead status
            await Promise.all([
              supabaseAdmin
                .from('sequence_sends')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('id', sendRecord.id),
              supabaseAdmin
                .from('leads')
                .update({ status: 'contacted', updated_at: new Date().toISOString() })
                .eq('id', lead.id),
            ])

            sentToday++
            campaignSent++
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[gtm/cron/send] lead ${lead.id} step ${step.step}:`, msg)

            // Mark failed in sequence_sends if we got that far
            await supabaseAdmin
              .from('sequence_sends')
              .update({ status: 'failed', error: msg })
              .eq('lead_id', lead.id)
              .eq('step', step.step)
              .eq('channel', 'email')
              .eq('status', 'queued')

            campaignSkipped++
          }
        }
      }

      // Update the account's daily send counter
      await supabaseAdmin
        .from('email_accounts')
        .update({ daily_send_count: sentToday, last_send_date: today })
        .eq('id', emailAccount.id)

      results[campaign.id] = { sent: campaignSent, skipped: campaignSkipped }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[gtm/cron/send] campaign ${campaign.id}:`, msg)
      results[campaign.id] = { sent: 0, skipped: 0, error: msg }
    }
  }

  return NextResponse.json({ ok: true, results })
}

async function getLeadsDueForStep(
  campaignId: string,
  step: SequenceStep,
  allSteps: SequenceStep[]
): Promise<Lead[]> {
  if (step.step === 1) {
    // Step 1: leads that have never been contacted
    const { data } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .not('email', 'is', null)
      .order('icp_match_score', { ascending: false })
      .limit(50)

    return (data ?? []) as Lead[]
  }

  // Steps 2+: find leads whose previous step was sent >= delay_days ago
  const prevStep = allSteps.find(s => s.step === step.step - 1)
  if (!prevStep) return []

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - step.delay_days)

  // Leads that have a completed previous step send but no current step send
  const { data } = await supabaseAdmin
    .from('leads')
    .select(`
      *,
      prev_send:sequence_sends!inner(sent_at, step, status)
    `)
    .eq('campaign_id', campaignId)
    .eq('status', 'contacted')
    .not('email', 'is', null)
    .eq('sequence_sends.step', prevStep.step)
    .eq('sequence_sends.channel', 'email')
    .eq('sequence_sends.status', 'sent')
    .lte('sequence_sends.sent_at', cutoff.toISOString())
    .limit(50)

  if (!data?.length) return []

  // Filter out leads that already have the current step sent
  const leadIds = data.map((l: Lead) => l.id)
  const { data: alreadySent } = await supabaseAdmin
    .from('sequence_sends')
    .select('lead_id')
    .in('lead_id', leadIds)
    .eq('step', step.step)
    .eq('channel', 'email')

  const alreadySentIds = new Set((alreadySent ?? []).map((s: { lead_id: string }) => s.lead_id))
  return (data as Lead[]).filter(l => !alreadySentIds.has(l.id))
}

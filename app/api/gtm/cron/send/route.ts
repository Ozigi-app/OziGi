import { NextResponse } from 'next/server'
import { verifyQStashRequest } from '@/lib/qstash'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { composeEmail, composeLinkedInMessage } from '@/lib/gtm/composer'
import { spreadScheduledAt } from '@/lib/gtm/schedule'
import { sendViaGmail } from '@/lib/gtm/gmail'
import { sendViaSmtp } from '@/lib/gtm/smtp'
import { syncLeadToCRM } from '@/lib/gtm/crm'
import { getPlanStatus, incrementSequenceSend } from '@/lib/plan'
import type { Campaign, Lead, SequenceStep } from '@/lib/types/gtm'
import type { PlanStatus } from '@/lib/plan'
import { phCapture } from '@/lib/posthog'

// Cache plan status per user within a single cron run
const planCache = new Map<string, PlanStatus>()

// Track whether each user has sent outreach before this run.
// Populated lazily: true = has prior sends (not their first), false = never sent before.
// Scoped per-request via a local variable below, not module-level (serverless safe).
type FirstSendCache = Map<string, boolean> // userId → hasEverSentBefore

export const maxDuration = 300

// Max emails per cron run — keeps us well within the 5-min serverless limit
// even with the inter-send delay. The daily_email_limit is enforced across runs.
const MAX_PER_RUN = 15
// Human-paced delay between sends (ms). Avoids rapid-fire bursts that trigger spam filters.
const INTER_SEND_DELAY_MS = 12_000  // 12 seconds

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

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

  planCache.clear()
  const firstSendCache: FirstSendCache = new Map()
  const results: Record<string, { emailSent: number; liEnqueued: number; skipped: number; error?: string }> = {}

  for (const campaign of campaigns as Campaign[]) {
    try {
      // ── Per-user plan gates ────────────────────────────────────────────────
      if (!planCache.has(campaign.user_id)) {
        planCache.set(campaign.user_id, await getPlanStatus(campaign.user_id))
      }
      const ps = planCache.get(campaign.user_id)!

      // ── First-campaign detection ───────────────────────────────────────────
      // Check BEFORE any sends so the count is the user's true prior history.
      // If they have zero prior sequence_sends (sent or queued), this will be
      // their first ever outreach — we'll send a "now what" onboarding email.
      if (!firstSendCache.has(campaign.user_id)) {
        const { count } = await supabaseAdmin
          .from('sequence_sends')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', campaign.user_id)
          .in('status', ['sent', 'queued'])
        firstSendCache.set(campaign.user_id, (count ?? 0) > 0)
      }

      if (!ps.hasGtm) {
        results[campaign.id] = { emailSent: 0, liEnqueued: 0, skipped: 0, error: 'No GTM access on current plan' }
        continue
      }

      // Check global sequence sends limit (applies to free plan: 30/mo)
      const atSendLimit = ps.sequenceSendsLimit !== -1 && ps.sequenceSendsUsed >= ps.sequenceSendsLimit

      const steps: SequenceStep[] = (campaign.sequence_steps ?? []).sort((a, b) => a.step - b.step)
      let campaignEmailSent = 0
      let campaignLiEnqueued = 0
      let campaignSkipped = 0

      // ── Email steps ─────────────────────────────────────────────────────────
      const emailSteps = steps.filter(s => s.channel === 'email')

      if (emailSteps.length > 0) {
        const { data: emailAccounts } = await supabaseAdmin
          .from('email_accounts')
          .select('id, email_address, display_name, daily_send_count, last_send_date, provider')
          .eq('user_id', campaign.user_id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })

        if (!emailAccounts?.length) {
          console.warn(`[gtm/cron/send] campaign ${campaign.id}: no active email account`)
        } else {
          const today = new Date().toISOString().split('T')[0]
          // Round-robin across all connected inboxes (Pro multi-inbox) instead of
          // always using a single account — spreads volume for deliverability.
          const accountStates = emailAccounts.map(account => ({
            account,
            sentToday: account.last_send_date === today ? account.daily_send_count : 0,
          }))
          let totalSentToday = accountStates.reduce((sum, s) => sum + s.sentToday, 0)
          const dailyEmailLimit = campaign.daily_email_limit
          // Soft per-inbox share of today's volume — keeps one account from absorbing
          // a disproportionate burst within a single run (warmup/deliverability safety).
          const perAccountCap = Math.max(1, Math.ceil(dailyEmailLimit / accountStates.length))
          let sentThisRun = 0
          let rrIndex = 0

          // Finds the next account (starting at rrIndex) under its per-account cap,
          // optionally skipping one account id (used for the failover retry below).
          function pickAccount(excludeId?: string) {
            for (let i = 0; i < accountStates.length; i++) {
              const idx = (rrIndex + i) % accountStates.length
              const state = accountStates[idx]
              if (state.sentToday >= perAccountCap) continue
              if (excludeId && state.account.id === excludeId) continue
              rrIndex = idx + 1
              return state
            }
            return null
          }

          const allAccountsCapped = () => accountStates.every(s => s.sentToday >= perAccountCap)

          for (const step of emailSteps) {
            if (totalSentToday >= dailyEmailLimit) break
            if (sentThisRun >= MAX_PER_RUN) break
            if (allAccountsCapped()) break

            const leadsForStep = await getLeadsDueForStep(campaign.id, step, steps)

            for (const lead of leadsForStep) {
              if (totalSentToday >= dailyEmailLimit) break
              if (sentThisRun >= MAX_PER_RUN) break
              if (allAccountsCapped()) break
              if (atSendLimit) { campaignSkipped++; continue }
              // In test mode TEST_EMAIL overrides recipient, so no real email needed
              if (!lead.email && !process.env.TEST_EMAIL) { campaignSkipped++; continue }

              const primaryState = pickAccount()
              if (!primaryState) break // every inbox hit its per-account share for today

              try {
                const email = await composeEmail(lead, campaign, step)

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

                if (insertErr) { campaignSkipped++; continue } // already sent

                // In test mode all mail is redirected to TEST_EMAIL
                const recipient = process.env.TEST_EMAIL ?? lead.email!

                let sendState = primaryState
                let sendResult: { messageId: string; threadId: string }
                try {
                  const sender = sendState.account.provider === 'gmail' ? sendViaGmail : sendViaSmtp
                  sendResult = await sender(
                    sendState.account.id,
                    recipient,
                    email.subject,
                    email.body,
                    sendState.account.display_name ?? '',
                    sendState.account.email_address
                  )
                } catch (primaryErr) {
                  // Transient provider failure (e.g. Gmail token hiccup) — fail over to
                  // another connected inbox once before giving up on this lead entirely.
                  const fallbackState = accountStates.length > 1 ? pickAccount(sendState.account.id) : null
                  if (!fallbackState) throw primaryErr
                  console.warn(`[gtm/cron/send] ${sendState.account.email_address} failed, retrying via ${fallbackState.account.email_address}`)
                  sendState = fallbackState
                  const sender = sendState.account.provider === 'gmail' ? sendViaGmail : sendViaSmtp
                  sendResult = await sender(
                    sendState.account.id,
                    recipient,
                    email.subject,
                    email.body,
                    sendState.account.display_name ?? '',
                    sendState.account.email_address
                  )
                }
                const { messageId, threadId } = sendResult

                await Promise.all([
                  supabaseAdmin
                    .from('sequence_sends')
                    .update({
                      status:           'sent',
                      sent_at:          new Date().toISOString(),
                      gmail_message_id: messageId,
                      gmail_thread_id:  threadId,
                    })
                    .eq('id', sendRecord.id),
                  supabaseAdmin
                    .from('leads')
                    .update({ status: 'contacted', updated_at: new Date().toISOString() })
                    .eq('id', lead.id),
                  // Sync to CRM on first outreach (fire-and-forget, non-blocking)
                  step.step === 1
                    ? syncLeadToCRM(lead, campaign.user_id).catch(e => console.error('[crm] sync failed:', e))
                    : Promise.resolve(),
                ])

                sendState.sentToday++
                totalSentToday++
                sentThisRun++
                campaignEmailSent++
                // Track sequence send usage (fire-and-forget; bust cache so limit is respected)
                incrementSequenceSend(campaign.user_id).catch(() => {})
                planCache.delete(campaign.user_id)

                // Human-paced delay — skip after the last send of this run
                if (sentThisRun < MAX_PER_RUN) await sleep(INTER_SEND_DELAY_MS)
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                console.error(`[gtm/cron/send] email lead ${lead.id} step ${step.step}:`, msg)
                await supabaseAdmin
                  .from('sequence_sends')
                  .update({ status: 'failed', error: msg })
                  .eq('lead_id', lead.id).eq('step', step.step).eq('channel', 'email').eq('status', 'queued')
                campaignSkipped++
              }
            }
          }

          await Promise.all(accountStates.map(s =>
            supabaseAdmin
              .from('email_accounts')
              .update({ daily_send_count: s.sentToday, last_send_date: today })
              .eq('id', s.account.id)
          ))
        }
      }

      // ── LinkedIn steps ───────────────────────────────────────────────────────
      const linkedinSteps = steps.filter(s => s.channel === 'linkedin')
      console.log(`[gtm/cron/send] campaign ${campaign.id}: ${linkedinSteps.length} linkedin steps, hasLinkedInOutreach=${ps.hasLinkedInOutreach}`)
      if (linkedinSteps.length > 0 && !ps.hasLinkedInOutreach) {
        console.log(`[gtm/cron/send] LinkedIn outreach not available on plan '${ps.plan}' for user ${campaign.user_id} — skipping LinkedIn steps`)
      }
      if (linkedinSteps.length > 0 && ps.hasLinkedInOutreach) {
        // Count how many LinkedIn actions already enqueued today for this campaign
        const today = new Date().toISOString().split('T')[0]
        const { count: liTodayCount } = await supabaseAdmin
          .from('linkedin_queue')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .gte('created_at', today)

        let liEnqueuedToday = liTodayCount ?? 0
        const dailyLinkedInLimit = campaign.daily_linkedin_limit ?? 20
        console.log(`[gtm/cron/send] campaign ${campaign.id}: liEnqueuedToday=${liEnqueuedToday}, dailyLinkedInLimit=${dailyLinkedInLimit}`)

        for (const step of linkedinSteps) {
          if (liEnqueuedToday >= dailyLinkedInLimit) break

          const action = getLinkedInAction(step, steps)
          const leadsForStep = await getLinkedInLeadsDueForStep(campaign.id, step, steps, action)
          console.log(`[gtm/cron/send] campaign ${campaign.id}: step ${step.step} action=${action}, leadsForStep=${leadsForStep.length}`)

          for (const lead of leadsForStep) {
            if (liEnqueuedToday >= dailyLinkedInLimit) break

            try {
              const message = await composeLinkedInMessage(lead, campaign, step, action)

              // Clear any 'failed' sequence_send so we can re-queue the lead.
              // 'sent' and 'queued' rows are intentionally left alone.
              await supabaseAdmin
                .from('sequence_sends')
                .delete()
                .eq('lead_id', lead.id)
                .eq('step', step.step)
                .eq('channel', 'linkedin')
                .eq('status', 'failed')

              // Idempotency: unique(lead_id, step, channel='linkedin')
              const { data: sendRecord, error: insertErr } = await supabaseAdmin
                .from('sequence_sends')
                .insert({
                  lead_id: lead.id,
                  campaign_id: campaign.id,
                  user_id: campaign.user_id,
                  step: step.step,
                  channel: 'linkedin',
                  body: action === 'connect'
                    ? message.slice(0, 300)   // LinkedIn connection note hard limit
                    : message,
                  status: 'queued',
                })
                .select('id')
                .single()

              if (insertErr) { campaignSkipped++; continue } // already enqueued

              // Enqueue to the LinkedIn worker queue — spread across business hours
              const { error: queueErr } = await supabaseAdmin
                .from('linkedin_queue')
                .insert({
                  lead_id: lead.id,
                  campaign_id: campaign.id,
                  user_id: campaign.user_id,
                  action,
                  message: action === 'connect'
                    ? message.slice(0, 300)
                    : message,
                  sequence_step: step.step,
                  scheduled_at: spreadScheduledAt(liEnqueuedToday, dailyLinkedInLimit),
                })

              if (queueErr) {
                // Roll back the sequence_sends row we just inserted
                await supabaseAdmin
                  .from('sequence_sends')
                  .delete()
                  .eq('id', sendRecord.id)
                console.error(`[gtm/cron/send] linkedin queue insert failed for lead ${lead.id}:`, queueErr.message)
                campaignSkipped++
                continue
              }

              liEnqueuedToday++
              campaignLiEnqueued++
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              console.error(`[gtm/cron/send] linkedin lead ${lead.id} step ${step.step}:`, msg)
              campaignSkipped++
            }
          }
        }
      }

      results[campaign.id] = { emailSent: campaignEmailSent, liEnqueued: campaignLiEnqueued, skipped: campaignSkipped }

      if (campaignEmailSent > 0 || campaignLiEnqueued > 0) {
        // First-ever campaign: send the onboarding "here's what happens next" email.
        // Only fires if the user had zero prior sends before this run.
        const hadNoPriorSends = firstSendCache.get(campaign.user_id) === false
        if (hadNoPriorSends) {
          // Mark as sent so a second campaign in the same cron run doesn't re-trigger.
          firstSendCache.set(campaign.user_id, true)
          const origin = new URL(req.url).origin
          fetch(`${origin}/api/gtm/notify/first-campaign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({ userId: campaign.user_id, campaignId: campaign.id }),
          }).catch(e => console.error('[gtm/cron/send] first-campaign notify failed:', e))
        }

        phCapture(campaign.user_id, 'gtm_outreach_sent', {
          campaignId: campaign.id,
          emailsSent: campaignEmailSent,
          linkedinEnqueued: campaignLiEnqueued,
          skipped: campaignSkipped,
          plan: planCache.get(campaign.user_id)?.plan,
        }).catch(() => {})
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[gtm/cron/send] campaign ${campaign.id}:`, msg)
      results[campaign.id] = { emailSent: 0, liEnqueued: 0, skipped: 0, error: msg }
    }
  }

  return NextResponse.json({ ok: true, results })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Determine the LinkedIn action type based on the step's position
 * among all LinkedIn steps in the campaign sequence.
 *   1st LinkedIn step → connect
 *   2nd LinkedIn step → message
 *   3rd+ LinkedIn step → follow_up
 */
function getLinkedInAction(
  step: SequenceStep,
  allSteps: SequenceStep[]
): 'connect' | 'message' | 'follow_up' {
  const liSteps = allSteps
    .filter(s => s.channel === 'linkedin')
    .sort((a, b) => a.step - b.step)
  const pos = liSteps.findIndex(s => s.step === step.step)
  if (pos === 0) return 'connect'
  if (pos === 1) return 'message'
  return 'follow_up'
}

/** Leads due for an email step */
const TEST_MODE = !!process.env.TEST_EMAIL

async function getLeadsDueForStep(
  campaignId: string,
  step: SequenceStep,
  allSteps: SequenceStep[]
): Promise<Lead[]> {
  if (step.step === 1) {
    let q = supabaseAdmin
      .from('leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
    // In production only send to leads with a real email address
    if (!TEST_MODE) q = q.not('email', 'is', null)
    const { data } = await q
      .order('icp_match_score', { ascending: false })
      .limit(50)
    return (data ?? []) as Lead[]
  }

  const prevStep = allSteps.find(s => s.step === step.step - 1)
  if (!prevStep) return []

  // End-of-day cutoff: a lead sent any time on day D is eligible starting on day D+delay.
  // Without setHours(23,59,59) the cutoff is midnight, which misses sends that happened
  // later in the same day (e.g. cron runs at 00:30, sends happened at 09:30 three days ago).
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - step.delay_days)
  cutoff.setHours(23, 59, 59, 999)

  const { data } = await supabaseAdmin
    .from('leads')
    .select(`*, prev_send:sequence_sends!inner(sent_at, step, status)`)
    .eq('campaign_id', campaignId)
    .eq('status', 'contacted')
    .not('email', 'is', null)
    .eq('sequence_sends.step', prevStep.step)
    .eq('sequence_sends.channel', prevStep.channel)
    .eq('sequence_sends.status', 'sent')
    .lte('sequence_sends.sent_at', cutoff.toISOString())
    .limit(50)

  if (!data?.length) return []

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

/** Leads due for a LinkedIn step */
async function getLinkedInLeadsDueForStep(
  campaignId: string,
  step: SequenceStep,
  allSteps: SequenceStep[],
  action: 'connect' | 'message' | 'follow_up'
): Promise<Lead[]> {
  if (action === 'connect') {
    // Connect works for both pending and already-emailed (contacted) leads
    const { data } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'contacted'])
      .not('linkedin_url', 'is', null)
      .order('icp_match_score', { ascending: false })
      .limit(50)

    if (!data?.length) return []

    // Exclude leads already queued or sent for this LinkedIn step
    const leadIds = data.map((l: Lead) => l.id)
    const { data: alreadyQueued } = await supabaseAdmin
      .from('sequence_sends')
      .select('lead_id')
      .in('lead_id', leadIds)
      .eq('step', step.step)
      .eq('channel', 'linkedin')

    const alreadyQueuedIds = new Set((alreadyQueued ?? []).map((s: { lead_id: string }) => s.lead_id))
    return (data as Lead[]).filter(l => !alreadyQueuedIds.has(l.id))
  }

  // Steps 2+: leads whose previous step was sent >= delay_days ago
  const prevStep = allSteps.find(s => s.step === step.step - 1)
  if (!prevStep) return []

  // End-of-day cutoff: a lead sent any time on day D is eligible starting on day D+delay.
  // Without setHours(23,59,59) the cutoff is midnight, which misses sends that happened
  // later in the same day (e.g. cron runs at 00:30, sends happened at 09:30 three days ago).
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - step.delay_days)
  cutoff.setHours(23, 59, 59, 999)

  // Previous step actually sent (worker confirmed) and delay has passed since execution.
  // Using sent_at (not created_at) and excluding 'queued' status prevents the next step
  // from firing while the previous action is still sitting in the linkedin_queue unexecuted —
  // which caused message + follow-up to be enqueued in the same cron run when delay_days=0.
  const { data } = await supabaseAdmin
    .from('leads')
    .select(`*, prev_send:sequence_sends!inner(sent_at, created_at, step, status)`)
    .eq('campaign_id', campaignId)
    .eq('status', 'contacted')
    .not('linkedin_url', 'is', null)       // need URL at minimum (profile_id extracted at action time)
    .eq('sequence_sends.step', prevStep.step)
    .eq('sequence_sends.channel', prevStep.channel)
    .eq('sequence_sends.status', 'sent')
    .not('sequence_sends.sent_at', 'is', null)
    .lte('sequence_sends.sent_at', cutoff.toISOString())
    .limit(50)

  if (!data?.length) return []

  // Exclude leads already queued or sent for this step.
  // 'failed' is retryable — the cron will delete it and re-insert.
  const leadIds = data.map((l: Lead) => l.id)
  const { data: alreadyQueued } = await supabaseAdmin
    .from('sequence_sends')
    .select('lead_id')
    .in('lead_id', leadIds)
    .eq('step', step.step)
    .eq('channel', 'linkedin')
    .in('status', ['queued', 'sent'])

  const alreadyQueuedIds = new Set((alreadyQueued ?? []).map((s: { lead_id: string }) => s.lead_id))
  return (data as Lead[]).filter(l => !alreadyQueuedIds.has(l.id))
}

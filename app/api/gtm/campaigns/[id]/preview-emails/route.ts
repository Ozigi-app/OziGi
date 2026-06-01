import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { composeEmail } from '@/lib/gtm/composer'
import type { Campaign, Lead, SequenceStep } from '@/lib/types/gtm'

/**
 * Generates 3 sample emails for the campaign's next due email step
 * WITHOUT saving anything — purely for user review before approving a send.
 *
 * Picks leads spread across the ICP score range so the user sees
 * the best, average, and lower-quality personalisation.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const steps: SequenceStep[] = ((campaign as Campaign).sequence_steps ?? [])
    .sort((a: SequenceStep, b: SequenceStep) => a.step - b.step)

  const emailSteps = steps.filter((s: SequenceStep) => s.channel === 'email')
  if (emailSteps.length === 0) {
    return NextResponse.json({ error: 'Campaign has no email steps' }, { status: 400 })
  }

  // Find the first email step that has pending leads
  let targetStep: SequenceStep | null = null
  let sampleLeads: Lead[] = []

  for (const step of emailSteps) {
    let q
    if (step.step === 1) {
      const { data } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('campaign_id', id)
        .eq('status', 'pending')
        .not('email', 'is', null)
        .order('icp_match_score', { ascending: false })
        .limit(50)
      if (data?.length) { targetStep = step; sampleLeads = data as Lead[]; break }
    } else {
      const prevStep = steps.find((s: SequenceStep) => s.step === step.step - 1)
      if (!prevStep) continue
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - step.delay_days)
      const { data } = await supabaseAdmin
        .from('leads')
        .select(`*, prev_send:sequence_sends!inner(sent_at, step, status)`)
        .eq('campaign_id', id)
        .eq('status', 'contacted')
        .not('email', 'is', null)
        .eq('sequence_sends.step', prevStep.step)
        .eq('sequence_sends.channel', 'email')
        .eq('sequence_sends.status', 'sent')
        .lte('sequence_sends.sent_at', cutoff.toISOString())
        .limit(50)
      if (data?.length) { targetStep = step; sampleLeads = data as Lead[]; break }
    }
  }

  if (!targetStep || sampleLeads.length === 0) {
    return NextResponse.json({ error: 'No leads are currently due for an email step' }, { status: 400 })
  }

  // Pick 3 leads spread across score range: best, middle, lowest
  const sorted = [...sampleLeads].sort(
    (a, b) => (b.icp_match_score ?? 0) - (a.icp_match_score ?? 0)
  )
  const picks: Lead[] = []
  if (sorted.length >= 1) picks.push(sorted[0])                                   // best
  if (sorted.length >= 3) picks.push(sorted[Math.floor(sorted.length / 2)])       // middle
  if (sorted.length >= 2) picks.push(sorted[sorted.length - 1])                   // lowest

  // Compose without saving
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const previews = await Promise.all(
    picks.map(async lead => {
      try {
        const email = await composeEmail(lead, campaign as Campaign, targetStep!, appUrl)
        return {
          lead: { id: lead.id, name: lead.name, email: lead.email, icp_match_score: lead.icp_match_score },
          subject: email.subject,
          body: email.body,
        }
      } catch (e) {
        return {
          lead: { id: lead.id, name: lead.name, email: lead.email, icp_match_score: lead.icp_match_score },
          error: e instanceof Error ? e.message : 'Compose failed',
        }
      }
    })
  )

  return NextResponse.json({
    step:     targetStep.step,
    total:    sampleLeads.length,
    previews,
  })
}

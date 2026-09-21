import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deleteCampaignSchedules } from '@/lib/gtm/scheduler'

// These tables are paged, so their row arrays must never be used as totals —
// `counts` is queried separately and is what the UI displays.
const LEAD_PAGE  = 100
const SEND_PAGE  = 200
const QUEUE_PAGE = 100

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const countOf = (table: string) =>
    supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('campaign_id', id)

  const [
    campaignRes, leadsRes, sendsRes, liQueueRes,
    leadTotal, leadWithLi, sendTotal, emailSent, emailQueued, replied,
    liDone, liPending, liFailed,
  ] = await Promise.all([
    supabaseAdmin.from('campaigns').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabaseAdmin
      .from('leads')
      .select('id, name, email, linkedin_url, source, status, icp_match_score, company, created_at')
      .eq('campaign_id', id)
      .order('icp_match_score', { ascending: false })
      .limit(LEAD_PAGE),
    supabaseAdmin
      .from('sequence_sends')
      .select('id, step, channel, status, sent_at, lead_id')
      .eq('campaign_id', id)
      .order('sent_at', { ascending: false })
      .limit(SEND_PAGE),
    supabaseAdmin
      .from('linkedin_queue')
      .select('id, lead_id, action, status, attempts, error, scheduled_at, processed_at')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false })
      .limit(QUEUE_PAGE),

    countOf('leads'),
    countOf('leads').not('linkedin_url', 'is', null),
    countOf('sequence_sends'),
    countOf('sequence_sends').eq('channel', 'email').eq('status', 'sent'),
    countOf('sequence_sends').eq('channel', 'email').eq('status', 'queued'),
    countOf('sequence_sends').eq('status', 'replied'),
    countOf('linkedin_queue').eq('status', 'done'),
    countOf('linkedin_queue').in('status', ['queued', 'in_progress']),
    countOf('linkedin_queue').eq('status', 'failed'),
  ])

  if (campaignRes.error || !campaignRes.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    campaign:    campaignRes.data,
    leads:       leadsRes.data    ?? [],
    sends:       sendsRes.data    ?? [],
    liQueue:     liQueueRes.data  ?? [],
    counts: {
      leads:             leadTotal.count   ?? 0,
      leadsWithLinkedin: leadWithLi.count  ?? 0,
      sends:             sendTotal.count   ?? 0,
      emailSent:         emailSent.count   ?? 0,
      emailQueued:       emailQueued.count ?? 0,
      replied:           replied.count     ?? 0,
      liDone:            liDone.count      ?? 0,
      liPending:         liPending.count   ?? 0,
      liFailed:          liFailed.count    ?? 0,
    },
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Only allow patching safe fields
  const allowed = ['name', 'status', 'daily_email_limit', 'sequence_steps', 'sources', 'icp_config', 'product_context', 'product_description', 'sender_name', 'sender_title', 'product_name', 'cta_url', 'persona_voice', 'sample_email']
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // If pausing/completing, remove QStash schedules
  if (updates.status && updates.status !== 'active') {
    deleteCampaignSchedules(id).catch(e =>
      console.error('[gtm/campaigns/[id]] schedule deletion failed:', e)
    )
  }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  deleteCampaignSchedules(id).catch(() => {})

  const { error } = await supabaseAdmin
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

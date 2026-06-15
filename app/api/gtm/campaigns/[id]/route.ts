import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deleteCampaignSchedules } from '@/lib/gtm/scheduler'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [campaignRes, leadsRes, sendsRes, liQueueRes] = await Promise.all([
    supabaseAdmin.from('campaigns').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabaseAdmin
      .from('leads')
      .select('id, name, email, linkedin_url, source, status, icp_match_score, company, created_at')
      .eq('campaign_id', id)
      .order('icp_match_score', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('sequence_sends')
      .select('id, step, channel, status, sent_at, lead_id')
      .eq('campaign_id', id)
      .order('sent_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('linkedin_queue')
      .select('id, lead_id, action, status, attempts, error, scheduled_at, processed_at')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (campaignRes.error || !campaignRes.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    campaign:    campaignRes.data,
    leads:       leadsRes.data    ?? [],
    sends:       sendsRes.data    ?? [],
    liQueue:     liQueueRes.data  ?? [],
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Only allow patching safe fields
  const allowed = ['name', 'status', 'daily_email_limit', 'sequence_steps', 'sources', 'icp_config', 'product_context', 'product_description', 'sender_name', 'sender_title', 'product_name', 'cta_url', 'persona_voice']
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

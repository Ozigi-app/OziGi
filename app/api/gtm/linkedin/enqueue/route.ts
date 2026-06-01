import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Enqueue a LinkedIn action for a lead.
// The persistent worker will pick it up within 30 seconds.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id, campaign_id, action, message, scheduled_at } = await req.json()

  if (!lead_id || !campaign_id || !action) {
    return NextResponse.json({ error: 'lead_id, campaign_id, and action are required' }, { status: 400 })
  }

  // Verify campaign ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id')
    .eq('id', campaign_id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('linkedin_queue')
    .insert({
      lead_id,
      campaign_id,
      user_id: user.id,
      action,
      message: message ?? null,
      status: 'queued',
      scheduled_at: scheduled_at ?? new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, queue_id: data.id }, { status: 201 })
}

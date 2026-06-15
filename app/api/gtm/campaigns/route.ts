import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseIcpDescription } from '@/lib/gtm/composer'
import { createCampaignSchedules, triggerImmediateScrape } from '@/lib/gtm/scheduler'
import { getPlanStatus } from '@/lib/plan'
import { phCapture } from '@/lib/posthog'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('*, leads(count), sequence_sends(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Plan gates
  const planStatus = await getPlanStatus(user.id)
  if (!planStatus.hasGtm) {
    return NextResponse.json(
      { error: 'GTM features are available on Growth and Pro plans.' },
      { status: 403 }
    )
  }
  if (!planStatus.canRunCampaigns) {
    return NextResponse.json(
      { error: 'You have reached your active campaign limit. Upgrade to Growth or Pro for unlimited campaigns.', plan: planStatus.plan, activeCampaignsUsed: planStatus.activeCampaignsUsed, activeCampaignsLimit: planStatus.activeCampaignsLimit },
      { status: 403 }
    )
  }

  const {
    name, icp_description, sources, daily_email_limit, daily_linkedin_limit, sequence_steps,
    sender_name, sender_title, product_name, product_description, product_context, cta_url, persona_voice,
  } = await req.json()

  if (!name || !icp_description || !sources?.length) {
    return NextResponse.json({ error: 'name, icp_description, and sources are required' }, { status: 400 })
  }

  // Parse ICP with Gemini
  const icp_config = await parseIcpDescription(icp_description)

  const { data: campaign, error } = await supabaseAdmin
    .from('campaigns')
    .insert({
      user_id: user.id,
      name,
      icp_description,
      icp_config,
      sources,
      daily_email_limit: daily_email_limit ?? 40,
      daily_linkedin_limit: daily_linkedin_limit ?? 20,
      sequence_steps: sequence_steps ?? [
        { step: 1, channel: 'email', delay_days: 0 },
        { step: 2, channel: 'email', delay_days: 3 },
        { step: 3, channel: 'email', delay_days: 7 },
      ],
      status: 'active',
      sender_name:         sender_name         ?? 'Dumebi',
      sender_title:        sender_title        ?? 'Founder',
      product_name:        product_name        ?? 'Ozigi',
      product_description: product_description ?? '',
      product_context:     product_context     ?? null,
      cta_url:             cta_url             ?? 'https://ozigi.app',
      persona_voice:       persona_voice       ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Register QStash schedules + kick off first scrape (fire-and-forget)
  const origin = new URL(req.url).origin
  if (!origin.includes('localhost')) {
    createCampaignSchedules(campaign.id).catch(e =>
      console.error('[gtm/campaigns] schedule creation failed:', e)
    )
    triggerImmediateScrape(campaign.id).catch(e =>
      console.error('[gtm/campaigns] immediate scrape failed:', e)
    )
  }

  phCapture(user.id, 'gtm_campaign_created', {
    email: user.email,
    campaignId: campaign.id,
    campaignName: name,
    sources,
    dailyEmailLimit: daily_email_limit ?? 40,
    dailyLinkedinLimit: daily_linkedin_limit ?? 20,
    sequenceStepCount: (sequence_steps ?? []).length || 3,
    plan: planStatus.plan,
  }).catch(() => {})

  return NextResponse.json({ campaign }, { status: 201 })
}

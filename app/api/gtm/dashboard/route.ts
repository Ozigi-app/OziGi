import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    campaignsRes,
    sendsRes,
    leadsRes,
    liQueueRes,
    emailAccountRes,
    liSessionRes,
    crmRes,
  ] = await Promise.all([
    // Campaigns
    supabaseAdmin.from('campaigns')
      .select('id, name, status, created_at, daily_email_limit')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),

    // All sequence sends (last 30 days)
    supabaseAdmin.from('sequence_sends')
      .select('id, channel, status, sent_at, created_at')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo),

    // Lead counts
    supabaseAdmin.from('leads')
      .select('id, created_at, status')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo),

    // LinkedIn queue
    supabaseAdmin.from('linkedin_queue')
      .select('id, action, status, created_at')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo),

    // Connected email accounts
    supabaseAdmin.from('email_accounts')
      .select('id, email_address, provider, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(3),

    // LinkedIn session
    supabaseAdmin.from('linkedin_sessions')
      .select('id, status, linkedin_email')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1),

    // CRM
    supabaseAdmin.from('crm_connections')
      .select('id, provider, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1),
  ])

  const sends      = sendsRes.data  ?? []
  const leads      = leadsRes.data  ?? []
  const liQueue    = liQueueRes.data ?? []
  const campaigns  = campaignsRes.data ?? []

  // ── Stats ─────────────────────────────────────────────────────────────────
  const emailsSent    = sends.filter(s => s.channel === 'email'    && s.status === 'sent').length
  const liDone        = liQueue.filter(q => q.status === 'done').length
  const replies       = sends.filter(s => s.status === 'replied').length
  const replyRate     = emailsSent > 0 ? ((replies / emailsSent) * 100).toFixed(1) : '0.0'
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length

  // ── Lead generation chart — leads per day (last 14 days) ─────────────────
  const leadsByDay: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    leadsByDay[d.toISOString().split('T')[0]] = 0
  }
  for (const l of leads) {
    const day = l.created_at.split('T')[0]
    if (day in leadsByDay) leadsByDay[day]++
  }
  const leadChart = Object.entries(leadsByDay).map(([date, count]) => ({
    date: date.slice(5), // MM-DD
    leads: count,
  }))

  // ── Email sends chart — emails sent per day (last 14 days) ───────────────
  const sendsByDay: Record<string, number> = {}
  for (const k of Object.keys(leadsByDay)) sendsByDay[k] = 0
  for (const s of sends.filter(s => s.channel === 'email' && s.status === 'sent')) {
    const day = (s.sent_at ?? s.created_at).split('T')[0]
    if (day in sendsByDay) sendsByDay[day]++
  }
  const sendChart = Object.entries(sendsByDay).map(([date, count]) => ({
    date: date.slice(5),
    emails: count,
  }))

  // ── Channels status ───────────────────────────────────────────────────────
  const channels = {
    gmail:    (emailAccountRes.data ?? []).find(a => a.provider === 'gmail'),
    smtp:     (emailAccountRes.data ?? []).find(a => a.provider === 'smtp'),
    linkedin: (liSessionRes.data  ?? [])[0] ?? null,
    crm:      (crmRes.data        ?? [])[0] ?? null,
  }

  // ── Recent campaigns for the list ─────────────────────────────────────────
  const campaignList = campaigns.map(c => ({
    id:              c.id,
    name:            c.name,
    status:          c.status,
    emailsSent:      sends.filter(s => s.status === 'sent' && s.channel === 'email').length,
    liDone:          liQueue.filter(q => q.status === 'done').length,
  }))

  return NextResponse.json({
    stats: {
      activeCampaigns,
      emailsSent,
      liActionsCompleted: liDone,
      replyRate: `${replyRate}%`,
      totalLeads: leads.length,
    },
    charts: { leads: leadChart, sends: sendChart },
    channels,
    campaigns: campaignList,
  })
}

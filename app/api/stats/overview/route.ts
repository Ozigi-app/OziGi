import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/stats/overview
 *
 * Single endpoint that returns every stat shown on the dashboard overview.
 * Runs all queries in parallel server-side so the client makes one fetch.
 *
 * DB migration required (run once in Supabase SQL editor):
 *   ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS newsletters_generated INTEGER DEFAULT 0;
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  const [
    socialCampaignsRes,
    newsletterStatsRes,
    scheduledPendingRes,
    blogPostsRes,
    personasRes,
    subscribersRes,
    sequenceSendsRes,
    liQueueRes,
    leadsRes,
    leadsWithEmailRes,
  ] = await Promise.all([
    // ── Content Studio ──────────────────────────────────────────────────────
    // Social campaigns: count rows with type 'social' (or legacy rows without a type)
    supabaseAdmin
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .not('generated_content', 'is', null)
      .or('type.eq.social,type.is.null'),

    // Newsletter generations: count from campaigns by type
    supabaseAdmin
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('type', 'newsletter'),

    // Posts currently scheduled and pending
    supabaseAdmin
      .from('scheduled_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('status', 'pending')
      .eq('is_longform', false),

    // Blog posts generated (stored as long-form scheduled posts)
    supabaseAdmin
      .from('scheduled_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('is_longform', true),

    // Writing personas saved
    supabaseAdmin
      .from('user_personas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid),

    // Newsletter subscribers
    supabaseAdmin
      .from('subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid),

    // ── Outbound Growth ─────────────────────────────────────────────────────
    // All outbound sequence sends — email channel
    supabaseAdmin
      .from('sequence_sends')
      .select('status, channel')
      .eq('user_id', uid)
      .eq('channel', 'email'),

    // LinkedIn queue — all completed actions, with action type
    supabaseAdmin
      .from('linkedin_queue')
      .select('action, status')
      .eq('user_id', uid)
      .eq('status', 'done'),

    // All leads sourced
    supabaseAdmin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid),

    // Leads where we scraped an email address
    supabaseAdmin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .not('email', 'is', null),
  ])

  // ── Content Studio stats ─────────────────────────────────────────────────
  const socialCampaigns      = socialCampaignsRes.count   ?? 0
  const newslettersGenerated = newsletterStatsRes.count   ?? 0
  const postsScheduled        = scheduledPendingRes.count         ?? 0
  const blogPostsWritten      = blogPostsRes.count                ?? 0
  const personasSaved         = personasRes.count                 ?? 0
  const newsletterSubscribers = subscribersRes.count              ?? 0

  // ── Outbound Growth stats ────────────────────────────────────────────────
  const sends         = sequenceSendsRes.data ?? []
  const emailsSent    = sends.filter(s => s.status === 'sent').length
  const emailReplies  = sends.filter(s => s.status === 'replied').length
  const replyRate     = emailsSent > 0
    ? `${((emailReplies / emailsSent) * 100).toFixed(1)}%`
    : '0.0%'

  const liDone        = liQueueRes.data ?? []
  const liConnections = liDone.filter(q => q.action === 'connect').length
  const liMessages    = liDone.filter(q => q.action === 'message' || q.action === 'follow_up').length

  const totalLeads    = leadsRes.count          ?? 0
  const emailsScraped = leadsWithEmailRes.count ?? 0

  return NextResponse.json({
    content: {
      socialCampaigns,
      newslettersGenerated,
      blogPostsWritten,
      postsScheduled,
      personasSaved,
      newsletterSubscribers,
    },
    outbound: {
      emailsSent,
      emailReplies,
      replyRate,
      liConnections,
      liMessages,
      totalLeads,
      emailsScraped,
    },
  })
}

/**
 * Ozigi LinkedIn Worker
 *
 * Persistent process that polls the linkedin_queue table and executes
 * LinkedIn actions (connect, message, follow_up) using Playwright.
 *
 * Run locally:  npm run dev
 * Deploy:       Railway or Fly.io using Dockerfile.linkedin
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GTM_ENCRYPTION_KEY
 */
import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(__dirname, '../../.env.local') })

import http from 'http'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadSession, saveSession, markSessionExpired, isLoggedIn } from './browser'
import { sendConnectionRequest, sendLinkedInMessage, sendFollowUp } from './actions'
import { loginLinkedIn } from './login'
import { searchAndSaveLeads } from './search'
import type { BrowserContext } from 'playwright'

// Module-level context cache — keeps browser contexts alive between poll cycles.
//
// WHY: LinkedIn's APFC fingerprint system captures ~48 device signals on every
// page load and binds them to the session. Closing and reopening the browser on
// every 90-second poll resets these signals → session killed after 2-3 pages.
// Keeping the same context alive means LinkedIn always sees the same "device".
interface CachedContext {
  context: BrowserContext
  sessionId: string        // track which DB session this context belongs to
  linkedinEmail: string
  validatedAt: number
}
const contextCache = new Map<string, CachedContext>()

// HTTP server — health checks + /login + /search endpoints
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'linkedin-worker' }))
    return
  }

  if (req.method === 'POST' && req.url === '/search') {
    const auth = req.headers['authorization']
    if (auth !== `Bearer ${process.env.WORKER_SECRET}`) {
      res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return
    }

    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const { userId, campaignId, icpConfig, limit } = JSON.parse(Buffer.concat(chunks).toString())

    if (!userId || !campaignId || !icpConfig) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'userId, campaignId, icpConfig required' })); return
    }

    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, message: 'LinkedIn search started' }))

    ;(async () => {
      const supabase = getSupabase()
      const { data: session } = await supabase
        .from('linkedin_sessions')
        .select('id, linkedin_email, status')
        .eq('user_id', userId).eq('status', 'active')
        .order('last_used_at', { ascending: false }).limit(1).single()

      if (!session) {
        console.warn(`[worker:search] no active LinkedIn session for user ${userId}`); return
      }

      const sessionInfo = { sessionId: session.id, userId, linkedinEmail: session.linkedin_email }

      // Reuse cached context for search if available
      let context: BrowserContext
      const cached = contextCache.get(userId)

      if (cached && cached.sessionId === session.id) {
        const loggedIn = await isLoggedIn(cached.context).catch(() => false)
        if (loggedIn) {
          context = cached.context
          cached.validatedAt = Date.now()
        } else {
          await cached.context.close().catch(() => {})
          contextCache.delete(userId)
          const loaded = await loadSession(sessionInfo)
          context = loaded.context
          contextCache.set(userId, { context, sessionId: session.id, linkedinEmail: session.linkedin_email, validatedAt: Date.now() })
        }
      } else {
        if (cached) {
          await cached.context.close().catch(() => {})
          contextCache.delete(userId)
        }
        const loaded = await loadSession(sessionInfo)
        context = loaded.context
        contextCache.set(userId, { context, sessionId: session.id, linkedinEmail: session.linkedin_email, validatedAt: Date.now() })
      }

      try {
        if (!await isLoggedIn(context)) {
          await markSessionExpired(session.id)
          await context.close().catch(() => {})
          contextCache.delete(userId)
          console.warn(`[worker:search] session expired for ${session.linkedin_email}`); return
        }

        const saved = await searchAndSaveLeads(context, supabase, userId, campaignId, icpConfig, limit ?? 25)
        console.log(`[worker:search] done — ${saved} leads saved for campaign ${campaignId}`)
        await saveSession(sessionInfo, context)
        // Leave context alive in cache
      } catch (err) {
        console.error('[worker:search] error:', err)
        // Don't close context on search error — might recover on next action
      }
    })().catch(err => console.error('[worker:search] unhandled:', err))
    return
  }

  if (req.method === 'POST' && req.url === '/login') {
    const auth = req.headers['authorization']
    if (auth !== `Bearer ${process.env.WORKER_SECRET}`) {
      res.writeHead(401)
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const { userId } = JSON.parse(Buffer.concat(chunks).toString())

    if (!userId) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'userId required' }))
      return
    }

    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, message: 'Login started' }))

    // Close any cached context for this user — login creates a new session
    const cached = contextCache.get(userId)
    if (cached) {
      await cached.context.close().catch(() => {})
      contextCache.delete(userId)
    }

    loginLinkedIn(userId).catch(err =>
      console.error(`[worker] loginLinkedIn failed for ${userId}:`, err)
    )
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(process.env.PORT ?? 8080, () => {
  console.log(`[worker] listening on port ${process.env.PORT ?? 8080}`)
})

const POLL_INTERVAL_MS    = 90_000
const ACTION_DELAY_MS     = [120_000, 240_000] as const
const MAX_ACTIONS_PER_RUN = 1

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { transport: ws as unknown as typeof WebSocket } }
  )
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs)
  console.log(`[worker] waiting ${(ms / 1000).toFixed(1)}s before next action`)
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface QueueItem {
  id: string
  lead_id: string
  campaign_id: string
  user_id: string
  action: 'connect' | 'message' | 'follow_up'
  message: string | null
  sequence_step: number
  attempts: number
  scheduled_at: string
}

interface Lead {
  linkedin_url: string | null
  linkedin_profile_id: string | null
  name: string | null
}

function extractProfileId(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/)
  return m ? m[1] : null
}

async function processItem(
  item: QueueItem,
  context: BrowserContext
): Promise<void> {
  const supabase = getSupabase()

  const { data: lead } = await supabase
    .from('leads')
    .select('linkedin_url, linkedin_profile_id, name')
    .eq('id', item.lead_id)
    .single() as { data: Lead | null }

  if (!lead?.linkedin_url && !lead?.linkedin_profile_id) {
    throw new Error('Lead has no LinkedIn URL or profile ID')
  }

  const profileId = lead.linkedin_profile_id
    ?? (lead.linkedin_url ? extractProfileId(lead.linkedin_url) : null)

  console.log(`[worker] executing ${item.action} for lead ${item.lead_id}`)

  switch (item.action) {
    case 'connect':
      try {
        await sendConnectionRequest(context, lead.linkedin_url!, item.message ?? undefined)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.startsWith('OPEN_PROFILE') && profileId) {
          // Open Profile (LinkedIn Premium) — send direct message as first contact
          if (item.message) {
            console.log(`[worker] Open Profile for lead ${item.lead_id} — sending direct message`)
            await sendLinkedInMessage(context, profileId, item.message)
            return  // success — caller marks item done and lead contacted
          }
          throw new Error('Open Profile detected — no message text configured for direct outreach')
        }
        throw err
      }
      break

    case 'message':
      if (!profileId) throw new Error('Cannot message: no linkedin_profile_id and could not extract from URL')
      await sendLinkedInMessage(context, profileId, item.message ?? '')
      break

    case 'follow_up':
      if (!profileId) throw new Error('Cannot follow_up: no linkedin_profile_id and could not extract from URL')
      await sendFollowUp(context, profileId, item.message ?? '')
      break

    default:
      throw new Error(`Unknown action: ${item.action}`)
  }
}

async function runForUser(userId: string, items: QueueItem[]): Promise<void> {
  const supabase = getSupabase()

  const { data: session } = await supabase
    .from('linkedin_sessions')
    .select('id, linkedin_email, status, updated_at, last_used_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_used_at', { ascending: false })
    .limit(1)
    .single()

  if (!session) {
    console.warn(`[worker] no active LinkedIn session for user ${userId} — skipping`)
    return
  }

  if (!session.last_used_at) {
    const WARMUP_MS = 15 * 60 * 1000
    const sessionAgeMs = Date.now() - new Date(session.updated_at).getTime()
    if (sessionAgeMs < WARMUP_MS) {
      const waitMin = Math.ceil((WARMUP_MS - sessionAgeMs) / 60_000)
      console.log(`[worker] session for ${session.linkedin_email} warming up — ${waitMin}min remaining, skipping`)
      return
    }
  }

  const sessionInfo = { sessionId: session.id, userId, linkedinEmail: session.linkedin_email }

  // Resolve context from cache or create a new persistent context.
  // If the DB session changed (user re-logged in), discard the old context.
  let context: BrowserContext
  const cached = contextCache.get(userId)

  if (cached) {
    if (cached.sessionId !== session.id) {
      // User re-authenticated — the old profile's cookies are stale
      console.log(`[worker] session renewed for ${session.linkedin_email} — closing old context`)
      await cached.context.close().catch(() => {})
      contextCache.delete(userId)
    } else {
      const loggedIn = await isLoggedIn(cached.context).catch(() => false)
      if (loggedIn) {
        console.log(`[worker] reusing live context for ${session.linkedin_email}`)
        context = cached.context
        cached.validatedAt = Date.now()
      } else {
        console.warn(`[worker] cached context invalid for ${session.linkedin_email} — recreating`)
        await cached.context.close().catch(() => {})
        contextCache.delete(userId)
      }
    }
  }

  if (!context!) {
    console.log(`[worker] creating persistent context for ${session.linkedin_email}`)
    const loaded = await loadSession(sessionInfo)
    context = loaded.context
    contextCache.set(userId, {
      context,
      sessionId: session.id,
      linkedinEmail: session.linkedin_email,
      validatedAt: Date.now(),
    })
  }

  // Feed visit: validates the session is live and refreshes tokens.
  console.log(`[worker] warming session via feed for ${session.linkedin_email}`)
  const feedPage = await context.newPage()
  try {
    await feedPage.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await feedPage.waitForTimeout(2000)

    const feedUrl = feedPage.url()
    if (feedUrl.includes('/login') || feedUrl.includes('/checkpoint') || feedUrl.includes('/authwall')) {
      console.warn(`[worker] feed redirected to ${feedUrl} — session expired for ${session.linkedin_email}`)
      await markSessionExpired(session.id)
      await context.close().catch(() => {})
      contextCache.delete(userId)
      return
    }

    // Check for authenticated content — the feed shows some content even when
    // logged out (public posts), so "not blank" is a false positive. We need to
    // confirm we're actually authenticated by looking for logged-in-only elements.
    const sessionValid = await feedPage.evaluate(() => {
      // These elements only exist when authenticated
      const hasGlobalNav   = !!document.querySelector('.global-nav__me, [data-test-global-nav-me]')
      const hasProfileIcon = !!document.querySelector('[data-control-name="identity_welcome_message"]')
      const hasFeedContent = !!document.querySelector('.feed-shared-update-v2, [data-urn*="urn:li:activity"]')
      const titleOk        = document.title !== 'LinkedIn | Professional Network'
      return hasGlobalNav || hasProfileIcon || hasFeedContent || titleOk
    })

    if (!sessionValid) {
      console.warn(`[worker] feed loaded but no authenticated content — session invalid for ${session.linkedin_email}`)
      await markSessionExpired(session.id)
      await context.close().catch(() => {})
      contextCache.delete(userId)
      return
    }

    await saveSession(sessionInfo, context)
  } finally {
    await feedPage.close().catch(() => {})
  }

  let actionsThisRun = 0

  for (const item of items) {
    if (actionsThisRun >= MAX_ACTIONS_PER_RUN) break

    const { error: lockErr } = await supabase
      .from('linkedin_queue')
      .update({ status: 'in_progress', attempts: item.attempts + 1 })
      .eq('id', item.id)
      .eq('status', 'queued')

    if (lockErr) {
      console.warn(`[worker] could not lock item ${item.id}:`, lockErr.message)
      continue
    }

    try {
      await processItem(item, context)

      const now = new Date().toISOString()

      await supabase
        .from('linkedin_queue')
        .update({ status: 'done', processed_at: now, error: null })
        .eq('id', item.id)

      if (item.sequence_step > 0) {
        await supabase
          .from('sequence_sends')
          .update({ status: 'sent', sent_at: now })
          .eq('lead_id', item.lead_id)
          .eq('step', item.sequence_step)
          .eq('channel', 'linkedin')
          .eq('status', 'queued')
      }

      if (item.action === 'connect') {
        await supabase
          .from('leads')
          .update({ status: 'contacted', updated_at: now })
          .eq('id', item.lead_id)
      }

      actionsThisRun++
      await saveSession(sessionInfo, context)

      if (actionsThisRun < items.length) {
        await randomDelay(ACTION_DELAY_MS[0], ACTION_DELAY_MS[1])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[worker] item ${item.id} failed:`, msg)

      if (msg.includes('SESSION_EXPIRED')) {
        await markSessionExpired(session.id)
        await context.close().catch(() => {})
        contextCache.delete(userId)
        console.warn(`[worker] session expired mid-run for ${session.linkedin_email} — stopping`)
        break
      }

      const newStatus = item.attempts + 1 >= 3 ? 'failed' : 'queued'
      await supabase
        .from('linkedin_queue')
        .update({
          status: newStatus,
          error: msg,
          processed_at: newStatus === 'failed' ? new Date().toISOString() : null,
        })
        .eq('id', item.id)
    }
  }
  // Context stays alive in cache — NOT closed here. The next poll reuses it.
}

async function poll(): Promise<void> {
  const supabase = getSupabase()

  await supabase
    .from('linkedin_queue')
    .update({ status: 'queued', updated_at: new Date().toISOString() })
    .eq('status', 'in_progress')
    .lt('updated_at', new Date(Date.now() - 10 * 60_000).toISOString())

  const { data: items, error } = await supabase
    .from('linkedin_queue')
    .select('id, lead_id, campaign_id, user_id, action, message, sequence_step, attempts, scheduled_at')
    .eq('status', 'queued')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('[worker] queue poll failed:', error.message)
    return
  }

  if (!items?.length) return

  console.log(`[worker] ${items.length} item(s) in queue`)

  const byUser = items.reduce<Record<string, QueueItem[]>>((acc, item) => {
    acc[item.user_id] = acc[item.user_id] ?? []
    acc[item.user_id].push(item as QueueItem)
    return acc
  }, {})

  for (const [userId, userItems] of Object.entries(byUser)) {
    try {
      await runForUser(userId, userItems)
    } catch (err) {
      console.error(`[worker] runForUser ${userId} threw:`, err)
    }
  }
}

async function main(): Promise<void> {
  console.log('[worker] LinkedIn worker started — build 2026-06-03-v5')
  console.log(`[worker] polling every ${POLL_INTERVAL_MS / 1000}s`)

  let isPolling = false

  async function safePoll() {
    if (isPolling) {
      console.log('[worker] previous poll still running — skipping this tick')
      return
    }
    isPolling = true
    try {
      await poll()
    } catch (err) {
      console.error('[worker] poll error:', err)
    } finally {
      isPolling = false
    }
  }

  await safePoll()
  setInterval(safePoll, POLL_INTERVAL_MS)
}

process.on('unhandledRejection', (reason) => {
  const msg = String(reason)
  if (
    msg.includes('Target page, context or browser has been closed') ||
    msg.includes('cdpSession') ||
    msg.includes('Browser has been closed')
  ) {
    return
  }
  console.error('[worker] unhandled rejection:', reason)
})

// Graceful shutdown: close all cached contexts cleanly
process.on('SIGTERM', async () => {
  console.log('[worker] SIGTERM — closing cached contexts')
  for (const [userId, cached] of contextCache.entries()) {
    await cached.context.close().catch(() => {})
    contextCache.delete(userId)
  }
  process.exit(0)
})

main().catch(err => {
  console.error('[worker] fatal error:', err)
  process.exit(1)
})

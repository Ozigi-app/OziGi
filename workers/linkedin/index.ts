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
import { sendConnectionRequest, sendLinkedInMessage, sendFollowUp, checkConnectionAccepted } from './actions'
import { loginLinkedIn } from './login'
import { searchAndSaveLeads } from './search'
import type { BrowserContext } from 'patchright'

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
          notifySessionExpired(userId, session.linkedin_email).catch(() => {})
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

const POLL_INTERVAL_MS              = 90_000
const ACTION_DELAY_MS               = [180_000, 420_000] as const  // 3–7 min — wider range looks more human
const MAX_ACTIONS_PER_RUN           = 1
const QUEUE_EMPTY_NOTIFY_COOLDOWN   = 24 * 60 * 60 * 1000  // notify at most once per 24 h per user

// Track the last time we sent a queue-empty nudge for each user.
// In-memory is fine — if the worker restarts the user gets at most one extra email.
const lastQueueEmptyNotified = new Map<string, number>()

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { transport: ws as unknown as typeof WebSocket } }
  )
}

// Node's fetch (used internally by supabase-js) has no built-in timeout — a stalled
// TCP connection can hang a query forever. The per-item status updates below are in
// the hot path: if one hangs, the item stays 'in_progress' forever and blocks every
// item behind it in the queue (only 1 action processed per user per poll). Race each
// update against a timeout so a hung fetch fails fast instead of stalling the worker.
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT: ${label} exceeded ${ms}ms`)), ms)
    ),
  ])
}

/**
 * Notify the user by email that their LinkedIn session expired and they need
 * to reconnect. Called after markSessionExpired so the user doesn't sit
 * wondering why their pipeline stopped.
 *
 * Best-effort — never throws so it never blocks the worker loop.
 */
async function notifySessionExpired(userId: string, linkedinEmail: string): Promise<void> {
  try {
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
    const secret   = process.env.WORKER_SECRET
    if (!appUrl || !secret) {
      console.warn('[worker] NEXT_PUBLIC_APP_URL or WORKER_SECRET not set — skipping session-expired notification')
      return
    }
    const res = await fetch(`${appUrl}/api/gtm/notify/session-expired`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body:    JSON.stringify({ userId, linkedinEmail }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[worker] session-expired notification failed (${res.status}):`, body)
    } else {
      console.log(`[worker] session-expired notification sent for ${linkedinEmail}`)
    }
  } catch (err) {
    console.error('[worker] session-expired notification threw:', err)
  }
}

/**
 * Notify the user that their LinkedIn outreach queue is empty and they should
 * add more leads. Rate-limited to once per 24 h per user (in-memory).
 *
 * Best-effort — never throws so it never blocks the worker loop.
 */
async function notifyQueueEmpty(userId: string, linkedinEmail: string): Promise<void> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
    const secret = process.env.WORKER_SECRET
    if (!appUrl || !secret) {
      console.warn('[worker] NEXT_PUBLIC_APP_URL or WORKER_SECRET not set — skipping queue-empty notification')
      return
    }
    const res = await fetch(`${appUrl}/api/gtm/notify/queue-empty`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body:    JSON.stringify({ userId, linkedinEmail }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[worker] queue-empty notification failed (${res.status}):`, body)
    } else {
      console.log(`[worker] queue-empty notification sent for ${linkedinEmail}`)
    }
  } catch (err) {
    console.error('[worker] queue-empty notification threw:', err)
  }
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
            await sendLinkedInMessage(context, profileId, item.message, lead.name)
            return  // success — caller marks item done and lead contacted
          }
          throw new Error('Open Profile detected — no message text configured for direct outreach')
        }
        if (msg.startsWith('ALREADY_DONE')) {
          // Connect was sent on a prior attempt (now Pending) or was accepted (1st degree).
          // Mark done so we stop retrying — no action needed.
          console.log(`[worker] connect already done for lead ${item.lead_id}: ${msg}`)
          return
        }
        throw err
      }
      break

    case 'message':
    case 'follow_up': {
      if (!profileId) throw new Error(`Cannot ${item.action}: no linkedin_profile_id and could not extract from URL`)
      // sendLinkedInMessage already:
      //   1. Visits /feed/ to prime the SPA auth state (avoids blank-page blocks)
      //   2. Navigates to the profile page
      //   3. Detects Connect-vs-Message buttons and throws NOT_YET_CONNECTED if the
      //      connection hasn't been accepted yet
      // A separate checkConnectionAccepted() pre-flight visit was causing BLANK_PAGE
      // errors for every recipient because it hit profiles directly (no feed warmup),
      // triggering LinkedIn's bot detection on the new page. Removing the pre-check
      // eliminates the extra profile visit and lets sendLinkedInMessage handle it all.
      if (item.action === 'message') {
        await sendLinkedInMessage(context, profileId, item.message ?? '', lead.name)
      } else {
        await sendFollowUp(context, profileId, item.message ?? '', lead.name)
      }
      break
    }

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
    // Give PerimeterX scripts time to run and establish session cookies.
    // On a fresh profile dir (no _px3/_pxvid on disk) this takes longer —
    // 10s covers the JS download + PerimeterX challenge on a proxied connection.
    await feedPage.waitForTimeout(10_000)

    const feedUrl = feedPage.url()
    if (feedUrl.includes('/login') || feedUrl.includes('/checkpoint') || feedUrl.includes('/authwall')) {
      console.warn(`[worker] feed redirected to ${feedUrl} — session expired for ${session.linkedin_email}`)
      await markSessionExpired(session.id)
      notifySessionExpired(userId, session.linkedin_email).catch(() => {})
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
      notifySessionExpired(userId, session.linkedin_email).catch(() => {})
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

    const { error: lockErr } = await withTimeout(
      supabase
        .from('linkedin_queue')
        .update({ status: 'in_progress', attempts: item.attempts + 1 })
        .eq('id', item.id)
        .eq('status', 'queued'),
      15_000,
      `lock item ${item.id}`
    ).catch(err => ({ error: err as Error }))

    if (lockErr) {
      console.warn(`[worker] could not lock item ${item.id}:`, lockErr.message)
      continue
    }

    try {
      await processItem(item, context)

      // processItem succeeded — the LinkedIn action (message sent, connection
      // requested, etc.) already happened. From here on we must NOT let a failure
      // bubble into the outer catch: that path can reset status back to 'queued',
      // which would retry and send the SAME message/connect a second time.
      // Retry the bookkeeping updates a few times with fresh timeouts; if they all
      // fail, log loudly and leave the item 'in_progress' rather than risk a
      // duplicate send. A stale in_progress row is recoverable manually —
      // a duplicate LinkedIn message to a lead is not.
      const now = new Date().toISOString()
      let markedDone = false
      for (let attempt = 1; attempt <= 3 && !markedDone; attempt++) {
        try {
          await withTimeout(
            supabase
              .from('linkedin_queue')
              .update({ status: 'done', processed_at: now, error: null })
              .eq('id', item.id),
            15_000,
            `mark item ${item.id} done (attempt ${attempt})`
          )
          markedDone = true
        } catch (markErr) {
          console.error(`[worker] failed to mark item ${item.id} done (attempt ${attempt}/3):`, (markErr as Error).message)
        }
      }
      if (!markedDone) {
        console.error(`[worker] item ${item.id} succeeded on LinkedIn but could not be marked done after 3 attempts — leaving in_progress for manual review`)
      }

      if (item.sequence_step > 0) {
        // Retry up to 3× — a silent .catch() here causes sequence_sends to stay
        // 'queued' forever, which blocks the cron from queuing the next step.
        let ssMarked = false
        for (let attempt = 1; attempt <= 3 && !ssMarked; attempt++) {
          try {
            await withTimeout(
              supabase
                .from('sequence_sends')
                .update({ status: 'sent', sent_at: now })
                .eq('lead_id', item.lead_id)
                .eq('step', item.sequence_step)
                .eq('channel', 'linkedin')
                .eq('status', 'queued'),
              15_000,
              `mark sequence_send for ${item.lead_id} sent (attempt ${attempt})`
            )
            ssMarked = true
          } catch (ssErr) {
            console.error(`[worker] sequence_sends update failed for ${item.id} (attempt ${attempt}/3):`, (ssErr as Error).message)
          }
        }
        if (!ssMarked) {
          console.error(`[worker] could not mark sequence_send sent for ${item.id} after 3 attempts — pipeline will stall for this lead`)
        }
      }

      if (item.action === 'connect') {
        // Retry up to 3× — a silent .catch() here leaves the lead at 'pending',
        // which blocks the message step (requires status='contacted').
        let leadMarked = false
        for (let attempt = 1; attempt <= 3 && !leadMarked; attempt++) {
          try {
            await withTimeout(
              supabase
                .from('leads')
                .update({ status: 'contacted', updated_at: now })
                .eq('id', item.lead_id),
              15_000,
              `mark lead ${item.lead_id} contacted (attempt ${attempt})`
            )
            leadMarked = true
          } catch (leadErr) {
            console.error(`[worker] lead status update failed for ${item.id} (attempt ${attempt}/3):`, (leadErr as Error).message)
          }
        }
        if (!leadMarked) {
          console.error(`[worker] could not mark lead ${item.lead_id} contacted after 3 attempts — message step will be blocked`)
        }
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
        notifySessionExpired(userId, session.linkedin_email).catch(() => {})
        await context.close().catch(() => {})
        contextCache.delete(userId)
        console.warn(`[worker] session expired mid-run for ${session.linkedin_email} — stopping`)
        break
      }

      // Connection not yet accepted — reschedule for 24h later without
      // consuming an attempt. We'll keep checking daily until accepted.
      if (msg.includes('NOT_YET_CONNECTED')) {
        const retryAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        console.log(`[worker] connection pending for item ${item.id} — rescheduling for ${retryAt}`)
        await withTimeout(
          supabase
            .from('linkedin_queue')
            .update({
              status: 'queued',
              scheduled_at: retryAt,
              attempts: item.attempts, // reset — don't count pending-check as an attempt
              error: null,
            })
            .eq('id', item.id),
          15_000,
          `reschedule item ${item.id} (NOT_YET_CONNECTED)`
        ).catch(err => console.error(`[worker] reschedule failed for ${item.id}:`, (err as Error).message))
        continue
      }

      // Auth wall — session valid but LinkedIn challenged the request.
      if (msg.includes('AUTHWALL')) {
        console.warn(`[worker] auth wall for item ${item.id} — will retry without expiring session`)
      }

      // Blank page = LinkedIn temporarily blocked this IP / rate-limited.
      // Reschedule 1 hour from now WITHOUT consuming an attempt — same as
      // NOT_YET_CONNECTED. We don't want to burn the 3-attempt limit on a
      // transient network block unrelated to the action itself.
      if (msg.includes('BLANK_PAGE')) {
        const retryAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        console.warn(`[worker] blank page for item ${item.id} — rescheduling in 1h (${retryAt})`)
        await withTimeout(
          supabase
            .from('linkedin_queue')
            .update({ status: 'queued', scheduled_at: retryAt, error: msg, attempts: item.attempts })
            .eq('id', item.id),
          15_000,
          `reschedule item ${item.id} (BLANK_PAGE)`
        ).catch(err => console.error(`[worker] reschedule failed for ${item.id}:`, (err as Error).message))
        continue
      }

      const newStatus = item.attempts + 1 >= 3 ? 'failed' : 'queued'
      await withTimeout(
        supabase
          .from('linkedin_queue')
          .update({
            status: newStatus,
            error: msg,
            processed_at: newStatus === 'failed' ? new Date().toISOString() : null,
          })
          .eq('id', item.id),
        15_000,
        `mark item ${item.id} ${newStatus}`
      ).catch(err => console.error(`[worker] status update failed for ${item.id}:`, (err as Error).message))

      // When permanently failed: mark sequence_sends as 'failed' too so the cron
      // doesn't see a stale 'queued' row and permanently block the next step.
      if (newStatus === 'failed' && item.sequence_step > 0) {
        supabase
          .from('sequence_sends')
          .update({ status: 'failed', error: msg })
          .eq('lead_id', item.lead_id)
          .eq('step', item.sequence_step)
          .eq('channel', 'linkedin')
          .eq('status', 'queued')
          .then()
          .catch(err => console.warn(`[worker] sequence_sends fail-mark failed for ${item.id}:`, (err as Error).message))
      }
    }
  }
  // Context stays alive in cache — NOT closed here. The next poll reuses it.
}

async function poll(): Promise<void> {
  const supabase = getSupabase()

  // Reset items stuck in_progress (browser crashed mid-run or watchdog fired).
  // Single worker machine — any in_progress at poll time is a crash remnant.
  // Respect the 3-attempt ceiling: items that have already used ≥3 attempts
  // get marked failed instead of retried, preventing infinite retry loops.
  await supabase
    .from('linkedin_queue')
    .update({ status: 'queued' })
    .eq('status', 'in_progress')
    .lt('attempts', 3)

  await supabase
    .from('linkedin_queue')
    .update({
      status: 'failed',
      error: 'WATCHDOG: item stuck in_progress after max attempts — forced fail',
      processed_at: new Date().toISOString(),
    })
    .eq('status', 'in_progress')
    .gte('attempts', 3)

  // Also fail queued items that have ≥3 attempts — these were reset to queued by the
  // WATCHDOG (which doesn't update attempts), so they'd loop forever if not caught here.
  await supabase
    .from('linkedin_queue')
    .update({
      status: 'failed',
      error: 'Exceeded max attempts — forced fail on next poll',
      processed_at: new Date().toISOString(),
    })
    .eq('status', 'queued')
    .gte('attempts', 3)

  const { data: items, error } = await supabase
    .from('linkedin_queue')
    .select('id, lead_id, campaign_id, user_id, action, message, sequence_step, attempts, scheduled_at')
    .eq('status', 'queued')
    .lte('scheduled_at', new Date().toISOString())
    .lt('attempts', 3)  // defense in depth: never pick up items already at max attempts
    .order('scheduled_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('[worker] queue poll failed:', error.message)
    return
  }

  if (!items?.length) {
    // Queue is globally empty. Only nudge users who have genuinely run out of
    // leads — not users whose queue will simply refill at tomorrow's 9am cron.
    // Check: any leads in 'pending' or 'contacted' state with a linkedin_url
    // means the cron will re-queue them tomorrow, so no email needed.
    const { data: activeSessions } = await supabase
      .from('linkedin_sessions')
      .select('user_id, linkedin_email')
      .eq('status', 'active')

    for (const s of activeSessions ?? []) {
      const lastNotified = lastQueueEmptyNotified.get(s.user_id) ?? 0
      if (Date.now() - lastNotified <= QUEUE_EMPTY_NOTIFY_COOLDOWN) continue

      // Check if there are leads still in the pipeline for this user
      const { data: userCampaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('user_id', s.user_id)
        .eq('status', 'active')
      const campaignIds = (userCampaigns ?? []).map((c: { id: string }) => c.id)

      const { count: remainingLeads } = campaignIds.length ? await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .in('campaign_id', campaignIds)
        .in('status', ['pending', 'contacted'])
        .not('linkedin_url', 'is', null) : { count: 0 }

      if (remainingLeads && remainingLeads > 0) {
        // Leads exist — queue will refill at 9am. Don't spam.
        console.log(`[worker] queue empty for ${s.linkedin_email} but ${remainingLeads} leads remain — skipping nudge`)
        continue
      }

      lastQueueEmptyNotified.set(s.user_id, Date.now())
      console.log(`[worker] queue empty for ${s.linkedin_email} and no leads remain — sending nudge email`)
      notifyQueueEmpty(s.user_id, s.linkedin_email).catch(() => {})
    }
    return
  }

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
  console.log('[worker] LinkedIn worker started — build 2026-06-30-v78')
  console.log(`[worker] polling every ${POLL_INTERVAL_MS / 1000}s`)

  let isPolling    = false
  let pollStartedAt = 0
  const POLL_WATCHDOG_MS = 8 * 60 * 1000  // 8 minutes — kill if Chrome hangs

  async function safePoll() {
    if (isPolling) {
      const elapsed = Date.now() - pollStartedAt
      if (elapsed > POLL_WATCHDOG_MS) {
        console.error(`[worker] WATCHDOG: poll stuck for ${Math.round(elapsed / 1000)}s — forcing restart`)
        // Schedule unconditional exit in 5 s — this fires even if the Supabase
        // update below hangs (fetch has no built-in timeout on Node.js).
        setTimeout(() => process.exit(1), 5_000).unref()
        try {
          const supabase = getSupabase()
          await Promise.race([
            supabase
              .from('linkedin_queue')
              .update({
                status: 'queued',
                error: `WATCHDOG: worker stuck for ${Math.round(elapsed / 1000)}s — browser likely hung`,
              })
              .eq('status', 'in_progress'),
            new Promise<void>(resolve => setTimeout(resolve, 4_000)),
          ])
        } catch { /* best-effort */ }
        process.exit(1)
      }
      console.log('[worker] previous poll still running — skipping this tick')
      return
    }
    isPolling     = true
    pollStartedAt = Date.now()
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

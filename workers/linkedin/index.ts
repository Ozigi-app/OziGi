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

// Load .env.local from repo root when running locally
config({ path: path.resolve(__dirname, '../../.env.local') })

import http from 'http'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadSession, saveSession, markSessionExpired, isLoggedIn } from './browser'
import { sendConnectionRequest, sendLinkedInMessage, sendFollowUp } from './actions'
import { loginLinkedIn } from './login'
import { searchAndSaveLeads } from './search'
import type { BrowserContext, Browser } from 'playwright'

// HTTP server — health checks + /login endpoint
const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'linkedin-worker' }))
    return
  }

  // POST /search — triggered by the scrape cron to find LinkedIn leads by ICP
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

    // Acknowledge immediately — search runs async
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
      let browser: Browser | null = null
      let context: BrowserContext | null = null

      try {
        const loaded = await loadSession(sessionInfo)
        browser = loaded.browser; context = loaded.context

        if (!await isLoggedIn(context)) {
          await markSessionExpired(session.id)
          console.warn(`[worker:search] session expired for ${session.linkedin_email}`); return
        }

        const saved = await searchAndSaveLeads(context, supabase, userId, campaignId, icpConfig, limit ?? 25)
        console.log(`[worker:search] done — ${saved} leads saved for campaign ${campaignId}`)
        await saveSession(sessionInfo, context)
      } catch (err) {
        console.error('[worker:search] error:', err)
      } finally {
        if (context) await context.close().catch(() => {})
        if (browser)  await browser.close().catch(() => {})
      }
    })().catch(err => console.error('[worker:search] unhandled:', err))
    return
  }

  // POST /login — triggered by Ozigi when user connects their LinkedIn account
  if (req.method === 'POST' && req.url === '/login') {
    // Verify internal secret
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

    // Acknowledge immediately — login runs async (may wait for 2FA)
    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, message: 'Login started' }))

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

const POLL_INTERVAL_MS = 30_000       // check queue every 30s
const ACTION_DELAY_MS  = [45_000, 90_000] as const  // wait 45–90s between actions (human pacing)
const MAX_ACTIONS_PER_RUN = 5         // max actions per poll cycle per user

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { transport: ws } }
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

/** Extract the profile slug from a LinkedIn URL (e.g. /in/john-doe → "john-doe") */
function extractProfileId(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/)
  return m ? m[1] : null
}

async function processItem(
  item: QueueItem,
  context: BrowserContext
): Promise<void> {
  const supabase = getSupabase()

  // Fetch the lead to get LinkedIn identifiers
  const { data: lead } = await supabase
    .from('leads')
    .select('linkedin_url, linkedin_profile_id, name')
    .eq('id', item.lead_id)
    .single() as { data: Lead | null }

  if (!lead?.linkedin_url && !lead?.linkedin_profile_id) {
    throw new Error('Lead has no LinkedIn URL or profile ID')
  }

  // Resolve profile ID — stored explicitly or extract from the URL slug
  const profileId = lead.linkedin_profile_id
    ?? (lead.linkedin_url ? extractProfileId(lead.linkedin_url) : null)

  console.log(`[worker] executing ${item.action} for lead ${item.lead_id}`)

  switch (item.action) {
    case 'connect':
      await sendConnectionRequest(
        context,
        lead.linkedin_url!,
        item.message ?? undefined
      )
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

  // Get the user's LinkedIn session
  const { data: session } = await supabase
    .from('linkedin_sessions')
    .select('id, linkedin_email, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_used_at', { ascending: false })
    .limit(1)
    .single()

  if (!session) {
    console.warn(`[worker] no active LinkedIn session for user ${userId} — skipping`)
    return
  }

  const sessionInfo = { sessionId: session.id, userId, linkedinEmail: session.linkedin_email }

  let browser: Browser | null = null
  let context: BrowserContext | null = null

  try {
    const loaded = await loadSession(sessionInfo)
    browser = loaded.browser
    context = loaded.context

    // Verify the session is still valid
    const loggedIn = await isLoggedIn(context)
    if (!loggedIn) {
      console.warn(`[worker] session expired for ${session.linkedin_email}`)
      await markSessionExpired(session.id)
      return
    }

    let actionsThisRun = 0

    for (const item of items) {
      if (actionsThisRun >= MAX_ACTIONS_PER_RUN) break

      // Lock the item
      const { error: lockErr } = await supabase
        .from('linkedin_queue')
        .update({ status: 'in_progress', attempts: item.attempts + 1 })
        .eq('id', item.id)
        .eq('status', 'queued')  // only lock if still queued (prevent double-processing)

      if (lockErr) {
        console.warn(`[worker] could not lock item ${item.id}:`, lockErr.message)
        continue
      }

      try {
        await processItem(item, context)

        const now = new Date().toISOString()

        await supabase
          .from('linkedin_queue')
          .update({ status: 'done', processed_at: now })
          .eq('id', item.id)

        // Mark the corresponding sequence_send as sent
        if (item.sequence_step > 0) {
          await supabase
            .from('sequence_sends')
            .update({ status: 'sent', sent_at: now })
            .eq('lead_id', item.lead_id)
            .eq('step', item.sequence_step)
            .eq('channel', 'linkedin')
            .eq('status', 'queued')
        }

        // Update lead status if it was a connect action
        if (item.action === 'connect') {
          await supabase
            .from('leads')
            .update({ status: 'contacted', updated_at: now })
            .eq('id', item.lead_id)
        }

        actionsThisRun++
        await saveSession(sessionInfo, context)

        // Human-like pause between actions
        if (actionsThisRun < items.length) {
          await randomDelay(ACTION_DELAY_MS[0], ACTION_DELAY_MS[1])
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[worker] item ${item.id} failed:`, msg)

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
  } finally {
    if (context) await context.close().catch(() => {})
    if (browser) await browser.close().catch(() => {})
  }
}

async function poll(): Promise<void> {
  const supabase = getSupabase()

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

  // Group by user so each user gets their own browser session
  const byUser = items.reduce<Record<string, QueueItem[]>>((acc, item) => {
    acc[item.user_id] = acc[item.user_id] ?? []
    acc[item.user_id].push(item as QueueItem)
    return acc
  }, {})

  // Process users sequentially (not in parallel — LinkedIn bot detection)
  for (const [userId, userItems] of Object.entries(byUser)) {
    try {
      await runForUser(userId, userItems)
    } catch (err) {
      console.error(`[worker] runForUser ${userId} threw:`, err)
    }
  }
}

async function main(): Promise<void> {
  console.log('[worker] LinkedIn worker started')
  console.log(`[worker] polling every ${POLL_INTERVAL_MS / 1000}s`)

  // Run immediately on start, then on interval
  await poll()

  setInterval(async () => {
    try {
      await poll()
    } catch (err) {
      console.error('[worker] poll error:', err)
    }
  }, POLL_INTERVAL_MS)
}

main().catch(err => {
  console.error('[worker] fatal error:', err)
  process.exit(1)
})

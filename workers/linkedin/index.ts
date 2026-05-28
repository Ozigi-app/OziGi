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
import http from 'http'
import { createClient } from '@supabase/supabase-js'
import { loadSession, saveSession, markSessionExpired, isLoggedIn } from './browser'
import { sendConnectionRequest, sendLinkedInMessage, sendFollowUp } from './actions'
import type { BrowserContext, Browser } from 'playwright'

// Minimal HTTP server so Fly.io health checks pass
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true, service: 'linkedin-worker' }))
}).listen(process.env.PORT ?? 8080, () => {
  console.log(`[worker] health endpoint listening on port ${process.env.PORT ?? 8080}`)
})

const POLL_INTERVAL_MS = 30_000       // check queue every 30s
const ACTION_DELAY_MS  = [45_000, 90_000] as const  // wait 45–90s between actions (human pacing)
const MAX_ACTIONS_PER_RUN = 5         // max actions per poll cycle per user

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
  attempts: number
  scheduled_at: string
}

interface Lead {
  linkedin_url: string | null
  linkedin_profile_id: string | null
  name: string | null
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
      if (!lead.linkedin_profile_id) throw new Error('No linkedin_profile_id for message action')
      await sendLinkedInMessage(context, lead.linkedin_profile_id, item.message ?? '')
      break

    case 'follow_up':
      if (!lead.linkedin_profile_id) throw new Error('No linkedin_profile_id for follow_up action')
      await sendFollowUp(context, lead.linkedin_profile_id, item.message ?? '')
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

        await supabase
          .from('linkedin_queue')
          .update({ status: 'done', processed_at: new Date().toISOString() })
          .eq('id', item.id)

        // Update lead status if it was a connect action
        if (item.action === 'connect') {
          await supabase
            .from('leads')
            .update({ status: 'contacted', updated_at: new Date().toISOString() })
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
    .select('id, lead_id, campaign_id, user_id, action, message, attempts, scheduled_at')
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

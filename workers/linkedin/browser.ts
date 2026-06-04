import path from 'path'
import fs from 'fs'
import { chromium, type BrowserContext, type Cookie } from 'patchright'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import crypto from 'crypto'
import { getProxyConfig } from './proxy'

const ALGORITHM = 'aes-256-gcm'

// One persistent Chrome profile directory per LinkedIn account.
// Keeping state on disk means LinkedIn sees a consistent device fingerprint,
// PerimeterX cookies (_px3, _pxvid), and APFC-seeded data across action runs.
// Commercial tools (Expandi, Dripify, HeyReach) all use this pattern.
const PROFILES_DIR = process.env.BROWSER_PROFILES_DIR ?? process.env.LINKEDIN_PROFILES_DIR ?? '/tmp/linkedin-profiles'

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function getKey(): Buffer {
  const hex = process.env.GTM_ENCRYPTION_KEY!
  if (!hex || hex.length !== 64) throw new Error('GTM_ENCRYPTION_KEY missing or invalid')
  return Buffer.from(hex, 'hex')
}

function decrypt(encoded: string): string {
  const [ivHex, tagHex, dataHex] = encoded.split(':')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') + decipher.final('utf8')
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

// Parse the session_cookies field — handles both formats:
//   Legacy: Cookie[]  (plain array, before UA capture was added)
//   Current: { cookies: Cookie[], userAgent?: string }
function parseSessionBlob(decrypted: string): { cookies: Cookie[]; userAgent?: string } {
  const parsed = JSON.parse(decrypted)
  if (Array.isArray(parsed)) return { cookies: parsed }
  return { cookies: parsed.cookies ?? [], userAgent: parsed.userAgent }
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { transport: ws as unknown as typeof WebSocket } }
  )
}

export interface SessionInfo {
  sessionId: string
  userId: string
  linkedinEmail: string
}

// Launch (or resume) a persistent Playwright context for this LinkedIn account.
//
// WHY persistent context instead of launch()+newContext()+cookie injection:
// LinkedIn's APFC fingerprint system collects ~48 device signals on every page
// load (CPU cores, RAM, audio hardware, PerimeterX cookies, etc.) and binds them
// to the session server-side. Injecting li_at into a fresh context produces a
// fingerprint mismatch → session killed after 2-3 page loads. A persistent
// context preserves all browser state (cookies, localStorage, IndexedDB,
// PerimeterX _px3/_pxvid state) across runs so LinkedIn sees the same "device".
//
// For multi-tenant SaaS: we also capture the user's actual browser User-Agent at
// cookie submission time and replay it here. This ensures bcookie (LinkedIn's
// browser identifier) remains consistent with the UA LinkedIn recorded for it.
export async function loadSession(session: SessionInfo): Promise<{ context: BrowserContext }> {
  const proxy = await getProxyConfig(session.userId)
  const userDataDir = path.join(PROFILES_DIR, session.userId)
  fs.mkdirSync(userDataDir, { recursive: true })

  // Read DB first so we can launch the context with the user's original UA.
  // bcookie is bound to a specific browser User-Agent — using the wrong UA is a
  // fingerprint mismatch signal even when the cookies themselves are valid.
  const supabase = getSupabase()
  const { data } = await supabase
    .from('linkedin_sessions')
    .select('session_cookies, status')
    .eq('id', session.sessionId)
    .single()

  let dbCookies: Cookie[] = []
  let storedUserAgent: string | undefined

  if (data?.session_cookies && data.status === 'active') {
    try {
      const parsed = parseSessionBlob(decrypt(data.session_cookies))
      dbCookies = parsed.cookies
      storedUserAgent = parsed.userAgent
    } catch (e) {
      console.error('[browser] failed to parse session blob:', e)
    }
  }

  const effectiveUA = storedUserAgent ?? DEFAULT_UA
  if (storedUserAgent) {
    console.log(`[browser] using stored UA for ${session.linkedinEmail}: ${storedUserAgent.slice(0, 60)}…`)
  }

  // Try real Chrome first (better JA3/JA4 TLS fingerprint than Playwright's Chromium).
  // Falls back to Playwright's bundled Chromium if Chrome isn't installed.
  const chromeExecutable = process.env.CHROME_EXECUTABLE_PATH ??
    ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
      .find(p => { try { fs.accessSync(p); return true } catch { return false } })

  if (chromeExecutable) {
    console.log(`[browser] using Chrome at ${chromeExecutable}`)
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    ...(chromeExecutable ? { executablePath: chromeExecutable } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1280,800',
      ...(proxy ? [`--proxy-server=${proxy.server}`] : []),
      // Bypass the residential proxy for Chrome's own background services
      // (update checks, push messaging, autofill). Only LinkedIn traffic
      // should go through IPRoyal.
      '--proxy-bypass-list=*.google.com,*.googleapis.com,*.gstatic.com,*.googleusercontent.com',
    ],
    // Prevent Playwright from injecting --enable-automation which LinkedIn detects
    ignoreDefaultArgs: ['--enable-automation'],
    userAgent: effectiveUA,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  })

  // Only seed from DB when the profile is fresh (no li_at on disk).
  // If li_at is already present the profile was established from a real login or
  // a prior run — don't overwrite it with the DB snapshot which would diverge
  // the fingerprint LinkedIn has recorded for this "device".
  const existingCookies = await context.cookies('https://www.linkedin.com')
  const hasLiAt = existingCookies.some(c => c.name === 'li_at')

  if (!hasLiAt) {
    if (dbCookies.length > 0) {
      console.log(`[browser] fresh profile for ${session.linkedinEmail} — seeding ${dbCookies.length} cookies from DB`)
      await context.addCookies(dbCookies)
    } else {
      console.warn(`[browser] fresh profile for ${session.linkedinEmail} but no cookies in DB`)
    }
  } else {
    console.log(`[browser] ${session.linkedinEmail} — profile already has session, skipping DB seed`)
  }

  return { context }
}

// Back up current browser cookies to Supabase, preserving the original User-Agent.
// If the container restarts and the profile dir is lost, the next loadSession
// will re-seed from this snapshot (with the correct UA) to bootstrap the new profile.
export async function saveSession(session: SessionInfo, context: BrowserContext): Promise<void> {
  const supabase = getSupabase()

  // Read existing blob to preserve the stored User-Agent — don't overwrite it
  // with the worker's own UA from the current Playwright context.
  let storedUserAgent: string | undefined
  const { data: existing } = await supabase
    .from('linkedin_sessions')
    .select('session_cookies')
    .eq('id', session.sessionId)
    .single()

  if (existing?.session_cookies) {
    try {
      storedUserAgent = parseSessionBlob(decrypt(existing.session_cookies)).userAgent
    } catch { /* non-fatal — UA just won't be preserved */ }
  }

  const cookies = await context.cookies()
  const sessionData = { cookies, userAgent: storedUserAgent }
  const encrypted = encrypt(JSON.stringify(sessionData))

  await supabase
    .from('linkedin_sessions')
    .update({
      session_cookies: encrypted,
      status: 'active',
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.sessionId)
}

export async function markSessionExpired(sessionId: string): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('linkedin_sessions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
}

export async function isLoggedIn(context: BrowserContext): Promise<boolean> {
  const cookies = await context.cookies('https://www.linkedin.com')
  const liAt = cookies.find(c => c.name === 'li_at')
  if (!liAt) {
    console.warn('[browser] li_at cookie missing — session invalid')
    return false
  }
  if (liAt.expires > 0 && liAt.expires < Date.now() / 1000) {
    console.warn('[browser] li_at cookie expired')
    return false
  }
  return true
}

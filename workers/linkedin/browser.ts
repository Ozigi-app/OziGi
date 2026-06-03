import { chromium as baseChromium, type Browser, type BrowserContext, type Cookie } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import crypto from 'crypto'
import { chromium as stealthChromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { getProxyConfig } from './proxy'

stealthChromium.use(StealthPlugin())
const chromium = stealthChromium as unknown as typeof baseChromium

const ALGORITHM = 'aes-256-gcm'

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

// Load a Playwright browser context seeded with the user's saved LinkedIn cookies.
// The browser is launched through a per-user sticky residential proxy so LinkedIn
// always sees a consistent residential IP for this account.
export async function loadSession(session: SessionInfo): Promise<{ browser: Browser; context: BrowserContext }> {
  const proxy = await getProxyConfig(session.userId)

  const browser = await chromium.launch({
    headless: false,   // Always headed — Xvfb provides the virtual display in production
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1280,800',
      // Pass proxy directly as a Chromium flag — bypasses playwright-extra's
      // launch interception which can silently drop the proxy config object.
      ...(proxy ? [`--proxy-server=${proxy.server}`] : []),
    ],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] })
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
    // @ts-ignore
    window.chrome = { runtime: {} }
  })

  // Seed cookies from Supabase — primary source of truth when the profile dir
  // is missing or was wiped (container restart without a mounted volume).
  const supabase = getSupabase()
  const { data } = await supabase
    .from('linkedin_sessions')
    .select('session_cookies, status')
    .eq('id', session.sessionId)
    .single()

  if (data?.session_cookies && data.status === 'active') {
    try {
      const cookies: Cookie[] = JSON.parse(decrypt(data.session_cookies))
      await context.addCookies(cookies)
    } catch (e) {
      console.error('[browser] Failed to load cookies:', e)
    }
  }

  return { browser, context }
}

// Persist the current browser cookies back to Supabase
export async function saveSession(session: SessionInfo, context: BrowserContext): Promise<void> {
  const cookies = await context.cookies()
  const encrypted = encrypt(JSON.stringify(cookies))
  const supabase = getSupabase()

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

// Mark session as expired so the user knows to log in again
export async function markSessionExpired(sessionId: string): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('linkedin_sessions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
}

// Check if the session has a valid LinkedIn session cookie — no network request needed.
// The li_at cookie is LinkedIn's primary session token. If it exists and isn't expired
// we treat the session as valid. Actions will naturally fail + re-trigger login if
// LinkedIn has invalidated it server-side.
export async function isLoggedIn(context: BrowserContext): Promise<boolean> {
  const cookies = await context.cookies('https://www.linkedin.com')
  const liAt = cookies.find(c => c.name === 'li_at')
  if (!liAt) {
    console.warn('[browser] li_at cookie missing — session invalid')
    return false
  }
  // expires is -1 for session cookies (no expiry) or a Unix timestamp
  if (liAt.expires > 0 && liAt.expires < Date.now() / 1000) {
    console.warn('[browser] li_at cookie expired')
    return false
  }
  return true
}

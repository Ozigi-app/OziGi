import { chromium, type Browser, type BrowserContext, type Cookie } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import crypto from 'crypto'

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

// Load a Playwright browser context seeded with the user's saved LinkedIn cookies
export async function loadSession(session: SessionInfo): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless: process.env.NODE_ENV === 'production',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  })

  // Load saved cookies if available
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

// Check if LinkedIn is showing a login wall (session expired or banned)
export async function isLoggedIn(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage()
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15_000 })
    const url = page.url()
    return !url.includes('/login') && !url.includes('/checkpoint')
  } catch {
    return false
  } finally {
    await page.close()
  }
}

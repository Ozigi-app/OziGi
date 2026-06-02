/**
 * Headless LinkedIn login with 2FA support.
 * Handles both verification-code 2FA and push-notification (app-approval) 2FA.
 *
 * Flow:
 *   1. Fetch encrypted credentials from linkedin_credentials
 *   2. Upsert a linkedin_sessions row with status='logging_in'
 *   3. Open browser, fill email+password, submit
 *   4. If LinkedIn shows a checkpoint page:
 *        a. Try to click "Use a verification code" to switch away from push flow
 *        b. Set status='pending_2fa' so the UI shows the entry card
 *        c. Race two concurrent signals for up to 5 min:
 *             – User enters a code in the Settings UI  → enter it in the browser
 *             – Browser URL changes by itself (app push approval) → continue
 *   5. On success: encrypt cookies, set status='active'
 *   6. On failure: set status='needs_login' with login_error
 */
import { type Page } from 'playwright'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import crypto from 'crypto'

const ALGORITHM       = 'aes-256-gcm'
const POLL_INTERVAL_MS = 3_000   // check every 3 s (both DB and browser)
const POLL_TIMEOUT_MS  = 300_000 // wait up to 5 minutes

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
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':')
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { transport: ws } }
  )
}

async function setSessionStatus(
  sessionId: string,
  status: string,
  extra: Record<string, string | null> = {}
) {
  const { error } = await getSupabase()
    .from('linkedin_sessions')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', sessionId)
  if (error) console.error(`[login] setSessionStatus(${status}) failed:`, error.message)
}

function isCheckpointUrl(url: string): boolean {
  return url.includes('/checkpoint') || url.includes('/challenge') || url.includes('/verify')
}

/**
 * Race two signals simultaneously for up to POLL_TIMEOUT_MS:
 *   'code'     – user submitted a code via the Settings UI (written to DB)
 *   'approved' – LinkedIn push notification was approved (browser URL changed)
 *   null       – timeout
 */
async function waitFor2FA(sessionId: string, page: Page): Promise<'code' | 'approved' | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    // Signal 1 — browser navigated away from checkpoint (push approval)
    const currentUrl = page.url()
    if (!isCheckpointUrl(currentUrl)) {
      console.log(`[login] browser advanced past checkpoint → ${currentUrl}`)
      return 'approved'
    }

    // Signal 2 — user entered code in Settings UI
    const { data } = await getSupabase()
      .from('linkedin_sessions')
      .select('verification_code')
      .eq('id', sessionId)
      .single()

    if (data?.verification_code) {
      console.log('[login] verification code received from Settings UI')
      return 'code'
    }
  }

  return null
}

export async function loginLinkedIn(userId: string): Promise<void> {
  const supabase = getSupabase()

  // ── 1. Fetch credentials ──────────────────────────────────────────────────
  const { data: creds, error: credsErr } = await supabase
    .from('linkedin_credentials')
    .select('id, linkedin_email, linkedin_password_enc')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!creds) {
    throw new Error(`No LinkedIn credentials found for user: ${credsErr?.message ?? 'unknown'}`)
  }

  const email    = creds.linkedin_email
  const password = decrypt(creds.linkedin_password_enc)

  // ── 2. Upsert session row ─────────────────────────────────────────────────
  const { data: upserted, error: upsertErr } = await supabase
    .from('linkedin_sessions')
    .upsert(
      {
        user_id: userId,
        linkedin_email: email,
        status: 'logging_in',
        login_error: null,
        verification_code: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,linkedin_email' }
    )
    .select('id')
    .single()

  let sessionId: string

  if (upserted?.id) {
    sessionId = upserted.id
  } else {
    if (upsertErr && !upsertErr.message.includes('conflict')) {
      throw new Error(`Failed to upsert session: ${upsertErr.message}`)
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('linkedin_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('linkedin_email', email)
      .single()

    if (!existing?.id) {
      throw new Error(`Could not create or find session row: ${upsertErr?.message ?? fetchErr?.message ?? 'unknown'}`)
    }

    sessionId = existing.id
    await supabase
      .from('linkedin_sessions')
      .update({ status: 'logging_in', login_error: null, verification_code: null, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  }

  console.log(`[login] session ${sessionId} — starting login for ${email}`)

  // ── 3. Launch browser ─────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production'
  if (!isProduction) {
    console.log('[login] DEV MODE — browser window will open. Do NOT interact with it.')
    console.log('[login] If LinkedIn asks for a code, enter it in the Settings UI.')
    console.log('[login] If LinkedIn shows "Check your app", approve it on your phone.')
  }

  const browser = await chromium.launch({
    headless: isProduction,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    slowMo: isProduction ? 0 : 50,
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })

  const page = await context.newPage()

  try {
    // Navigate to login page
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 40_000 })
    await page.waitForTimeout(2000 + Math.random() * 1000)

    // Fill email
    const usernameSelector = await Promise.race([
      page.waitForSelector('#username',                      { timeout: 15_000 }).then(() => '#username'),
      page.waitForSelector('input[name="session_key"]',      { timeout: 15_000 }).then(() => 'input[name="session_key"]'),
      page.waitForSelector('input[autocomplete="username"]', { timeout: 15_000 }).then(() => 'input[autocomplete="username"]'),
    ])
    await page.fill(usernameSelector, email)
    await page.waitForTimeout(500 + Math.random() * 500)

    // Fill password
    const passwordSelector = await Promise.race([
      page.waitForSelector('#password',                         { timeout: 5_000 }).then(() => '#password'),
      page.waitForSelector('input[name="session_password"]',    { timeout: 5_000 }).then(() => 'input[name="session_password"]'),
    ])
    await page.fill(passwordSelector, password)
    await page.waitForTimeout(500 + Math.random() * 800)

    await page.click('[type="submit"]')
    await page.waitForTimeout(3000)

    const postLoginUrl = page.url()

    // ── 4. Handle 2FA / checkpoint ────────────────────────────────────────────
    if (isCheckpointUrl(postLoginUrl)) {
      console.log(`[login] checkpoint detected for ${email}: ${postLoginUrl}`)

      // Determine whether this is a push-notification or code-based challenge
      const pageText = await page.innerText('body').catch(() => '')
      const isPushNotification =
        pageText.includes('Check your LinkedIn app') ||
        pageText.includes('We sent a notification') ||
        pageText.includes('sent a push notification') ||
        pageText.includes('Open your LinkedIn app')

      if (isPushNotification) {
        console.log('[login] push notification 2FA detected — user must approve on their LinkedIn app')
      }

      // Try to switch away from push/device approval to a code if possible
      const codeAlternatives = [
        'text:Use a verification code',
        'text:Get a verification code',
        'text:Send a code',
        'text:use a one-time code',
        'a:has-text("verification code")',
        'button:has-text("verification code")',
        '[data-litms-control-urn*="code"]',
      ]
      let switchedToCode = false
      for (const sel of codeAlternatives) {
        try {
          const el = page.locator(sel).first()
          if (await el.isVisible({ timeout: 2_000 })) {
            console.log(`[login] switching to code-based 2FA via: ${sel}`)
            await el.click()
            await page.waitForTimeout(2000)
            switchedToCode = true
            break
          }
        } catch { continue }
      }

      // Tell the UI to show the 2FA card (covers both code and push flows)
      await setSessionStatus(sessionId, 'pending_2fa', {
        verification_code: null,
        // Include a hint so the UI can show the right instruction
        login_error: isPushNotification && !switchedToCode
          ? '__push_notification__'
          : null,
      })

      // Race: DB code (user typed in Settings UI) vs browser URL change (push approved)
      const result = await waitFor2FA(sessionId, page)

      if (result === null) {
        await setSessionStatus(sessionId, 'needs_login', {
          login_error: 'Timed out waiting for 2FA (5 min). Please try connecting again.',
        })
        return
      }

      if (result === 'code') {
        // Fetch the code and enter it in the browser
        const { data: row } = await supabase
          .from('linkedin_sessions')
          .select('verification_code')
          .eq('id', sessionId)
          .single()

        const code = row?.verification_code
        if (code) {
          const codeInput = page.locator(
            'input[name="pin"], input[id="input__email_verification_pin"], input[autocomplete="one-time-code"], input[type="text"]'
          ).first()
          await codeInput.fill(code)
          await page.waitForTimeout(500)
          await page.locator('button[type="submit"], button:has-text("Verify"), button:has-text("Submit")').first().click()
          await page.waitForTimeout(3000)
        }

        // Clear the code from DB
        await supabase
          .from('linkedin_sessions')
          .update({ verification_code: null })
          .eq('id', sessionId)
      }
      // If result === 'approved', browser already navigated — nothing to do
    }

    // ── 5. Verify we're logged in ─────────────────────────────────────────────
    const finalUrl = page.url()
    console.log(`[login] final URL: ${finalUrl}`)

    if (finalUrl.includes('/login') || isCheckpointUrl(finalUrl)) {
      throw new Error('Login failed — wrong credentials or LinkedIn blocked the attempt')
    }

    // ── 6. Save cookies + mark active ────────────────────────────────────────
    const cookies   = await context.cookies()
    const encrypted = encrypt(JSON.stringify(cookies))

    await setSessionStatus(sessionId, 'active', {
      login_error: null,
      verification_code: null,
    })

    await supabase
      .from('linkedin_sessions')
      .update({ session_cookies: encrypted, last_used_at: new Date().toISOString() })
      .eq('id', sessionId)

    console.log(`[login] ✓ logged in successfully as ${email}`)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[login] ✗ failed for ${email}:`, msg)
    await setSessionStatus(sessionId, 'needs_login', { login_error: msg })
    throw err
  } finally {
    await context.close()
    await browser.close()
  }
}

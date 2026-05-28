/**
 * Headless LinkedIn login with 2FA support.
 * Called by the /login HTTP endpoint when a user connects their account.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const POLL_INTERVAL_MS = 5_000   // check for 2FA code every 5s
const POLL_TIMEOUT_MS  = 300_000 // wait up to 5 minutes for user to enter code

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
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function setSessionStatus(
  sessionId: string,
  status: string,
  extra: Record<string, string | null> = {}
) {
  await getSupabase()
    .from('linkedin_sessions')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', sessionId)
}

// Poll DB until user writes a verification_code, or timeout
async function waitForVerificationCode(sessionId: string): Promise<string | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    const { data } = await getSupabase()
      .from('linkedin_sessions')
      .select('verification_code')
      .eq('id', sessionId)
      .single()
    if (data?.verification_code) return data.verification_code
  }
  return null
}

export async function loginLinkedIn(userId: string): Promise<void> {
  const supabase = getSupabase()

  // Fetch credentials
  const { data: creds } = await supabase
    .from('linkedin_credentials')
    .select('id, linkedin_email, linkedin_password_enc')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!creds) throw new Error('No LinkedIn credentials found for user')

  const email = creds.linkedin_email
  const password = decrypt(creds.linkedin_password_enc)

  // Upsert a session row so we can track status
  const { data: upserted, error: upsertErr } = await supabase
    .from('linkedin_sessions')
    .upsert(
      {
        user_id: userId,
        linkedin_email: email,
        status: 'logging_in',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,linkedin_email' }
    )
    .select('id')
    .single()

  // Fallback: if upsert didn't return data (conflict row not returned by some
  // Supabase versions), fetch the existing row directly
  let sessionId: string
  if (upserted?.id) {
    sessionId = upserted.id
  } else {
    const { data: existing, error: fetchErr } = await supabase
      .from('linkedin_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('linkedin_email', email)
      .single()

    if (!existing?.id) {
      throw new Error(`Failed to create session row: ${upsertErr?.message ?? fetchErr?.message ?? 'unknown'}`)
    }

    sessionId = existing.id
    // Make sure status is set to logging_in on the existing row
    await supabase
      .from('linkedin_sessions')
      .update({ status: 'logging_in', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })

  const page = await context.newPage()

  try {
    // Navigate to login
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await page.waitForTimeout(1000 + Math.random() * 1000)

    // Enter credentials
    await page.fill('#username', email)
    await page.waitForTimeout(500 + Math.random() * 500)
    await page.fill('#password', password)
    await page.waitForTimeout(500 + Math.random() * 800)
    await page.click('[type="submit"]')

    await page.waitForTimeout(3000)

    const url = page.url()

    // ── 2FA / verification challenge ────────────────────────────────────────
    if (url.includes('/checkpoint') || url.includes('/challenge') || url.includes('/verify')) {
      console.log(`[login] 2FA required for ${email}`)

      await setSessionStatus(sessionId, 'pending_2fa', {
        verification_code: null,
        login_error: null,
      })

      // Wait for user to enter the code in the UI
      const code = await waitForVerificationCode(sessionId)

      if (!code) {
        await setSessionStatus(sessionId, 'needs_login', {
          login_error: 'Timed out waiting for verification code. Please try connecting again.',
        })
        return
      }

      // Try entering the code — LinkedIn uses different input selectors
      const codeInput = page.locator(
        'input[name="pin"], input[id="input__email_verification_pin"], input[autocomplete="one-time-code"], input[type="text"]'
      ).first()

      await codeInput.fill(code)
      await page.waitForTimeout(500)

      const submitBtn = page.locator('button[type="submit"], button:has-text("Verify"), button:has-text("Submit")').first()
      await submitBtn.click()
      await page.waitForTimeout(3000)

      // Clear the code from DB now that it's been used
      await supabase
        .from('linkedin_sessions')
        .update({ verification_code: null })
        .eq('id', sessionId)
    }

    // ── Check final login state ──────────────────────────────────────────────
    const finalUrl = page.url()

    if (finalUrl.includes('/login') || finalUrl.includes('/checkpoint')) {
      throw new Error('Login failed — wrong credentials or LinkedIn blocked the attempt')
    }

    // Save cookies
    const cookies = await context.cookies()
    const encrypted = encrypt(JSON.stringify(cookies))

    await setSessionStatus(sessionId, 'active', {
      login_error: null,
      verification_code: null,
    })

    await supabase
      .from('linkedin_sessions')
      .update({
        session_cookies: encrypted,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    console.log(`[login] successfully logged in as ${email}`)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[login] failed for ${email}:`, msg)
    await setSessionStatus(sessionId, 'needs_login', { login_error: msg })
    throw err
  } finally {
    await context.close()
    await browser.close()
  }
}

/**
 * One-time LinkedIn session seeder.
 *
 * Opens a real Chrome window, lets you log in to LinkedIn manually,
 * then encrypts your cookies and saves them to the linkedin_sessions table.
 *
 * Run once per LinkedIn account:
 *   cd workers/linkedin
 *   npx tsx seed-session.ts
 *
 * Required env vars (copy from your .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GTM_ENCRYPTION_KEY
 *   LINKEDIN_USER_ID   ← your Supabase auth user UUID
 */
import { chromium } from 'patchright'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import * as readline from 'readline'
import * as path from 'path'
import * as fs from 'fs'
import * as dotenv from 'dotenv'

// Load .env.local from repo root
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

// ── Encryption (mirrors lib/gtm/encrypt.ts) ──────────────────────────────────
const ALGORITHM = 'aes-256-gcm'

function encrypt(plaintext: string): string {
  const hex = process.env.GTM_ENCRYPTION_KEY!
  if (!hex || hex.length !== 64) {
    throw new Error('GTM_ENCRYPTION_KEY must be a 64-char hex string in .env.local')
  }
  const key = Buffer.from(hex, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n─────────────────────────────────────────────')
  console.log('  Ozigi LinkedIn Session Seeder')
  console.log('─────────────────────────────────────────────')
  console.log('A browser window will open. Log in to LinkedIn')
  console.log('manually, then come back here and press Enter.')
  console.log('─────────────────────────────────────────────\n')

  const userId = process.env.LINKEDIN_USER_ID
    ?? await ask('Your Supabase user UUID (from Supabase → Authentication → Users): ')

  if (!userId) {
    console.error('User ID is required.')
    process.exit(1)
  }

  // Use a persistent user data dir so browser doesn't forget extensions/settings
  const userDataDir = path.join(__dirname, '.chrome-session')
  fs.mkdirSync(userDataDir, { recursive: true })

  console.log('\nOpening browser...\n')

  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const page = await browser.newPage()
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' })

  console.log('Waiting for you to log in to LinkedIn...')
  console.log('(Complete any 2FA or CAPTCHA challenges too)\n')

  await ask('Press Enter once you are logged in and can see your LinkedIn feed: ')

  // Verify login succeeded
  const url = page.url()
  if (url.includes('/login') || url.includes('/checkpoint')) {
    console.error('\n✗ Still on login page. Please complete the login and try again.')
    await browser.close()
    process.exit(1)
  }

  console.log('\nCapturing session cookies...')
  const cookies = await browser.cookies()
  const linkedinCookies = cookies.filter(c => c.domain.includes('linkedin.com'))

  if (linkedinCookies.length === 0) {
    console.error('✗ No LinkedIn cookies found. Did you log in successfully?')
    await browser.close()
    process.exit(1)
  }

  // Get the LinkedIn email from the page
  let linkedinEmail = ''
  try {
    linkedinEmail = await page.locator('.global-nav__me-photo').getAttribute('alt') ?? ''
    if (!linkedinEmail) {
      // Fallback: navigate to settings
      const settingsPage = await browser.newPage()
      await settingsPage.goto('https://www.linkedin.com/mypreferences/d/categories/account', { waitUntil: 'domcontentloaded', timeout: 10_000 })
      linkedinEmail = await settingsPage.locator('[data-test-row-lockup-type="Email"] .t-14').first().innerText().catch(() => '')
      await settingsPage.close()
    }
  } catch { /* ignore */ }

  if (!linkedinEmail) {
    linkedinEmail = await ask('Enter your LinkedIn email address (for reference): ')
  }

  await browser.close()

  console.log(`\nSaving session for ${linkedinEmail || userId}...`)

  const encrypted = encrypt(JSON.stringify(linkedinCookies))
  const supabase = getSupabase()

  const { error } = await supabase
    .from('linkedin_sessions')
    .upsert(
      {
        user_id: userId,
        linkedin_email: linkedinEmail || `linkedin-${userId}`,
        session_cookies: encrypted,
        status: 'active',
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,linkedin_email' }
    )

  if (error) {
    console.error('\n✗ Failed to save session:', error.message)
    process.exit(1)
  }

  console.log('\n✓ Session saved successfully!')
  console.log('  The LinkedIn worker will now use this session.')
  console.log('\n  Note: .chrome-session/ is gitignored — your cookies stay local.\n')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

import type { BrowserContext } from 'playwright'

function delay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs)
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function humanType(page: import('playwright').Page, selector: string, text: string) {
  await page.click(selector)
  for (const char of text) {
    await page.keyboard.type(char)
    await delay(40, 120)
  }
}

/**
 * Tries every known LinkedIn pattern to click the Connect button.
 * Returns true if clicked, false if not found.
 */
async function clickConnectButton(page: import('playwright').Page): Promise<boolean> {

  // 1. Direct top-level Connect/Invite button via Playwright role locator (most reliable)
  const directConnect = page.getByRole('button', { name: /^(Connect|Invite .* to connect)$/i })
  if (await directConnect.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await directConnect.first().click()
    return true
  }

  // 2. Aria-label fallback — catches "Invite Jane to connect" etc.
  const ariaConnect = page.locator(
    'button[aria-label*="Invite"][aria-label*="connect"], button[aria-label*="Connect"]:not([aria-label*="More"])'
  ).first()
  if (await ariaConnect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await ariaConnect.click()
    return true
  }

  // 3. JS scan of all buttons — catches React-rendered variants where aria-label
  //    lags behind the visible text during hydration
  const directJS = await page.evaluate(() => {
    for (const btn of Array.from(document.querySelectorAll('button'))) {
      const label = (btn.getAttribute('aria-label') ?? '').toLowerCase()
      const text  = (btn.textContent ?? '').trim().toLowerCase()
      const isConnect = label.includes('invite') || label.includes('connect') ||
                        text === 'connect'
      const isNotMore = !label.includes('more') && text !== 'message' &&
                        text !== 'follow' && text !== 'following'
      if (isConnect && isNotMore) {
        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        btn.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }))
        btn.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }))
        return true
      }
    }
    return false
  })
  if (directJS) return true

  // 4. More actions dropdown — Connect is hidden here for many profiles
  //    Use getByRole for the button (robust against class name changes)
  const moreBtn = page.getByRole('button', { name: /More actions/i })
    .or(page.locator('button').filter({ hasText: /^More$/ }))
    .first()

  const moreVisible = await moreBtn.isVisible({ timeout: 3_000 }).catch(() => false)
  if (!moreVisible) return false

  await moreBtn.click()

  // Wait for the artdeco dropdown overlay to open.
  // artdeco-dropdown__content-inner is stable across LinkedIn deployments.
  const dropdownInner = page.locator('.artdeco-dropdown__content-inner')
  const dropdownOpened = await dropdownInner.waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true).catch(() => false)

  if (!dropdownOpened) {
    // Fallback: role-based dropdown (LinkedIn sometimes uses listbox/menu)
    const roleMenu = page.locator('[role="listbox"]:not([aria-hidden="true"]), [role="menu"]').first()
    const menuOpened = await roleMenu.waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true).catch(() => false)
    if (!menuOpened) {
      await page.keyboard.press('Escape')
      return false
    }
  }

  // Small settle delay — React re-renders dropdown items after open animation
  await page.waitForTimeout(400)

  // Log what's actually in the dropdown (essential for debugging production issues)
  const dropdownTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll(
      '.artdeco-dropdown__content-inner li, [role="listbox"] li, [role="menu"] li, [role="menuitem"]'
    )).map(el => (el.textContent ?? '').trim().replace(/\s+/g, ' ')).filter(Boolean)
  )
  console.log(`[actions] More dropdown items: ${dropdownTexts.slice(0, 8).join(' | ')}`)

  // Click Connect/Invite inside the dropdown via Playwright locator (real click, not dispatch)
  const connectItem = dropdownOpened
    ? dropdownInner.locator('li').filter({ hasText: /connect|invite/i }).first()
    : page.locator('[role="listbox"] li, [role="menu"] li, [role="menuitem"]')
        .filter({ hasText: /connect|invite/i }).first()

  if (await connectItem.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await connectItem.click()
    return true
  }

  // Last resort: JS click (handles edge cases where Playwright visibility check fails)
  const jsDropdownClick = await page.evaluate(() => {
    const selectors = [
      '.artdeco-dropdown__content-inner li',
      '[role="listbox"] li',
      '[role="menu"] li',
      '[role="menuitem"]',
    ]
    for (const sel of selectors) {
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const text = (el.textContent ?? '').toLowerCase()
        if (text.includes('connect') || text.includes('invite')) {
          const clickable = (el.querySelector('button, a') ?? el) as HTMLElement
          clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          return true
        }
      }
    }
    return false
  })

  if (!jsDropdownClick) await page.keyboard.press('Escape')
  return jsDropdownClick
}

export async function sendConnectionRequest(
  context: BrowserContext,
  linkedinUrl: string,
  note?: string
): Promise<void> {
  const page = await context.newPage()

  try {
    // Prime localStorage before visiting the profile. LinkedIn's SPA checks
    // localStorage for auth state when loading a profile page — a blank
    // localStorage triggers a client-side redirect to the auth wall even
    // when li_at is valid. Visiting the feed on the same page lets LinkedIn's
    // JavaScript populate localStorage, then the profile navigation finds it
    // already set and loads normally.
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'commit',   // fires on first byte — no timeout risk
      timeout: 15_000,
    }).catch(() => {})
    // Give LinkedIn's JS 3-4 seconds to run and write to localStorage
    await delay(3000, 4000)

    await page.goto(linkedinUrl, { waitUntil: 'commit', timeout: 60_000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {})

    const landedUrl = page.url()
    if (landedUrl.includes('/login') || landedUrl.includes('/authwall') || landedUrl.includes('/checkpoint')) {
      throw new Error('SESSION_EXPIRED: LinkedIn redirected to login during action')
    }

    // Wait for the SPA to render the profile — the title changes from the
    // generic "LinkedIn" shell to the person's name once data is loaded.
    // 45s covers slow proxied connections. artdeco-spinner intentionally
    // NOT checked here — it appears on many parts of the page, not just
    // during initial load, and would cause this to never resolve.
    await page.waitForFunction(
      () => {
        const t = document.title
        return (t && t !== 'LinkedIn' && t.length > 0) ||
               !!document.querySelector('.pvs-profile-actions, [data-member-id]')
      },
      { timeout: 45_000 }
    ).catch(() => {})

    // Extra settle time for buttons to render after data arrives
    await delay(2000, 3000)

    const pageState = await page.evaluate(() => ({
      btnCount: document.querySelectorAll('button').length,
      bodyLen:  (document.body.textContent ?? '').trim().length,
      title:    document.title,
    })).catch(err => {
      const msg = String(err)
      if (msg.includes('Execution context was destroyed') || msg.includes('Target page')) {
        throw new Error(`AUTHWALL: Page redirected during evaluation (url=${page.url()}) — LinkedIn auth wall`)
      }
      throw err
    })

    if (pageState.btnCount === 0 && pageState.bodyLen < 50) {
      throw new Error('SESSION_EXPIRED: LinkedIn returned a blank page — please reconnect your account')
    }

    if (pageState.title === 'LinkedIn') {
      throw new Error('AUTHWALL: LinkedIn showed sign-in wall on profile — session may need reconnecting')
    }

    const connectClicked = await clickConnectButton(page)

    if (!connectClicked) {
      const main = page.locator('main').first()
      const isPending   = await main.locator('button:has-text("Pending")').isVisible({ timeout: 2_000 }).catch(() => false)
      const isMessage   = await main.locator('button:has-text("Message")').isVisible({ timeout: 1_000 }).catch(() => false)
      const isFollowing = await main.locator('button:has-text("Following")').isVisible({ timeout: 1_000 }).catch(() => false)

      // Check connection degree: "1st" in page = already connected;
      // no "1st" + Message button = Open Profile (Premium, allows anyone to message)
      const is1stDegree = await page.evaluate(() => {
        const bodyText = document.body.textContent ?? ''
        return /\b1st\b/.test(bodyText) ||
               document.querySelector('[aria-label*="1st degree"]') !== null
      }).catch(() => false)

      const finalUrl = page.url()
      const pageState = await page.evaluate(() => {
        const allBtns = Array.from(document.querySelectorAll('button'))
          .map(b => (b.getAttribute('aria-label') || b.textContent?.trim() || '').slice(0, 40))
          .filter(Boolean).slice(0, 25).join(' | ')
        return {
          title: document.title.slice(0, 80),
          buttons: allBtns,
          bodyPreview: (document.body.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
        }
      }).catch(() => null)
      console.log(`[actions] connect not found — url=${finalUrl} 1st=${is1stDegree} state=${JSON.stringify(pageState)}`)

      if (isPending)   throw new Error('Connection request already pending')
      if (isFollowing) throw new Error('Creator profile — Follow only, no Connect option')

      if (isMessage && is1stDegree) {
        throw new Error('Already connected — 1st degree, Message button visible')
      }

      if (isMessage && !is1stDegree) {
        // Open Profile: LinkedIn Premium user who allows direct messages from anyone.
        // The caller should send a direct message instead of a connection request.
        throw new Error('OPEN_PROFILE: Message button visible, not 1st degree — send direct message')
      }

      throw new Error('Connect button not found — profile may be private or layout unrecognised')
    }

    await delay(1000, 2000)

    // "How do you know X?" relationship step LinkedIn sometimes inserts
    const otherBtn = page.locator('button:has-text("Other")').first()
    if (await otherBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await otherBtn.click()
      await delay(500, 1000)
    }
    const nextBtn = page.locator('button:has-text("Next")').first()
    if (await nextBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await nextBtn.click()
      await delay(600, 1200)
    }

    if (note) {
      const addNoteBtn = page.locator('button:has-text("Add a note")').first()
      if (await addNoteBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
        await addNoteBtn.click()
        await delay(600, 1200)
        const textarea = page.locator(
          'textarea[name="message"], textarea#custom-message, textarea'
        ).first()
        await textarea.waitFor({ state: 'visible', timeout: 5_000 })
        await textarea.click()
        await delay(300, 600)
        for (const char of note) {
          await page.keyboard.type(char)
          await delay(40, 120)
        }
        await delay(600, 1200)
        await page.locator('button:has-text("Send")').first().click({ timeout: 8_000 })
      } else {
        await page.locator(
          'button:has-text("Send without a note"), button:has-text("Send"), button:has-text("Send now")'
        ).first().click({ timeout: 8_000 })
      }
    } else {
      await page.locator(
        'button:has-text("Send without a note"), button:has-text("Send"), button:has-text("Send now")'
      ).first().click({ timeout: 8_000 })
    }

    await delay(1000, 2000)

  } finally {
    await page.close()
  }
}

export async function sendLinkedInMessage(
  context: BrowserContext,
  linkedinProfileId: string,
  message: string
): Promise<void> {
  const page = await context.newPage()

  try {
    const messageUrl = `https://www.linkedin.com/messaging/thread/new/?recipients=${linkedinProfileId}`
    await page.goto(messageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await delay(2000, 3500)

    const inputSelector = '.msg-form__contenteditable, [data-placeholder*="Write a message"], [contenteditable="true"]'
    const inputReady = await page.locator(inputSelector).first()
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false)

    if (!inputReady) {
      await page.goto(`https://www.linkedin.com/in/${linkedinProfileId}/`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      await delay(1500, 2500)
      await page.locator('button:has-text("Message")').first().click({ timeout: 5_000 })
      await delay(1000, 2000)
    }

    const msgInput = page.locator(inputSelector).first()
    await msgInput.click()
    await delay(300, 700)

    const chunks = message.match(/.{1,20}/g) ?? [message]
    for (const chunk of chunks) {
      await page.keyboard.type(chunk)
      await delay(80, 200)
    }

    await delay(800, 1500)

    const sendBtn = page.locator('.msg-form__send-button, button[type="submit"]:has-text("Send")').first()
    if (await sendBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sendBtn.click()
    } else {
      await page.keyboard.press('Enter')
    }

    await delay(1000, 2000)
  } finally {
    await page.close()
  }
}

export const sendFollowUp = sendLinkedInMessage

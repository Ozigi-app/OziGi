import type { BrowserContext } from 'playwright'

// Human-like random delay between min and max ms
function delay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs)
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Human-like typing: types one character at a time with random pauses
async function humanType(page: import('playwright').Page, selector: string, text: string) {
  await page.click(selector)
  for (const char of text) {
    await page.keyboard.type(char)
    await delay(40, 120)
  }
}

/**
 * Tries every known LinkedIn pattern to click the Connect button.
 * Returns true if clicked, false if not found (already connected / creator / etc).
 *
 * Uses page.evaluate()-based clicks as fallback since Playwright's .click()
 * requires strict "visibility" that LinkedIn buttons often don't satisfy.
 */
async function clickConnectButton(page: import('playwright').Page): Promise<boolean> {

  // Helper: find button by aria-label substring or text content and fire a
  // proper bubbling MouseEvent so React's synthetic event system picks it up.
  async function findAndClickButton(tests: Array<{ aria?: string; text?: string }>): Promise<boolean> {
    return page.evaluate((tests) => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const label = (btn.getAttribute('aria-label') ?? '').toLowerCase()
        const text  = (btn.textContent ?? '').trim().toLowerCase()
        for (const t of tests) {
          const ariaMatch = t.aria && label.includes(t.aria.toLowerCase())
          const textMatch = t.text && (text === t.text.toLowerCase() || text.includes(t.text.toLowerCase()))
          if (ariaMatch || textMatch) {
            // dispatchEvent with bubbles:true reaches React's root listener
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
            btn.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }))
            btn.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }))
            return true
          }
        }
      }
      return false
    }, tests)
  }

  // 1. Direct Connect/Invite button (aria-label or text)
  const directConnect = await findAndClickButton([
    { aria: 'Invite' },
    { aria: 'Connect' },
    { text: 'Connect' },
  ])
  if (directConnect) return true

  // 2. Also try Playwright locator as belt-and-suspenders
  const main = page.locator('main').first()
  const ariaConnect = main.locator(
    'button[aria-label*="Invite"], button[aria-label*="Connect"], button[aria-label*="connect"]'
  ).first()
  if (await ariaConnect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await ariaConnect.click({ timeout: 10_000 })
    return true
  }

  // 3. More actions dropdown — Connect lives here for many profiles
  // First try Playwright click, then JS click fallback
  const moreBtnClicked =
    await main.locator('button[aria-label*="More actions"], button[aria-label*="more actions"]')
      .first().click({ timeout: 3_000 }).then(() => true).catch(() => false) ||
    await findAndClickButton([{ aria: 'More actions' }, { text: 'More' }])

  if (moreBtnClicked) {
    // Wait for the dropdown to actually open
    await page.waitForFunction(
      () => {
        const open = document.querySelector(
          '.artdeco-dropdown__content--is-open, [role="menu"], [role="listbox"]:not([aria-hidden="true"])'
        )
        return !!open
      },
      { timeout: 5_000 }
    ).catch(() => {})
    await page.waitForTimeout(300)

    // Look for Connect inside the opened dropdown via JS (most reliable)
    const dropdownConnect = await page.evaluate(() => {
      const selectors = [
        '.artdeco-dropdown__content--is-open li',
        '.artdeco-dropdown__content--is-open button',
        '[role="menu"] li',
        '[role="menu"] button',
        '[role="listbox"] li',
        '[role="menuitem"]',
      ]
      for (const sel of selectors) {
        const items = Array.from(document.querySelectorAll(sel))
        for (const item of items) {
          const label = (item.getAttribute('aria-label') ?? '').toLowerCase()
          const text  = (item.textContent ?? '').trim().toLowerCase()
          if (label.includes('connect') || label.includes('invite') ||
              text.includes('connect')  || text.includes('invite')) {
            const clickable = (item.querySelector('button, a') ?? item) as HTMLElement
            clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
            clickable.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }))
            clickable.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }))
            return true
          }
        }
      }
      return false
    })

    if (dropdownConnect) return true
    await page.keyboard.press('Escape')
  }

  return false
}

export async function sendConnectionRequest(
  context: BrowserContext,
  linkedinUrl: string,
  note?: string
): Promise<void> {
  const page = await context.newPage()

  try {
    // 'commit' fires as soon as the first response byte arrives — lets us detect
    // redirects to /login immediately without waiting the full 60s timeout
    await page.goto(linkedinUrl, { waitUntil: 'commit', timeout: 30_000 })

    const landedUrl = page.url()
    if (landedUrl.includes('/login') || landedUrl.includes('/authwall') || landedUrl.includes('/checkpoint')) {
      throw new Error('SESSION_EXPIRED: LinkedIn redirected to login during action')
    }

    // Wait for the SPA to finish rendering
    await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {})

    // Wait for the page to actually render content (any buttons or body text)
    await page.waitForFunction(
      () => document.querySelectorAll('button').length > 0 ||
            (document.body.textContent ?? '').trim().length > 50,
      { timeout: 15_000 }
    ).catch(() => {})

    await delay(1000, 1500)

    // Detect blank page — LinkedIn returns an empty shell when the session has
    // been invalidated server-side (li_at cookie exists but auth token is dead)
    const { btnCount, bodyLen } = await page.evaluate(() => ({
      btnCount: document.querySelectorAll('button').length,
      bodyLen:  (document.body.textContent ?? '').trim().length,
    }))
    if (btnCount === 0 && bodyLen < 50) {
      throw new Error('SESSION_EXPIRED: LinkedIn returned a blank page — please reconnect your account')
    }

    const connectClicked = await clickConnectButton(page)

    if (!connectClicked) {
      // Could be: already connected, pending invite, creator with Follow-only, private profile
      // Check what's actually there so we log something useful
      const main = page.locator('main').first()
      const isPending   = await main.locator('button:has-text("Pending")').isVisible({ timeout: 2_000 }).catch(() => false)
      const isMessage   = await main.locator('button:has-text("Message")').isVisible({ timeout: 1_000 }).catch(() => false)
      const isFollowing = await main.locator('button:has-text("Following")').isVisible({ timeout: 1_000 }).catch(() => false)

      // Log URL + all visible button labels so we know exactly what LinkedIn showed
      const finalUrl = page.url()
      const pageState = await page.evaluate(() => {
        const allBtns = Array.from(document.querySelectorAll('button'))
          .map(b => (b.getAttribute('aria-label') || b.textContent?.trim() || '').slice(0, 40))
          .filter(Boolean).slice(0, 25).join(' | ')
        return {
          title: document.title.slice(0, 80),
          mainExists: !!document.querySelector('main'),
          mainBtnCount: document.querySelectorAll('main button').length,
          allBtnCount: document.querySelectorAll('button').length,
          buttons: allBtns,
          bodyPreview: (document.body.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
        }
      }).catch(() => null)
      console.log(`[actions] connect not found — url=${finalUrl} state=${JSON.stringify(pageState)}`)

      if (isPending)   throw new Error('Connection request already pending')
      if (isFollowing) throw new Error('Creator profile — Follow only, no Connect option')

      // Message visible does NOT always mean connected — open profiles allow
      // messaging without a connection. Check the More dropdown explicitly
      // before concluding the person is already a connection.
      if (isMessage) {
        const moreOpened = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
          const more = buttons.find(b => {
            const label = (b.getAttribute('aria-label') ?? '').toLowerCase()
            const text  = (b.textContent ?? '').trim().toLowerCase()
            return label.includes('more actions') || text === 'more'
          })
          if (!more) return false
          more.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
          more.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }))
          more.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }))
          return true
        })

        if (moreOpened) {
          await page.waitForTimeout(1000)
          const connectInMore = await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll(
              '.artdeco-dropdown__content--is-open li, [role="menu"] li, [role="listbox"] li'
            ))
            for (const el of all) {
              const text = (el.textContent ?? '').trim().toLowerCase()
              if (text.includes('connect') || text.includes('invite')) {
                const clickable = (el.querySelector('button, a') ?? el) as HTMLElement
                clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                return true
              }
            }
            return false
          })
          if (connectInMore) {
            // Successfully clicked Connect from More dropdown — continue with send flow
            await delay(1000, 1500)
          } else {
            await page.keyboard.press('Escape')
            throw new Error('Already connected — Message button visible, no Connect in More dropdown')
          }
        } else {
          throw new Error('Already connected — Message button visible, More button not found')
        }
      } else {
        throw new Error('Connect button not found — profile may be private or layout unrecognised')
      }
    }

    await delay(1000, 2000)

    // Handle "How do you know X?" step that LinkedIn sometimes shows
    const otherBtn = page.locator('button:has-text("Other")').first()
    const otherVisible = await otherBtn.isVisible({ timeout: 2_000 }).catch(() => false)
    if (otherVisible) {
      await otherBtn.click()
      await delay(500, 1000)
    }
    // "Next" button that follows the relationship step
    const nextBtn = page.locator('button:has-text("Next")').first()
    const nextVisible = await nextBtn.isVisible({ timeout: 1_500 }).catch(() => false)
    if (nextVisible) {
      await nextBtn.click()
      await delay(600, 1200)
    }

    if (note) {
      // Click "Add a note" if the modal offers it
      const addNoteBtn = page.locator('button:has-text("Add a note")').first()
      const noteVisible = await addNoteBtn.isVisible({ timeout: 4_000 }).catch(() => false)
      if (noteVisible) {
        await addNoteBtn.click()
        await delay(600, 1200)
        // Multiple selectors for the note textarea across LinkedIn versions
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
        // After typing a note the button just says "Send"
        const sendBtn = page.locator('button:has-text("Send")').first()
        await sendBtn.click({ timeout: 8_000 })
      } else {
        // "Add a note" not offered — fall through to send without note
        const sendBtn = page.locator(
          'button:has-text("Send without a note"), button:has-text("Send"), button:has-text("Send now")'
        ).first()
        await sendBtn.click({ timeout: 8_000 })
      }
    } else {
      // No note — LinkedIn now says "Send without a note" (not "Send now")
      const sendBtn = page.locator(
        'button:has-text("Send without a note"), button:has-text("Send"), button:has-text("Send now")'
      ).first()
      await sendBtn.click({ timeout: 8_000 })
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
    // Use the messaging URL directly for existing connections
    const messageUrl = `https://www.linkedin.com/messaging/thread/new/?recipients=${linkedinProfileId}`
    await page.goto(messageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await delay(2000, 3500)

    // Try to find the message input; fall back to profile → Message button
    const inputSelector = '.msg-form__contenteditable, [data-placeholder*="Write a message"], [contenteditable="true"]'
    const inputReady = await page.locator(inputSelector).first()
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false)

    if (!inputReady) {
      // Fallback: navigate to profile and click Message button
      await page.goto(`https://www.linkedin.com/in/${linkedinProfileId}/`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      await delay(1500, 2500)
      await page.locator('button:has-text("Message")').first().click({ timeout: 5_000 })
      await delay(1000, 2000)
    }

    const msgInput = page.locator(inputSelector).first()
    await msgInput.click()
    await delay(300, 700)

    // Type message in chunks to appear human
    const chunks = message.match(/.{1,20}/g) ?? [message]
    for (const chunk of chunks) {
      await page.keyboard.type(chunk)
      await delay(80, 200)
    }

    await delay(800, 1500)

    // Send with Enter or Send button
    const sendBtn = page.locator('.msg-form__send-button, button[type="submit"]:has-text("Send")').first()
    const sendVisible = await sendBtn.isVisible({ timeout: 3_000 }).catch(() => false)
    if (sendVisible) {
      await sendBtn.click()
    } else {
      await page.keyboard.press('Enter')
    }

    await delay(1000, 2000)
  } finally {
    await page.close()
  }
}

// Follow-up is the same as message — just a different step context
export const sendFollowUp = sendLinkedInMessage

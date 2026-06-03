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
 * LinkedIn button placement varies by:
 *   - Profile type (member vs creator)
 *   - Connection degree (2nd, 3rd, Out-of-network)
 *   - Viewport / A/B tests
 *
 * Strategy:
 *   1. aria-label contains "Invite" or "Connect" — most reliable, survives text changes
 *   2. Visible button with exact text "Connect" scoped to main
 *   3. "More actions" dropdown → look for Connect item inside
 */
async function clickConnectButton(page: import('playwright').Page): Promise<boolean> {
  const main = page.locator('main').first()

  // 1. aria-label approach — most stable across LinkedIn versions
  const ariaConnect = main.locator(
    'button[aria-label*="Invite"], button[aria-label*="Connect"], button[aria-label*="connect"]'
  ).first()
  if (await ariaConnect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await ariaConnect.click({ timeout: 10_000 })
    return true
  }

  // 2. Visible "Connect" button text scoped to main (not sidebar)
  const textConnect = main.locator('button:has-text("Connect")').first()
  if (await textConnect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await textConnect.click({ timeout: 10_000 })
    return true
  }

  // 3. "More actions" / "More" dropdown — Connect sometimes lives here
  const moreBtn = main.locator(
    'button[aria-label*="More actions"], button[aria-label*="more actions"], button:has-text("More")'
  ).first()
  if (await moreBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await moreBtn.click({ timeout: 8_000 })
    await page.waitForTimeout(800)

    // Look for Connect inside the opened dropdown
    const dropdownConnect = page.locator(
      '[role="listbox"] [aria-label*="Connect"], [role="listbox"] [aria-label*="Invite"], ' +
      '.artdeco-dropdown__content button:has-text("Connect"), ' +
      '[data-control-name="connect"]'
    ).first()
    if (await dropdownConnect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dropdownConnect.click({ timeout: 8_000 })
      return true
    }

    // Close dropdown — Connect wasn't in there
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
    await page.goto(linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // If LinkedIn redirected us to login, the session was invalidated server-side
    const landedUrl = page.url()
    if (landedUrl.includes('/login') || landedUrl.includes('/authwall') || landedUrl.includes('/checkpoint')) {
      throw new Error('SESSION_EXPIRED: LinkedIn redirected to login during action')
    }

    // Give the SPA extra time to finish rendering action buttons
    await delay(3000, 5000)

    const connectClicked = await clickConnectButton(page)

    if (!connectClicked) {
      // Could be: already connected, pending invite, creator with Follow-only, private profile
      // Check what's actually there so we log something useful
      const main = page.locator('main').first()
      const isPending  = await main.locator('button:has-text("Pending")').isVisible({ timeout: 2_000 }).catch(() => false)
      const isMessage  = await main.locator('button:has-text("Message")').isVisible({ timeout: 1_000 }).catch(() => false)
      const isFollowing = await main.locator('button:has-text("Following")').isVisible({ timeout: 1_000 }).catch(() => false)

      if (isPending)   throw new Error('Connection request already pending')
      if (isMessage)   throw new Error('Already connected — Message button visible')
      if (isFollowing) throw new Error('Creator profile — Follow only, no Connect option')
      throw new Error('Connect button not found — profile may be private or layout unrecognised')
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

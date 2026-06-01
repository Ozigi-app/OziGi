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

export async function sendConnectionRequest(
  context: BrowserContext,
  linkedinUrl: string,
  note?: string
): Promise<void> {
  const page = await context.newPage()

  try {
    await page.goto(linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    // Give the SPA extra time to finish rendering action buttons
    await delay(2500, 4000)

    // click() internally waits for the element to be visible + actionable (unlike isVisible which is instant)
    // Scope to main to prefer the profile-header button over sidebar suggestions
    const mainSection = page.locator('main').first()

    const connectClicked = await mainSection
      .locator('button:has-text("Connect")')
      .first()
      .click({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false)

    if (!connectClicked) {
      // Some profiles hide Connect inside the "More" dropdown
      const moreClicked = await mainSection
        .locator('button[aria-label*="More actions"], button:has-text("More")')
        .first()
        .click({ timeout: 4_000 })
        .then(() => true)
        .catch(() => false)

      if (moreClicked) {
        await delay(500, 1000)
        await page
          .locator('[aria-label*="Connect"], .artdeco-dropdown__item:has-text("Connect")')
          .first()
          .click({ timeout: 4_000 })
      } else {
        throw new Error('Connect button not found — already connected or profile not reachable')
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
    await page.goto(messageUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })
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

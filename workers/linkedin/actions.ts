import type { BrowserContext, Page } from 'patchright'

function delay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs)
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Wander the LinkedIn feed like a real user before navigating to a profile.
 *
 * Does three things to break automation patterns:
 *  1. Scrolls down the feed in natural reading increments with random pauses
 *  2. Hovers over a few in-feed profile links (triggers LinkedIn's hover-card JS)
 *  3. 30% of the time briefly visits /notifications/ then comes back
 *
 * Total dwell: 20–50 s — enough for PerimeterX to record natural behaviour
 * signals without adding too much latency.
 */
async function humanWander(page: Page): Promise<void> {
  try {
    // ── 1. Natural scroll through the feed ─────────────────────────────────
    let scrollPos = 0
    // Scroll down in 4-8 steps over ~15-30 seconds
    const steps = Math.floor(Math.random() * 5 + 4)
    for (let i = 0; i < steps; i++) {
      const amount = Math.floor(Math.random() * 280 + 120)
      scrollPos += amount
      await page.evaluate((y: number) => window.scrollTo({ top: y, behavior: 'smooth' }), scrollPos)
      // Pause as if reading the post (longer pauses feel more natural)
      await delay(1500, 4500)
      // Occasionally scroll back up a little (re-reading behaviour)
      if (Math.random() < 0.25) {
        scrollPos = Math.max(0, scrollPos - Math.floor(Math.random() * 150 + 50))
        await page.evaluate((y: number) => window.scrollTo({ top: y, behavior: 'smooth' }), scrollPos)
        await delay(800, 2000)
      }
    }

    // ── 2. Hover over a couple of profile links in the feed ─────────────────
    // Real users frequently hover over names — LinkedIn fires hover-card events
    const profileLinks = await page.locator('a[href*="/in/"]:visible').all().catch(() => [])
    const toHover = profileLinks.slice(0, Math.floor(Math.random() * 3 + 1))
    for (const link of toHover) {
      await link.hover({ timeout: 2_000 }).catch(() => {})
      await delay(600, 1800)
    }

    // ── 3. 30% chance: visit /notifications/ briefly ─────────────────────────
    if (Math.random() < 0.30) {
      await page.goto('https://www.linkedin.com/notifications/', {
        waitUntil: 'commit',
        timeout: 15_000,
      }).catch(() => {})
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {})
      // Scroll notifications a little
      await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' })).catch(() => {})
      await delay(3000, 7000)
      // Go back to feed
      await page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'commit',
        timeout: 15_000,
      }).catch(() => {})
      await delay(1500, 3000)
    }

    // Scroll back to top before leaving
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })).catch(() => {})
    await delay(500, 1200)

  } catch {
    // Wander is best-effort — never block the connect action
  }
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
  //    Covers English + Portuguese ("Conectar", "Convidar") + Spanish ("Conectar") + French ("Se connecter")
  const directConnect = page.getByRole('button', {
    name: /^(Connect|Invite .* to connect|Conectar|Convidar .* para se conectar|Convidar para se conectar|Se connecter|Conectar con)$/i,
  })
  if (await directConnect.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await directConnect.first().click()
    return true
  }

  // 2. Aria-label fallback — catches "Invite Jane to connect" / "Convidar Jane para se conectar" etc.
  const ariaConnect = page.locator(
    'button[aria-label*="Invite"][aria-label*="connect"], button[aria-label*="Connect"]:not([aria-label*="More"]),' +
    'button[aria-label*="Convidar"][aria-label*="conectar"], button[aria-label*="Conectar"]:not([aria-label*="Mais"])'
  ).first()
  if (await ariaConnect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await ariaConnect.click()
    return true
  }

  // 3. JS scan — find the Connect button, then use a real Playwright click.
  //    dispatchEvent was here previously but synthetic events skip LinkedIn's
  //    full click handler and cause LinkedIn to send the request without
  //    showing the "Add a note" modal. We find the button with JS and then
  //    hand back to Playwright for the actual click.
  const connectBtnText = await page.evaluate(() => {
    for (const btn of Array.from(document.querySelectorAll('button'))) {
      const label = (btn.getAttribute('aria-label') ?? '').toLowerCase()
      const text  = (btn.textContent ?? '').trim().toLowerCase()
      const isConnect = label.includes('invite') || label.includes('connect') ||
                        text === 'connect'
      const isNotMore = !label.includes('more') && text !== 'message' &&
                        text !== 'follow' && text !== 'following'
      if (isConnect && isNotMore) {
        // Return the aria-label or text so Playwright can locate it properly
        return btn.getAttribute('aria-label') || btn.textContent?.trim() || 'Connect'
      }
    }
    return null
  })
  if (connectBtnText) {
    // Use a real Playwright click so LinkedIn's full click handler fires (required for the modal)
    const jsFoundBtn = page.locator(`button[aria-label="${connectBtnText}"]`)
      .or(page.locator('button').filter({ hasText: new RegExp(`^${connectBtnText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }))
      .first()
    if (await jsFoundBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await jsFoundBtn.click()
      console.log(`[actions] Connect clicked via JS-found button: "${connectBtnText.slice(0, 40)}"`)
      return true
    }
  }

  // 4. More actions dropdown — Connect is hidden here for many profiles
  //    Use getByRole for the button (robust against class name changes)
  const moreBtn = page.getByRole('button', { name: /More actions|Mais ações|Más acciones|Plus d'actions/i })
    .or(page.locator('button').filter({ hasText: /^(More|Mais|Más|Plus)$/ }))
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
    ? dropdownInner.locator('li').filter({ hasText: /connect|invite|conectar|convidar/i }).first()
    : page.locator('[role="listbox"] li, [role="menu"] li, [role="menuitem"]')
        .filter({ hasText: /connect|invite|conectar|convidar/i }).first()

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
        if (text.includes('connect') || text.includes('invite') ||
            text.includes('conectar') || text.includes('convidar')) {
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
    // Visit the feed to prime localStorage AND wander like a real user.
    // LinkedIn's SPA checks localStorage for auth state before rendering
    // a profile — visiting the feed first populates it. We then wander
    // (scroll, hover, sometimes check notifications) to generate natural
    // behavioural signals for PerimeterX before arriving at the profile.
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'commit',   // fires on first byte — safe through proxy
      timeout: 15_000,
    }).catch(() => {})
    // Wait for HTML to be fully parsed (scripts are now downloading)
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {})
    // Wait for LinkedIn's React app to initialise and write auth state to localStorage.
    await page.waitForFunction(
      () => Object.keys(localStorage).some(k => k.startsWith('voyager-web:')),
      { timeout: 12_000 }
    ).catch(() => {})

    // Wander the feed like a human — scroll, hover, maybe check notifications.
    // This breaks the robotic direct-goto-then-connect pattern that PerimeterX flags.
    await humanWander(page)

    await page.goto(linkedinUrl, { waitUntil: 'commit', timeout: 60_000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {})

    const landedUrl = page.url()
    if (landedUrl.includes('/login') || landedUrl.includes('/authwall') || landedUrl.includes('/checkpoint')) {
      throw new Error('SESSION_EXPIRED: LinkedIn redirected to login during action')
    }

    // Wait for the SPA to render the profile — the title changes from the
    // generic "LinkedIn" shell to the person's name once data is loaded.
    // 90s covers slow proxied connections (50+ assets × ~2s each through IPRoyal).
    await page.waitForFunction(
      () => {
        const t = document.title
        return (t && t !== 'LinkedIn' && t.length > 0) ||
               !!document.querySelector('.pvs-profile-actions, [data-member-id]')
      },
      { timeout: 90_000 }
    ).catch(() => {})

    // Extra settle time for buttons to render after data arrives
    await delay(2000, 3000)

    // Re-check the URL after waiting — a client-side redirect to /login or
    // /authwall would change the URL here even if it didn't at commit time.
    const currentUrl = page.url()
    if (currentUrl.includes('/login') || currentUrl.includes('/authwall') || currentUrl.includes('/checkpoint')) {
      throw new Error('AUTHWALL: LinkedIn redirected to login/authwall after profile load')
    }

    const pageState = await page.evaluate(() => ({
      btnCount: document.querySelectorAll('button').length,
      bodyLen:  (document.body.textContent ?? '').trim().length,
      title:    document.title,
      url:      location.href,
    })).catch(err => {
      const msg = String(err)
      if (msg.includes('Execution context was destroyed') || msg.includes('Target page')) {
        throw new Error(`AUTHWALL: Page redirected during evaluation (url=${page.url()}) — LinkedIn auth wall`)
      }
      throw err
    })

    console.log(`[actions] profile loaded — title="${pageState.title.slice(0, 60)}" btns=${pageState.btnCount} url=${pageState.url.slice(0, 80)}`)

    if (pageState.btnCount === 0 && pageState.bodyLen < 50) {
      // Blank page = LinkedIn temporarily blocked this request (bot detection / rate limit).
      // The session itself is still valid — the feed loaded fine moments ago.
      // Throw a non-SESSION_EXPIRED error so the worker retries without expiring the session.
      throw new Error('BLANK_PAGE: LinkedIn served an empty page — temporary block, will retry')
    }

    // Only treat as AUTHWALL if the URL actually redirected away from the profile.
    // title==='LinkedIn' with URL still on /in/ means the profile is loading slowly — continue anyway.
    if (pageState.title === 'LinkedIn' &&
        !pageState.url.includes('/in/') && !pageState.url.includes('/pub/')) {
      throw new Error('AUTHWALL: LinkedIn showed sign-in wall on profile — session may need reconnecting')
    }

    // Human-like scroll behaviour — real users scroll down to read the profile
    // before clicking Connect. Doing this before button search adds natural dwell
    // time and generates the scroll events PerimeterX expects from real users.
    await page.evaluate(() => {
      const scrollStep = () => new Promise<void>(r => {
        let pos = 0
        const step = () => {
          pos += Math.floor(Math.random() * 120 + 60)
          window.scrollTo({ top: pos, behavior: 'smooth' })
          if (pos < 600) setTimeout(step, Math.floor(Math.random() * 200 + 100))
          else r()
        }
        step()
      })
      return scrollStep()
    }).catch(() => {})
    await delay(800, 1500)
    // Scroll back up so the top action buttons are in view
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })).catch(() => {})
    await delay(500, 900)

    const connectClicked = await clickConnectButton(page)

    if (!connectClicked) {
      const main = page.locator('main').first()
      const isPending   = await main.locator('button:has-text("Pending"), button:has-text("Pendente"), button:has-text("Pendiente")').isVisible({ timeout: 2_000 }).catch(() => false)
      const isMessage   = await main.locator('button:has-text("Message"), button:has-text("Mensagem"), button:has-text("Mensaje"), button:has-text("Envoyer un message")').isVisible({ timeout: 1_000 }).catch(() => false)
      const isFollowing = await main.locator('button:has-text("Following"), button:has-text("Seguindo"), button:has-text("Siguiendo"), button:has-text("Abonné")').isVisible({ timeout: 1_000 }).catch(() => false)

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

    // Diagnostic: log all visible buttons so we can see what the modal/page shows
    const postConnectBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter(b => (b as HTMLElement).offsetParent !== null)
        .map(b => `"${(b.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50)}"`)
        .filter(t => t !== '""')
        .join(' | ')
    ).catch(() => 'evaluate failed')
    console.log(`[actions] post-connect visible buttons: ${postConnectBtns}`)

    // ── Modal-first approach ───────────────────────────────────────────────────
    // IMPORTANT: check for the modal BEFORE checking for direct-send indicators.
    // LinkedIn sometimes fires an "Invitation sent" toast while ALSO rendering
    // the note modal — if we check body text first we'd bail out and miss the
    // chance to attach a note.  Wait up to 6 s for the modal; only fall back
    // to direct-send detection if it genuinely doesn't appear.
    //
    // Scope all modal interactions to the invite overlay to avoid false matches
    // on profile-page pagination buttons and "People Also Viewed" Connect buttons.
    const modal = page.locator(
      '[data-test-modal-id="send-invite-modal"], [data-test-modal-container], .artdeco-modal__content, [role="dialog"]'
    ).first()

    const modalAppeared = await modal.waitFor({ state: 'visible', timeout: 6_000 })
      .then(() => true).catch(() => false)

    if (modalAppeared) {
      console.log('[actions] note modal appeared — attaching note')

      // "How do you know X?" relationship step LinkedIn sometimes inserts
      // Selectors cover English + Portuguese (Outro/Avançar) + Spanish (Otro/Siguiente) + French (Autre/Suivant)
      const otherBtn = modal.locator('button:has-text("Other"), button:has-text("Outro"), button:has-text("Otro"), button:has-text("Autre")').first()
      if (await otherBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await otherBtn.click()
        await delay(500, 1000)
      }
      const nextBtn = modal.locator('button:has-text("Next"), button:has-text("Avançar"), button:has-text("Próximo"), button:has-text("Siguiente"), button:has-text("Suivant")').first()
      if (await nextBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await nextBtn.click()
        await delay(600, 1200)
      }

      // Send button selector covers English + Portuguese + Spanish + French
      const SEND_SELECTOR =
        'button:has-text("Send without a note"), button:has-text("Send"), button:has-text("Send now"), ' +
        'button:has-text("Enviar sem uma nota"), button:has-text("Enviar sem nota"), button:has-text("Enviar"), ' +
        'button:has-text("Enviar sin nota"), button:has-text("Envoyer sans note"), button:has-text("Envoyer")'

      if (note) {
        const addNoteBtn = modal.locator(
          'button:has-text("Add a note"), button:has-text("Adicionar uma nota"), button:has-text("Agregar una nota"), button:has-text("Ajouter une note")'
        ).first()
        if (await addNoteBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
          await addNoteBtn.click()
          await delay(600, 1200)
          const textarea = modal.locator(
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
          await modal.locator(SEND_SELECTOR).first().click({ timeout: 8_000 })
          console.log('[actions] connection sent with note ✓')
        } else {
          // "Add a note" button not present inside modal — send without note
          console.log('[actions] modal open but "Add a note" not found — sending without note')
          await modal.locator(SEND_SELECTOR).first().click({ timeout: 8_000 })
        }
      } else {
        await modal.locator(SEND_SELECTOR).first().click({ timeout: 8_000 })
      }

    } else {
      // Modal did not appear — LinkedIn sent the request directly (no note option).
      // Use page.evaluate for the state check: Playwright locators can miss buttons
      // that briefly leave and re-enter the DOM during React re-renders after the
      // 6-second modal wait.
      const directSendState = await page.evaluate(() => {
        const body = (document.body.textContent ?? '').toLowerCase()

        const sentToasts = [
          'invitation sent', 'solicitação enviada', 'solicitud enviada',
          'invitation envoyée', 'einladung gesendet', 'request sent',
          'connection request sent',
        ]
        const hasSentToast = sentToasts.some(s => body.includes(s))

        // Check the first 20 buttons on the page (profile action area)
        // for Pending/Cancel which indicate a request was sent directly.
        const topButtons = Array.from(document.querySelectorAll('button')).slice(0, 20)
        const hasPending = topButtons.some(b => {
          const t = (b.textContent ?? '').trim().toLowerCase()
          return t === 'pending' || t === 'pendente' || t === 'pendiente' ||
                 t === 'en attente' || t === 'cancel' // LinkedIn sometimes uses Cancel
        })
        // Also check aria-labels
        const hasPendingAria = !!document.querySelector(
          'button[aria-label*="Pending"], button[aria-label*="Pendente"], button[aria-label*="Cancel request"]'
        )

        return { hasSentToast, hasPending: hasPending || hasPendingAria }
      }).catch(() => ({ hasSentToast: false, hasPending: false }))

      if (directSendState.hasSentToast || directSendState.hasPending) {
        console.log('[actions] connection sent directly by LinkedIn (no note modal — no note attached)')
        await delay(500, 1000)
      } else {
        // Neither modal nor direct-send signal — log the state but don't throw;
        // the connection may still have gone through silently.
        console.log('[actions] WARNING: no modal and no direct-send signal — connection state unclear')
      }
    }

    await delay(1000, 2000)

  } finally {
    await page.close()
  }
}

/**
 * Checks whether a LinkedIn connection invitation has been accepted.
 * Returns true if the target profile shows as 1st-degree connection.
 *
 * Used by the follow-up sequence: before sending a message, the worker
 * confirms the connection was accepted. If not yet accepted, the queue
 * item is rescheduled for 24h later without consuming an attempt.
 */
export async function checkConnectionAccepted(
  context: BrowserContext,
  linkedinUrl: string
): Promise<boolean> {
  const page = await context.newPage()
  try {
    await page.goto(linkedinUrl, { waitUntil: 'commit', timeout: 30_000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {})
    // Give React a moment to render the connection degree badge
    await page.waitForTimeout(3000)

    return await page.evaluate(() => {
      const body = document.body.textContent ?? ''
      // LinkedIn shows "1st" degree badge on connected profiles.
      // Check the body text AND the aria-label on the degree indicator.
      const bodyHas1st = /\b1st\b/.test(body)
      const has1stLabel = !!document.querySelector(
        '[aria-label*="1st degree"], [aria-label*="1º grau"], [aria-label*="1er degré"]'
      )
      // The "Message" button present + no "Connect" button = 1st degree
      const hasMessage = !!document.querySelector('button[aria-label*="Message"], button[aria-label*="Mensagem"]')
      const hasConnect = !!document.querySelector('button[aria-label*="Connect"], button[aria-label*="Conectar"]')
      return bodyHas1st || has1stLabel || (hasMessage && !hasConnect)
    }).catch(() => false)
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
    // ── Navigate to the person's profile and click Message ────────────────────
    //
    // We deliberately avoid /messaging/thread/new/?recipients=<slug> because
    // that URL opens a "To:" typeahead which — even with Enter to confirm —
    // can select the wrong person (whoever ranks top in the search results).
    // Going via the profile page means LinkedIn pre-fills the exact recipient
    // from the page context with zero ambiguity.
    const profileUrl = `https://www.linkedin.com/in/${linkedinProfileId}/`
    await page.goto(profileUrl, { waitUntil: 'commit', timeout: 30_000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {})

    const landedUrl = page.url()
    if (landedUrl.includes('/login') || landedUrl.includes('/authwall') || landedUrl.includes('/checkpoint')) {
      throw new Error('SESSION_EXPIRED: LinkedIn redirected to login during message attempt')
    }

    // Wait for the profile to render its action buttons
    await page.waitForFunction(
      () => !!document.querySelector('.pvs-profile-actions, [data-member-id]') ||
            (document.title !== 'LinkedIn' && document.title.length > 0),
      { timeout: 60_000 }
    ).catch(() => {})
    await delay(1500, 2500)

    // ── Click the Message button ───────────────────────────────────────────────
    // The button is the primary action on connected (1st-degree) profiles.
    // aria-label contains "Message" or the localised equivalent.
    const messageBtn = page.getByRole('button', { name: /^Message$/i })
      .or(page.locator('button[aria-label*="Message"], button[aria-label*="Mensagem"], button[aria-label*="Mensaje"]'))
      .first()

    const btnVisible = await messageBtn.isVisible({ timeout: 6_000 }).catch(() => false)

    if (!btnVisible) {
      // Message may be hidden under the "More actions" dropdown
      const moreBtn = page.getByRole('button', { name: /More actions|Mais ações|Más acciones/i })
        .or(page.locator('button').filter({ hasText: /^(More|Mais|Más)$/ }))
        .first()
      const moreVisible = await moreBtn.isVisible({ timeout: 3_000 }).catch(() => false)
      if (moreVisible) {
        await moreBtn.click()
        await delay(400, 700)
        const dropdownMsg = page.locator('.artdeco-dropdown__content-inner li')
          .filter({ hasText: /Message|Mensagem|Mensaje/i })
          .first()
        if (await dropdownMsg.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await dropdownMsg.click()
        } else {
          await page.keyboard.press('Escape')
          throw new Error(`Message option not found in More dropdown for ${linkedinProfileId}`)
        }
      } else {
        // Diagnose: log visible buttons so we know the profile state
        const btns = await page.evaluate(() =>
          Array.from(document.querySelectorAll('button'))
            .filter(b => (b as HTMLElement).offsetParent !== null)
            .map(b => (b.getAttribute('aria-label') || b.textContent?.trim() || '').slice(0, 40))
            .filter(Boolean).slice(0, 15).join(' | ')
        ).catch(() => 'evaluate failed')
        console.log(`[actions] Message button not found for ${linkedinProfileId} — visible buttons: ${btns}`)
        throw new Error(`Message button not visible for ${linkedinProfileId} — profile may not be connected`)
      }
    } else {
      await messageBtn.click()
    }

    console.log(`[actions] Message button clicked for ${linkedinProfileId}`)

    // ── Wait for the compose panel / modal to appear ──────────────────────────
    // LinkedIn opens a floating message panel at the bottom of the page.
    // The compose area is .msg-form__contenteditable (same selector as the
    // full messaging page).
    const inputSelector = '.msg-form__contenteditable[contenteditable="true"], .msg-form__contenteditable'
    const inputReady = await page.locator(inputSelector).first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false)

    if (!inputReady) {
      throw new Error(`Message compose panel did not appear for ${linkedinProfileId}`)
    }
    await delay(500, 800)

    // ── Type the message ───────────────────────────────────────────────────────
    // Click the input first to ensure focus, then use execCommand('insertText')
    // which is the most reliable way to insert text into LinkedIn's ProseMirror
    // contenteditable (keyboard.type() can silently fail if focus drifts).
    const msgInput = page.locator(inputSelector).first()
    await msgInput.click({ timeout: 5_000 }).catch(async () => {
      console.log('[actions] msg input click failed — using evaluate focus')
      await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('.msg-form__contenteditable')
        el?.focus()
      })
    })
    await delay(300, 600)

    const inserted = await page.evaluate((msg: string) => {
      const el = document.querySelector<HTMLElement>('.msg-form__contenteditable')
      if (!el) return false
      el.focus()
      return document.execCommand('insertText', false, msg)
    }, message)

    if (!inserted) {
      console.log('[actions] execCommand insertText returned false — falling back to keyboard.type()')
      const chunks = message.match(/.{1,20}/g) ?? [message]
      for (const chunk of chunks) {
        await page.keyboard.type(chunk)
        await delay(80, 200)
      }
    }

    await delay(800, 1500)

    // ── Send ──────────────────────────────────────────────────────────────────
    const sendBtn = page.locator('.msg-form__send-button, button[type="submit"]:has-text("Send")').first()
    const sendVisible = await sendBtn.isVisible({ timeout: 3_000 }).catch(() => false)
    if (sendVisible) {
      const enabled = await sendBtn.isEnabled({ timeout: 5_000 }).catch(() => false)
      if (enabled) {
        await sendBtn.click()
        console.log(`[actions] message sent to ${linkedinProfileId} ✓`)
      } else {
        console.log('[actions] send button still disabled after typing — pressing Enter as fallback')
        await page.keyboard.press('Enter')
      }
    } else {
      // Some LinkedIn layouts use Ctrl+Enter / Enter to send
      await page.keyboard.press('Enter')
      console.log(`[actions] message sent via Enter to ${linkedinProfileId}`)
    }

    await delay(1000, 2000)
  } finally {
    await page.close()
  }
}

export const sendFollowUp = sendLinkedInMessage

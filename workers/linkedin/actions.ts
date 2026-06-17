import type { BrowserContext, Page } from 'patchright'

function delay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs)
  return new Promise(resolve => setTimeout(resolve, ms))
}

// page.keyboard.type()/press() have NO timeout option in Playwright — if the CDP
// connection to Chrome stalls (proxy issues, browser overload), these hang forever
// with zero protection, unlike locator actions which auto-timeout. Race them against
// a deadline so a stalled connection throws instead of freezing the whole queue item.
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT: ${label} exceeded ${ms}ms`)), ms)
    ),
  ])
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
    await withTimeout(page.keyboard.type(char), 5_000, 'humanType keystroke')
    await delay(40, 120)
  }
}

/**
 * Dismisses any open LinkedIn messaging overlays (conversation bubble or compose panel).
 *
 * The messaging overlay list bubble (.msg-overlay-list-bubble) floats above profile
 * action buttons and intercepts pointer events — Playwright throws "subtree intercepts
 * pointer events" when trying to click Connect or Message. This helper:
 *   1. Closes individual conversation bubbles via their close buttons.
 *   2. Sets pointer-events:none on the entire overlay container so Playwright can
 *      click through to profile action buttons even if the list bubble stays visible.
 */

/**
 * Sets pointer-events:none on all known LinkedIn overlays that intercept Playwright
 * clicks on profile action buttons (Connect, Message, Send InMail).
 *
 * Call this immediately before any click on a profile button — LinkedIn's Ember.js
 * can re-render overlays between the initial dismissal and the actual click, so we
 * re-apply right before each click rather than relying on a one-time setup.
 *
 * Targets:
 *  - msg-overlay-list-bubble / __convo-card-content  (messaging panel list)
 *  - global-nav app-launcher dropdown               (nav menu that pops open on hover)
 *
 * We intentionally do NOT disable .msg-overlay-conversation-bubble (the compose
 * panel) so the message input and Send button remain interactive.
 */
async function suppressInterceptors(page: Page): Promise<void> {
  await page.evaluate(() => {
    const selectors = [
      '.msg-overlay-list-bubble',
      '.msg-overlay-list-bubble__convo-card-content',
      '.global-nav__app-launcher-menu',
      '.global-nav__primary-item--divider',
      // Open artdeco dropdowns in the global nav (app-launcher, notifications, etc.)
      '#global-nav .artdeco-dropdown--is-dropdown-open',
    ]
    for (const sel of selectors) {
      document.querySelectorAll<HTMLElement>(sel).forEach(el =>
        el.style.setProperty('pointer-events', 'none', 'important')
      )
    }
  }).catch(() => {})
}

async function dismissMessagingOverlay(page: Page, profileId: string): Promise<void> {
  const broadClose = page.locator([
    '.msg-overlay-bubble-header__controls button',
    'button[data-control-name="close"]',
    '.msg-overlay-list-bubble__header button',
    '.msg-overlay-conversation-bubble__header button',
  ].join(', '))
  const closeCount = await broadClose.count().catch(() => 0)
  if (closeCount > 0) {
    console.log(`[actions] dismissing ${closeCount} messaging overlay button(s) for ${profileId}`)
    for (let i = 0; i < Math.min(closeCount, 6); i++) {
      await broadClose.nth(i).click({ timeout: 1_500 }).catch(() => {})
      await delay(150, 250)
    }
  }
  await page.keyboard.press('Escape').catch(() => {})
  await delay(300, 500)

  // Disable pointer events on overlays so Playwright can reach profile buttons.
  await suppressInterceptors(page)
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
    // Re-apply overlay suppression immediately before the click — LinkedIn's Ember.js
    // can re-render the messaging overlay between dismissMessagingOverlay() and here,
    // restoring the high-z-index div that intercepts Playwright pointer events.
    await suppressInterceptors(page)
    await directConnect.first().click({ timeout: 8_000 })
    return true
  }

  // 2. Aria-label fallback — catches "Invite Jane to connect" / "Convidar Jane para se conectar" etc.
  const ariaConnect = page.locator(
    'button[aria-label*="Invite"][aria-label*="connect"], button[aria-label*="Connect"]:not([aria-label*="More"]),' +
    'button[aria-label*="Convidar"][aria-label*="conectar"], button[aria-label*="Conectar"]:not([aria-label*="Mais"])'
  ).first()
  if (await ariaConnect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await suppressInterceptors(page)
    await ariaConnect.click({ timeout: 8_000 })
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
      await suppressInterceptors(page)
      await jsFoundBtn.click({ timeout: 8_000 })
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

  await suppressInterceptors(page)
  await moreBtn.click({ timeout: 8_000 })

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
    await suppressInterceptors(page)
    await connectItem.click({ timeout: 8_000 })
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
  page.setDefaultTimeout(30_000)

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

    // Dismiss any open messaging overlays — the conversation list bubble floats over
    // the Connect button and intercepts pointer events, causing Playwright to time out.
    await dismissMessagingOverlay(page, linkedinUrl.split('/in/')[1]?.replace(/\/.*/, '') ?? linkedinUrl)

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
    // Scope all modal interactions to the actual invite DIALOG — NOT the backdrop overlay.
    //
    // LinkedIn's modal DOM structure:
    //   <div class="artdeco-modal-overlay" data-test-modal-id="..." data-test-modal-container>  ← backdrop (full-page)
    //     <div class="artdeco-modal" role="dialog">                                             ← dialog ✓
    //       <div class="artdeco-modal__content"> ...buttons... </div>
    //     </div>
    //   </div>
    //
    // The data-test-modal-id / data-test-modal-container attributes are on the BACKDROP div,
    // not the dialog.  Scoping to the backdrop means .locator('button:has-text("Next")')
    // matches ANY "Next" button on the page (e.g. pagination), causing clicks that are
    // then blocked by the modal overlay itself.  We scope to the dialog element instead.
    const modal = page.locator(
      '[role="dialog"].artdeco-modal, .artdeco-modal:not(.artdeco-modal-overlay), [role="dialog"]'
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
          // insertText: single CDP call, not sensitive to per-keystroke proxy
          // latency (see sendLinkedInMessage for the production failure that
          // motivated this — char-by-char typing reliably exceeded 30s).
          await withTimeout(page.keyboard.insertText(note), 15_000, 'connection note text')
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
    await Promise.race([
      page.close(),
      new Promise<void>(resolve => setTimeout(resolve, 5_000)),
    ]).catch(() => {})
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

    // Detect auth redirects immediately — session expired or checkpoint
    const landedUrl = page.url()
    if (
      landedUrl.includes('/login') ||
      landedUrl.includes('/authwall') ||
      landedUrl.includes('/checkpoint')
    ) {
      throw new Error(`SESSION_EXPIRED: redirected to ${landedUrl} while checking connection for ${linkedinUrl}`)
    }

    // Give React a moment to render the connection degree badge
    await page.waitForTimeout(3000)

    const result = await page.evaluate(() => {
      const body = document.body.textContent ?? ''
      const bodyLen = body.trim().length

      // Detect blank / rate-limited page — real profiles have hundreds of chars
      if (bodyLen < 300) return { blocked: true, connected: false }

      // LinkedIn shows "1st" degree badge on connected profiles.
      const bodyHas1st = /\b1st\b/.test(body)
      const has1stLabel = !!document.querySelector(
        '[aria-label*="1st degree"], [aria-label*="1º grau"], [aria-label*="1er degré"]'
      )
      // Message button present + no Connect button = 1st degree (connected)
      const hasMessage = !!document.querySelector('button[aria-label*="Message"], button[aria-label*="Mensagem"]')
      const hasConnect = !!document.querySelector('button[aria-label*="Connect"], button[aria-label*="Conectar"]')
      return {
        blocked: false,
        connected: bodyHas1st || has1stLabel || (hasMessage && !hasConnect),
      }
    }).catch(() => ({ blocked: true, connected: false }))

    // Blocked/rate-limited — throw so the caller retries later,
    // NOT treated as "not yet connected" (which would reschedule +24h)
    if (result.blocked) {
      throw new Error(`BLANK_PAGE: LinkedIn served a near-empty page for ${linkedinUrl} — temporary block`)
    }

    return result.connected
  } finally {
    await page.close()
  }
}

export async function sendLinkedInMessage(
  context: BrowserContext,
  linkedinProfileId: string,
  message: string,
  recipientName?: string | null
): Promise<void> {
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)

  try {
    // ── 1. Feed visit — prime localStorage auth state ────────────────────────
    // LinkedIn's SPA checks localStorage for voyager-web:* keys before rendering
    // a profile. Without visiting /feed/ first, profiles may serve a blank page.
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'commit',
      timeout: 15_000,
    }).catch(() => {})
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {})
    await page.waitForFunction(
      () => Object.keys(localStorage).some(k => k.startsWith('voyager-web:')),
      { timeout: 12_000 }
    ).catch(() => {})
    await delay(2_000, 4_000)

    const feedUrl = page.url()
    if (feedUrl.includes('/login') || feedUrl.includes('/authwall') || feedUrl.includes('/checkpoint')) {
      throw new Error('SESSION_EXPIRED: LinkedIn redirected feed visit to login')
    }

    // LinkedIn's messaging overlay is session-level, not page-level — a conversation
    // bubble left open from a PREVIOUS lead's failed send can still render here on a
    // brand new page. If left alone it can get mistaken for the current lead's
    // compose panel later (confirmed in production: wrong recipient got another
    // lead's message). Force-remove any conversation bubbles now, before we ever
    // navigate to this lead's profile, so only a freshly-opened one can exist later.
    await page.evaluate(() => {
      document.querySelectorAll('.msg-overlay-conversation-bubble, .msg-overlay-list-bubble')
        .forEach(el => el.remove())
    }).catch(() => {})

    // ── 2. Navigate to profile page ──────────────────────────────────────────
    // NOT /messaging/thread/new/?recipients= — that opens a typeahead that can
    // resolve to the wrong person when the profileId doesn't exactly match.
    const profileUrl = `https://www.linkedin.com/in/${linkedinProfileId}/`
    await page.goto(profileUrl, { waitUntil: 'commit', timeout: 30_000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {})

    const landedUrl = page.url()
    if (landedUrl.includes('/login') || landedUrl.includes('/authwall') || landedUrl.includes('/checkpoint')) {
      throw new Error('SESSION_EXPIRED: LinkedIn redirected profile to login during message send')
    }

    // Wait for the profile to fully render (profile actions or data-member-id)
    await page.waitForFunction(
      () => !!document.querySelector('.pvs-profile-actions, [data-member-id]') ||
            (document.title !== 'LinkedIn' && document.title.length > 0),
      { timeout: 60_000 }
    ).catch(() => {})
    await delay(1_500, 2_500)

    // Detect blank / rate-limited page — real profiles have hundreds of chars of text.
    // Throw BLANK_PAGE so the error handler reschedules in 1h without burning an attempt.
    const bodyLen = await page.evaluate(() => (document.body.textContent ?? '').trim().length).catch(() => 0)
    if (bodyLen < 300) {
      throw new Error(`BLANK_PAGE: LinkedIn served a near-empty page for https://www.linkedin.com/in/${linkedinProfileId}/ — temporary block`)
    }

    // ── 3. Dismiss any open messaging overlays ───────────────────────────────
    await dismissMessagingOverlay(page, linkedinProfileId)

    // ── 4. Find and click the Message button ─────────────────────────────────
    //
    // LinkedIn renders the Message action as EITHER a <button> OR an <a class="artdeco-button">
    // depending on the profile layout / A-B test variant. We must query both element types
    // everywhere — pure button selectors miss the anchor variant and produce false
    // "Message button not found" errors even for accepted 1st-degree connections.
    const visibleBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, [role="button"], a.artdeco-button, a[aria-label]'))
        .filter(b => (b as HTMLElement).offsetParent !== null)
        .map(b => (b.getAttribute('aria-label') || b.textContent?.trim() || '').slice(0, 50))
        .filter(Boolean)
        .slice(0, 20)
    ).catch(() => [] as string[])
    console.log(`[actions] profile buttons for ${linkedinProfileId}: ${visibleBtns.join(' | ')}`)

    // If only Connect is visible but no Message, the connection wasn't accepted yet
    const hasConnect = visibleBtns.some((b: string) => /\bconnect\b/i.test(b))
    const hasMessage = visibleBtns.some((b: string) => /\bmessage\b|\bmensagem\b|\bmensaje\b/i.test(b))
    if (hasConnect && !hasMessage) {
      throw new Error(`NOT_YET_CONNECTED: ${linkedinProfileId} shows Connect button — connection not yet accepted`)
    }

    // LinkedIn uses "Message [FirstName]" (not just "Message") so match any element
    // whose aria-label or text content STARTS WITH a message keyword.
    //
    // Strategy:
    //   1. Playwright getByRole — uses computed accessible name (aria-label preferred)
    //   2. CSS aria-label^= selectors — starts-with match on <button> and <a> variants
    //   3. Anchor fallback — a.artdeco-button:has-text("Message") covers <a> with no aria-label
    //   4. JS evaluate fallback — queries button + [role="button"] + a.artdeco-button + a[aria-label],
    //      fires a native click event so React / LinkedIn's SPA click handlers are notified.
    const msgKeywordRe = /^(Message|Mensagem|Mensaje|Envoyer un message)\b/i

    const msgBtn = page.getByRole('button', { name: msgKeywordRe })
      .or(page.locator('button[aria-label^="Message"]:not([aria-label*="More"])'))
      .or(page.locator('button[aria-label^="Mensagem"]'))
      .or(page.locator('button[aria-label^="Mensaje"]'))
      // Anchor variants — LinkedIn sometimes renders Message as <a class="artdeco-button">
      .or(page.locator('a[aria-label^="Message"]:not([aria-label*="More"]), a[aria-label^="Mensagem"], a[aria-label^="Mensaje"]'))
      .or(page.locator('a.artdeco-button').filter({ hasText: msgKeywordRe }))
      .first()

    const msgBtnVisible = await msgBtn.isVisible({ timeout: 5_000 }).catch(() => false)

    if (msgBtnVisible) {
      // Re-apply overlay suppression immediately before the Message button click.
      // LinkedIn's Ember.js can re-render the overlay after dismissMessagingOverlay(),
      // restoring the high-z-index interception div before Playwright reaches the button.
      await suppressInterceptors(page)
      await msgBtn.click({ timeout: 10_000 })
      console.log(`[actions] Message button clicked (Playwright) for ${linkedinProfileId}`)
    } else {
      // Fallback: JS click — queries button, [role="button"], a.artdeco-button, and a[aria-label]
      // so that <a> anchor Message buttons (LinkedIn's alternate layout) are also found.
      console.warn(`[actions] Playwright locators missed Message button for ${linkedinProfileId} — trying JS click`)

      // Log all artdeco anchor elements for diagnostics (helps debug new LinkedIn layouts)
      const anchorBtns = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a.artdeco-button, a[aria-label]'))
          .map(a => `${a.tagName} aria="${a.getAttribute('aria-label')?.slice(0, 40)}" text="${(a.textContent ?? '').trim().slice(0, 30)}"`)
      ).catch(() => [] as string[])
      console.log(`[actions] anchor buttons for ${linkedinProfileId}: ${anchorBtns.join(' | ')}`)

      const jsClicked = await page.evaluate((kw: string) => {
        const re = new RegExp(kw, 'i')
        const moreRe = /more|options|mais/i
        // Include <a> anchor buttons — LinkedIn renders Message as <a class="artdeco-button">
        // in many profile layouts. Without this, the button is invisible to the selector.
        const candidates = Array.from(
          document.querySelectorAll('button, [role="button"], a.artdeco-button, a[aria-label]')
        ).filter(b => (b as HTMLElement).offsetParent !== null)
        const btn = candidates.find(b => {
          const label = (b.getAttribute('aria-label') || b.textContent?.trim() || '').slice(0, 80)
          return re.test(label) && !moreRe.test(label)
        }) as HTMLElement | undefined
        if (btn) { btn.click(); return true }
        return false
      }, '^(Message|Mensagem|Mensaje|Envoyer un message)\\b').catch(() => false)

      if (!jsClicked) {
        throw new Error(`Message button not found for ${linkedinProfileId} — may not be connected yet`)
      }
      console.log(`[actions] Message button JS-clicked for ${linkedinProfileId}`)
    }

    // ── 5. Wait for compose panel ────────────────────────────────────────────
    const inputSel = '.msg-form__contenteditable[contenteditable="true"], .msg-form__contenteditable'
    const composeVisible = await page.locator(inputSel).first()
      .waitFor({ state: 'visible', timeout: 25_000 })
      .then(() => true)
      .catch(() => false)

    if (!composeVisible) {
      throw new Error(`Compose panel did not open for ${linkedinProfileId}`)
    }
    await delay(500, 1_000)

    // ── 5b. SAFETY: verify the open compose panel is actually for this recipient ──
    // CRITICAL: LinkedIn's messaging overlay can leave a PREVIOUS conversation's
    // bubble open and interactive after a failed send. If our selectors then grab
    // that stale bubble instead of the newly-opened one for the current profile,
    // we'd type and send THIS message into the WRONG person's conversation —
    // confirmed in production (a message meant for one lead landed in another's
    // thread). Before typing anything, confirm the conversation container that
    // encloses our target input actually mentions the intended recipient's name.
    // Fail closed: if we can't verify, abort rather than risk a misdirected send.
    const firstName = recipientName?.trim().split(/\s+/)[0]
    if (firstName && firstName.length >= 2) {
      const recipientCheck = await page.evaluate(({ inputSel, name }: { inputSel: string; name: string }) => {
        const input = document.querySelector(inputSel)
        if (!input) return 'no-input'
        const bubble =
          input.closest('.msg-overlay-conversation-bubble') ??
          input.closest('[class*="overlay"]') ??
          input.closest('.msg-form')
        const text = (bubble?.textContent ?? '').toLowerCase()
        return text.includes(name.toLowerCase()) ? 'match' : `mismatch:${text.slice(0, 150)}`
      }, { inputSel, name: firstName }).catch(() => 'eval-failed')

      if (recipientCheck !== 'match') {
        throw new Error(`RECIPIENT_MISMATCH: compose panel for ${linkedinProfileId} does not show "${firstName}" — likely a stale conversation bubble from a previous attempt. Aborting to prevent a misdirected send. (${recipientCheck})`)
      }
      console.log(`[actions] recipient verified for ${linkedinProfileId}: "${firstName}" found in compose panel`)
    } else {
      console.warn(`[actions] no recipientName provided for ${linkedinProfileId} — skipping recipient verification (less safe)`)
    }

    // ── 6. Type message using real keyboard events ───────────────────────────
    // WHY keyboard.type() not execCommand:
    //   execCommand('insertText') puts text in the DOM visually but does NOT
    //   trigger LinkedIn's React/ProseMirror state update, so the send button
    //   stays disabled and the send is silently ignored even though the box
    //   has content. page.keyboard.type() fires real keydown/input/keyup events
    //   that React processes, enabling the send button properly.
    const msgInput = page.locator(inputSel).first()
    await msgInput.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {})
    await delay(200, 300)

    // Click to focus — short timeout, fall back to JS focus
    const msgInputClicked = await msgInput.click({ timeout: 1_500 }).then(() => true).catch(() => false)
    if (!msgInputClicked) {
      console.warn(`[actions] msgInput click timed out for ${linkedinProfileId} — using JS focus fallback`)
      await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>(
          '.msg-form__contenteditable[contenteditable="true"], .msg-form__contenteditable'
        )
        if (el) el.focus()
      })
    }

    // Clear any existing text — keyboard calls have no built-in timeout, so wrap
    // each one. If the CDP connection to Chrome has stalled, fail fast and let the
    // queue retry/reschedule instead of freezing this item (and everything behind it).
    await withTimeout(page.keyboard.press('Control+a'), 10_000, `Control+a for ${linkedinProfileId}`)
    await withTimeout(page.keyboard.press('Backspace'), 10_000, `Backspace for ${linkedinProfileId}`)
    await delay(150, 250)

    // Type the message — insertText dispatches a single real `input` event,
    // which is what enables LinkedIn's send button (same reason execCommand
    // failed: it doesn't fire that event in a way React picks up).
    // WHY insertText not type(): keyboard.type() sends one CDP round-trip per
    // character. Under proxy latency that reliably exceeded 30s for ~200-char
    // messages (confirmed twice in production — see TIMEOUT errors). insertText
    // is a single CDP call regardless of message length, so it isn't sensitive
    // to per-keystroke round-trip latency.
    await withTimeout(
      page.keyboard.insertText(message),
      15_000,
      `insert message text for ${linkedinProfileId}`
    )
    // insertText fires an `input` event but LinkedIn's send button stayed disabled
    // anyway (confirmed in production — button found, scoped correctly, disabled=true).
    // It likely also listens for keydown/keyup to enable the button. Fire one real
    // keystroke (space + backspace) to trigger that — fast (2 round-trips, not N)
    // while giving LinkedIn whatever real keyboard signal its enable-logic needs.
    await withTimeout(page.keyboard.press('Space'), 10_000, `wake keystroke for ${linkedinProfileId}`)
    await withTimeout(page.keyboard.press('Backspace'), 10_000, `wake keystroke cleanup for ${linkedinProfileId}`)
    await delay(400, 700)

    // Verify the text landed in the box
    const boxText = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(
        '.msg-form__contenteditable[contenteditable="true"], .msg-form__contenteditable'
      )
      return (el?.textContent ?? '').trim()
    }).catch(() => '')
    console.log(`[actions] compose box has ${boxText.length}/${message.length} chars for ${linkedinProfileId}`)
    if (boxText.length < message.length * 0.7) {
      throw new Error(`Message text incomplete in compose box (got ${boxText.length}/${message.length} chars) — aborting`)
    }

    // ── 7. Send ──────────────────────────────────────────────────────────────
    // CRITICAL: scope to .msg-form. An unscoped `button[aria-label*="Send"]`
    // matches "Send {Name}'s profile via message" — a share-profile button
    // elsewhere on the page — before it ever reaches the real send button.
    // This was confirmed in production: button found, enabled, clicked, but the
    // compose box never cleared because we were clicking the wrong element.
    const sendBtnState = await page.evaluate(() => {
      const form = document.querySelector<HTMLElement>(
        '.msg-overlay-conversation-bubble .msg-form, .msg-form'
      )
      if (!form) return 'no-form'
      const btn = form.querySelector<HTMLButtonElement>(
        '.msg-form__send-button, button.msg-form__send-button, button[aria-label*="Send"]'
      )
      if (!btn) return 'not-found-in-form'
      return `found disabled=${btn.disabled} aria-disabled=${btn.getAttribute('aria-disabled')} text="${btn.textContent?.trim()}"`
    }).catch(() => 'eval-failed')
    console.log(`[actions] send button state for ${linkedinProfileId}: ${sendBtnState}`)

    const sendBtn = page.locator(
      '.msg-overlay-conversation-bubble .msg-form, .msg-form'
    ).locator(
      '.msg-form__send-button, button.msg-form__send-button, ' +
      'button[aria-label*="Send"], button[aria-label*="Enviar"], button[aria-label*="Envoyer"]'
    ).first()
    const sendBtnVisible = await sendBtn.isVisible({ timeout: 3_000 }).catch(() => false)
    if (sendBtnVisible) {
      await withTimeout(sendBtn.click({ timeout: 5_000 }), 8_000, `send button click for ${linkedinProfileId}`)
        .then(() => console.log(`[actions] send button clicked for ${linkedinProfileId}`))
        .catch(async (err) => {
          console.warn(`[actions] send button click failed for ${linkedinProfileId}: ${(err as Error).message} — falling back to Enter`)
          await withTimeout(page.keyboard.press('Enter'), 10_000, `Enter press for ${linkedinProfileId}`)
        })
    } else {
      console.log(`[actions] send button not visible for ${linkedinProfileId} — using Enter`)
      await withTimeout(page.keyboard.press('Enter'), 10_000, `Enter press for ${linkedinProfileId}`)
    }
    // Give LinkedIn's send request time to round-trip before checking box-cleared.
    // The Enter key itself can take up to 10 s under proxy latency, so we need
    // enough headroom for: keypress CDPconfirm + LinkedIn server + box clear.
    await delay(4_000, 6_000)

    // ── 8. Verify box cleared (confirms send succeeded) ──────────────────────
    const boxCleared = await page.waitForFunction(
      (origLen: number) => {
        const el = document.querySelector<HTMLElement>(
          '.msg-form__contenteditable[contenteditable="true"], .msg-form__contenteditable'
        )
        return (el?.textContent ?? '').trim().length < origLen * 0.3
      },
      message.length,
      { timeout: 20_000 }
    ).then(() => true).catch(() => false)

    if (!boxCleared) {
      const remaining = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>(
          '.msg-form__contenteditable[contenteditable="true"], .msg-form__contenteditable'
        )
        return (el?.textContent ?? '').trim().slice(0, 100)
      }).catch(() => '?')
      // Empty box means the message sent but we detected it after the polling window.
      if (remaining === '') {
        console.log(`[actions] message sent to ${linkedinProfileId} ✓ (late box clear)`)
      } else {
        throw new Error(`Message send may have failed — compose box still has content: "${remaining}"`)
      }
    }

    console.log(`[actions] message sent to ${linkedinProfileId} ✓`)
    await dismissMessagingOverlay(page, linkedinProfileId)
    await delay(1_000, 2_000)

  } finally {
    await Promise.race([
      page.close(),
      new Promise<void>(resolve => setTimeout(resolve, 5_000)),
    ]).catch(() => {})
  }
}

export const sendFollowUp = sendLinkedInMessage

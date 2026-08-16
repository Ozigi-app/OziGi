// Ozigi for LinkedIn — content script (runs inside the user's real LinkedIn tab).
//
// This script only FINDS elements and reports their on-screen coordinates —
// it does not click anything itself. LinkedIn's own click handlers check
// event.isTrusted before opening in-app overlays; script-generated clicks
// (element.click(), dispatchEvent(...)) are always isTrusted:false and get
// silently ignored, so the intended link falls through to a raw href — a URL
// that only works via LinkedIn's internal client-side router, producing a
// broken empty page on a cold load (confirmed in testing). The actual clicking
// is done by background.js via the Chrome DevTools Protocol (Input domain),
// which dispatches genuinely OS/browser-trusted input at the coordinates this
// script reports.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(fn, { timeout = 12000, step = 300 } = {}) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const v = fn()
    if (v) return v
    await sleep(step)
  }
  return null
}

const inAside = (el) => !!(el && el.closest && el.closest('aside'))

// Do NOT use `el.offsetParent !== null` here. Per spec offsetParent is null for
// any position:fixed element whose containing block is the viewport, and Chrome
// returns null for a showModal()'d <dialog> — the UA stylesheet makes modal
// dialogs position:fixed. Measuring real layout is both correct for those and
// still excludes hidden overlays (a closed dialog collapses to a 0x0 rect).
function visible(el) {
  if (!el) return false
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return false // covers display:none and closed <dialog>
  // Must be the element's OWN window: an element living in an iframe document
  // belongs to a different realm, and the top window's getComputedStyle is not
  // guaranteed to answer for it.
  const view = el.ownerDocument?.defaultView || window
  const s = view.getComputedStyle(el)
  return s.visibility !== 'hidden' && s.display !== 'none'
}

// LinkedIn renders its overlays — the invite modal, the messaging compose box —
// INSIDE A SHADOW ROOT, which document.querySelectorAll cannot cross. This was
// the root cause of connects never sending: the invite modal was present and
// visible the whole time as
//   <div role="dialog" class="artdeco-modal … send-invite">  (552x262, display:flex)
// but findConnectModal() queried `document` and got null, so the flow reported
// "no modal appeared" and bailed on every single attempt. Any lookup that might
// target an overlay must go through queryAll(), never document directly.
// It also renders the MESSAGING overlay inside a near-fullscreen same-origin
// iframe (`/preload/?_bprMode=vanilla`), one boundary further out than a shadow
// root and equally invisible to a top-frame query — the compose bubble was open
// on screen while editables/overlays both came back empty. Same-origin frames
// are reachable via contentDocument, so descend into those too. Coordinates from
// inside a frame need frameOffset() before they mean anything to CDP.
// LinkedIn keeps a HIDDEN `/preload/?_bprMode=vanilla` iframe holding a second,
// never-displayed instance of the messaging app. Descending into it finds a
// perfectly real compose box that the user cannot see: text typed there lands
// (the box reports the characters), but the Send click is computed from an
// invisible frame, hits nothing on the actual page, and the message never goes —
// exactly the "types fine, never sends, nothing on screen" failure. Only descend
// into frames that are genuinely rendered and aren't the preload shell.
function usableFrame(frame) {
  const src = frame.getAttribute('src') || ''
  if (/\/preload\b/.test(src) || src === 'about:blank') return false
  const r = frame.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return false
  const s = getComputedStyle(frame)
  if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
  // Positioned off-screen is another way LinkedIn hides a live frame.
  if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return false
  return true
}

function allRoots() {
  const roots = []
  const seen = new Set()
  const walk = (root, depth) => {
    if (!root || depth > 5 || seen.has(root)) return
    seen.add(root)
    roots.push(root)
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot, depth + 1)
      if (el.tagName === 'IFRAME' && usableFrame(el)) {
        let doc = null
        try { doc = el.contentDocument } catch { /* cross-origin — unreachable */ }
        if (doc) walk(doc, depth + 1)
      }
    }
  }
  walk(document, 0)
  return roots
}

function queryAll(sel) {
  return allRoots().flatMap((r) => {
    try { return Array.from(r.querySelectorAll(sel)) } catch { return [] }
  })
}

// getBoundingClientRect inside an iframe is relative to THAT frame's viewport,
// but CDP dispatches input in top-level viewport coordinates. Walk the frame
// chain and add each frame's own on-screen position, or a click computed from a
// framed element lands somewhere else entirely.
function frameOffset(el) {
  let x = 0, y = 0
  let win = el.ownerDocument?.defaultView
  let hops = 0
  while (win && win !== window.top && hops++ < 5) {
    let frame = null
    try { frame = win.frameElement } catch { break } // cross-origin ancestor
    if (!frame) break
    const r = frame.getBoundingClientRect()
    x += r.left
    y += r.top
    win = win.parent
  }
  return { x, y }
}

function rectOf(el) {
  el.scrollIntoView({ block: 'center', behavior: 'instant' })
  const r = el.getBoundingClientRect()
  const o = frameOffset(el)
  return { x: Math.round(o.x + r.left + r.width / 2), y: Math.round(o.y + r.top + r.height / 2) }
}

// For buttons inside a modal/dialog — already guaranteed on-screen, so no
// scrollIntoView. Scrolling here was a real bug: the outer page can still
// visually shift on scrollIntoView even though the fixed-position modal
// doesn't move, and there's a content-script→background round trip between
// reading this rect and CDP actually dispatching the click — any layout
// movement in that gap makes the click land on the wrong spot with no error
// (confirmed: "Send without a note" reported success but the modal stayed open).
function rectOfNoScroll(el) {
  const r = el.getBoundingClientRect()
  const o = frameOffset(el)
  return { x: Math.round(o.x + r.left + r.width / 2), y: Math.round(o.y + r.top + r.height / 2) }
}

// The profile owner's own action buttons live in <main>, never in the right-rail
// <aside> (which holds "More profiles for you"). Scope every lookup accordingly.
function mainButtons() {
  const main = document.querySelector('main') || document.body
  return Array.from(main.querySelectorAll('a, button, [role="button"]')).filter(visible).filter((b) => !inAside(b))
}

function findOwnMessageButton() {
  // The owner's Message control is an <a href="/messaging/compose/…"> or a button
  // whose accessible label is exactly "Message" (sidebar ones carry a name).
  return mainButtons().find((b) => {
    const href = b.getAttribute('href') || ''
    if (href.includes('/messaging/compose/')) return true
    const label = (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase()
    return /^(message|mensagem|mensaje|envoyer un message)$/.test(label)
  })
}

function isConnectControl(b) {
  const href = (b.getAttribute('href') || '').toLowerCase()
  const ckey = (b.getAttribute('componentkey') || '').toLowerCase()
  const label = (b.getAttribute('aria-label') || '').toLowerCase()
  const text = (b.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (href.includes('custom-invite') || ckey.includes('connectbutton')) return true
  if (/\bto connect\b|para se conectar/.test(label)) return true
  return text === 'connect' && !label.includes('more')
}

function findConnectButton() {
  return mainButtons().find(isConnectControl)
}

// Some profiles don't put Connect in the top card at all — it lives in the "…"
// overflow menu, with Follow/Message taking the primary slots. Without this the
// flow saw no Connect control and either gave up or, worse, saw the Message
// button and concluded "already connected".
function findMoreButton() {
  return mainButtons().find((b) => {
    const label = (b.getAttribute('aria-label') || '').toLowerCase()
    const ckey = (b.getAttribute('componentkey') || '').toLowerCase()
    const text = (b.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (/^more$|more actions|more options|mais ações|más acciones|plus d'actions/.test(label)) return true
    if (ckey.includes('overflow')) return true
    return text === 'more' || text === '…'
  })
}

// The opened menu is often portaled out of <main> (and can be inside a shadow
// root), so this searches every root — but still refuses anything in <aside>,
// which has its own Connect buttons for OTHER people.
function findConnectInMenu() {
  return queryAll('a, button, [role="button"], [role="menuitem"], li')
    .filter((b) => visible(b) && !inAside(b))
    .find(isConnectControl)
}

function isPending() {
  return mainButtons().some((b) => /^pending\b|^pendente\b|^pendiente\b/.test((b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase()))
}

function setContentEditable(el, text) {
  el.focus()
  // execCommand acts on the document holding the focused element, so it must be
  // that element's own document — calling the top frame's execCommand does
  // nothing for a compose box living inside the messaging iframe.
  const doc = el.ownerDocument || document
  const view = doc.defaultView || window
  const ok = doc.execCommand && doc.execCommand('insertText', false, text)
  if (!ok) {
    el.textContent = text
    const Ev = view.InputEvent || InputEvent
    el.dispatchEvent(new Ev('input', { bubbles: true, data: text, inputType: 'insertText' }))
  }
}

// ── Connect flow ─────────────────────────────────────────────────────────

// A generic "grab the first dialog on the page" is unsafe: LinkedIn's pages
// carry OTHER <dialog> elements at all times (ad-options, cookie/consent) that
// are simply hidden (not removed) when closed. A blind querySelector('dialog')
// can pick one of those, see it's invisible, and wrongly conclude "no modal is
// open" while the real invite modal — a separate element — is still showing
// (confirmed bug: reported success while the invite modal stayed open).
// Identify the connect modal by its actual content instead of just its tag.
function findConnectModal() {
  const candidates = queryAll('.artdeco-modal, [role="dialog"], dialog')
  return candidates.find((m) => {
    if (!visible(m)) return false
    const text = (m.textContent || '').toLowerCase()
    return /invitation|add a note|send without a note|conex|invitación|convite/.test(text)
  }) || null
}

function rectConnectButton() {
  if (isPending()) return { outcome: 'done' } // already requested
  const btn = findConnectButton()
  if (btn) return { outcome: 'exists', ...rectOf(btn) }
  // No Connect in the top card. Don't conclude anything yet — it may just be in
  // the "…" menu (confirmed on real profiles). Report what's here and let
  // background.js open the menu and look; a Message button on its own is NOT
  // proof of an existing connection (Open Profile and 2nd-degree members show
  // one too), which is what previously caused those leads to be marked done.
  return { outcome: 'no_top_card_connect', hasMessage: !!findOwnMessageButton(), hasMore: !!findMoreButton() }
}

function rectMoreButton() {
  const btn = findMoreButton()
  if (!btn) return { outcome: 'not_found' }
  return { outcome: 'exists', ...rectOf(btn) }
}

// Called after background.js trusted-clicks the "…" button — waits for the menu
// to render, then reports the Connect item's position. No scrollIntoView: the
// menu is anchored to a button we already scrolled to, and scrolling now would
// move the menu out from under the coordinates we're about to return.
async function rectConnectInMenu() {
  const item = await waitFor(findConnectInMenu, { timeout: 6000 })
  if (!item) return { outcome: 'not_found' }
  return { outcome: 'exists', ...rectOfNoScroll(item) }
}

// Called after background.js trusted-clicks the Connect button.
// 25s, not 10s: on a slow SDUI profile the invite modal can mount well after ten
// seconds, and once this returns the flow is over — the modal then appears with
// nobody left to drive it, which looks exactly like the page freezing mid-invite
// (confirmed on a real profile).
async function afterConnectClick() {
  const modal = await waitFor(() => {
    const m = findConnectModal()
    return visible(m) ? m : null
  }, { timeout: 25000 })
  if (!modal) { await sleep(1200); return { outcome: 'no-modal' } } // some layouts send immediately
  return { outcome: 'modal-open' }
}

function rectConnectAddNote() {
  const modal = findConnectModal()
  if (!modal) return { outcome: 'not_found' }
  const btn = Array.from(modal.querySelectorAll('button')).find(
    (b) => /add a note|adicionar nota|añadir una nota/i.test((b.getAttribute('aria-label') || b.textContent || ''))
  )
  if (!btn) return { outcome: 'not_found' }
  return { outcome: 'exists', ...rectOfNoScroll(btn) }
}

async function fillConnectNote(note) {
  // Clicking "Add a note" REPLACES the stage-1 modal with the note modal, so for a
  // moment neither is on the page. Waiting for the textarea to appear anywhere in
  // a connect modal covers that gap; grabbing the modal once and failing if it
  // isn't there yet was a race that reported "modal closed" every time, left the
  // box empty, and so left Send disabled (which then surfaced as "send button not
  // found" one step later).
  const ta = await waitFor(() => {
    const modal = findConnectModal()
    if (!modal) return null
    const el = modal.querySelector('textarea, [contenteditable="true"]')
    return el && visible(el) ? el : null
  }, { timeout: 12000 })
  if (!ta) return { outcome: 'failed', error: 'note textarea never appeared' }

  const text = note.slice(0, 300)
  if (ta.tagName === 'TEXTAREA') {
    // Assigning .value directly can be silently discarded: React caches the last
    // value it wrote on the node, sees no change on the resulting input event, and
    // never updates its state — leaving Send disabled with the note visibly typed.
    // Going through the prototype's native setter updates React's tracker too.
    ta.focus()
    // Prototype from the element's own realm — a framed element's textarea class
    // is a different object than this frame's.
    const view = ta.ownerDocument?.defaultView || window
    const proto = (view.HTMLTextAreaElement || HTMLTextAreaElement).prototype
    const setValue = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setValue) setValue.call(ta, text)
    else ta.value = text
    ta.dispatchEvent(new (view.Event || Event)('input', { bubbles: true }))
  } else {
    setContentEditable(ta, text)
  }
  await sleep(600)

  // Confirm the text actually landed. LinkedIn gates Send on its own state, so an
  // empty box here means Send stays disabled — better to report that plainly than
  // to fail later on a button that was never going to be clickable.
  const got = (ta.tagName === 'TEXTAREA' ? ta.value : ta.textContent) || ''
  if (!got.trim()) return { outcome: 'failed', error: 'text did not register in the note box' }
  return { outcome: 'filled', chars: got.length }
}

// Two different modals reach here. Stage 1 (no note) has "Send without a note";
// stage 2, after Add a note, labels its primary button "Send" or — depending on
// the variant LinkedIn serves — "Send invitation", which a bare /^send$/ misses.
const sendLabel = (b) => (b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim()
const isSendLabel = (b) => /^send( invitation| now)?$|send without a note|^enviar|^envoyer/i.test(sendLabel(b))

async function rectConnectSend() {
  // Waits, rather than sampling once: in the note stage LinkedIn keeps Send
  // disabled until React has processed the typed text, so an instant check finds
  // only the enabled "Cancel" and reports the button missing.
  const btn = await waitFor(() => {
    const modal = findConnectModal()
    if (!modal) return null
    return Array.from(modal.querySelectorAll('button'))
      .filter((b) => visible(b) && !b.disabled)
      .find(isSendLabel) || null
  }, { timeout: 8000 })

  if (!btn) {
    const modal = findConnectModal()
    const seen = modal
      ? Array.from(modal.querySelectorAll('button')).filter(visible).map((b) => `${sendLabel(b)}${b.disabled ? '(disabled)' : ''}`)
      : ['<no modal>']
    return { outcome: 'not_found', error: `buttons: ${seen.slice(0, 6).join(' | ')}`.slice(0, 200) }
  }
  return { outcome: 'exists', ...rectOfNoScroll(btn) }
}

// Ground-truth check after clicking Send: did the modal actually close, or —
// failing that — did the button flip to "Pending"? Either is real confirmation
// from LinkedIn itself, unlike "the click call didn't error."
function checkConnectSent() {
  const modal = findConnectModal()
  if (!modal || !visible(modal)) return { outcome: 'done' }
  return { outcome: isPending() ? 'done' : 'not_sent' }
}

// ── People search ────────────────────────────────────────────────────────

// Walks every /in/ link on a search-results page rather than relying on card
// classes, which are hashed per build and change constantly. Skips anonymised
// "LinkedIn Member" entries (unreachable) and 1st-degree contacts (already
// connected), so the connect flow isn't fed people it will only reconcile.
const profileUrlOf = (a) => {
  const href = a.getAttribute('href') || ''
  const abs = href.startsWith('http') ? href : `https://www.linkedin.com${href}`
  const url = abs.split('?')[0].split('#')[0]
  return /linkedin\.com\/in\/[^/]+\/?$/.test(url) ? url : null
}

// The result link wraps the whole card, and LinkedIn prints the name twice (a
// visually-hidden copy for screen readers plus the visible one), so the raw text
// reads "John Duggan John Duggan • 2ndSenior Developer Advocate at Toast…".
// Take everything before the degree separator, then collapse the doubling.
function cleanResultName(raw) {
  let s = (raw || '').replace(/\s+/g, ' ').trim().split('•')[0].trim()
  // Decorative emoji/symbols people put in their display name ("✨ Tamir Peled")
  // would otherwise end up addressed in the invite note.
  s = s.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}.'’-]+$/u, '').trim()
  const words = s.split(' ')
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2
    if (words.slice(0, half).join(' ') === words.slice(half).join(' ')) {
      s = words.slice(0, half).join(' ')
    }
  }
  return s
}

// Headline is whatever follows the degree badge, minus the action buttons that
// are part of the same text run.
function headlineFrom(cardText, name) {
  let t = (cardText || '').replace(/\s+/g, ' ').trim()
  const deg = t.match(/•\s*(1st|2nd|3rd\+?)\s*/i)
  if (deg) t = t.slice(deg.index + deg[0].length)
  // No \b here: adjacent text nodes are concatenated without spaces, so the
  // action label arrives as "…United StatesConnectSenior Developer…" and a
  // word-boundary match never fires. Everything after it is LinkedIn's own
  // summary blurb, which just repeats the headline. "Pending" is the same slot
  // for someone already invited.
  t = t.split(/Connect|Message|Following|Follow|Pending|View profile|Visit my website/)[0]
  // Social proof tails LinkedIn appends to the card. This text ends up in the
  // lead's bio, which the AI reads when composing the invite note — so a stray
  // "Greg Dean is a mutual connection · 3K followers" can surface in outreach.
  t = t.replace(/·?\s*[\d.]+\s*K?\+?\s*followers?\b.*$/i, '')
  t = t.replace(/\s*[^|]{0,60}?\b(?:is a mutual connection|are mutual connections|other mutual connections?)\b.*$/i, '')
  if (name) t = t.split(name).join(' ')
  return t.replace(/\s+/g, ' ').replace(/[\s·|,-]+$/, '').trim().slice(0, 150)
}

function scrapeSearchResults() {
  const results = []
  const seen = new Set()

  // Work per result CARD, taking only its first profile link. Walking every
  // /in/ link on the page also picks up the "X is a mutual connection" links
  // that sit inside other people's cards — those aren't search results, and
  // scraping them turned a page of ~10 results into 27 bogus leads.
  const cards = queryAll('li, [role="listitem"]').filter((c) => visible(c) && !inAside(c))

  for (const card of cards) {
    const link = Array.from(card.querySelectorAll('a[href*="/in/"]')).find(profileUrlOf)
    if (!link) continue
    const url = profileUrlOf(link)
    if (!url || seen.has(url)) continue // also collapses nested cards

    const cardText = (card.textContent || '').replace(/\s+/g, ' ')
    // Match the degree BADGE, not a bare "1st" anywhere in the text — the loose
    // version threw false positives in the old worker.
    if (/•\s*1st\b/i.test(cardText)) continue // already connected

    const name = cleanResultName(link.textContent)
    if (!name || /linkedin member/i.test(name)) continue

    seen.add(url)
    results.push({ url, name, title: headlineFrom(cardText, name), location: '' })
  }

  return { outcome: 'ok', profiles: results }
}

// "Next" on the results pager. Returns coordinates for a trusted click — the
// pager is a normal in-flow button, so scrolling to it is correct here.
function rectSearchNext() {
  const btn = queryAll('button').find((b) =>
    visible(b) && !b.disabled &&
    /^next$/i.test((b.getAttribute('aria-label') || b.textContent || '').trim())
  )
  if (!btn) return { outcome: 'not_found' }
  return { outcome: 'exists', ...rectOf(btn) }
}

// Search pages render progressively; wait for the first profile link so an
// early scrape doesn't report an empty page as "no results".
async function waitForSearchResults() {
  const ok = await waitFor(() => queryAll('a[href*="/in/"]').some((a) => visible(a)), { timeout: 15000 })
  if (!ok) {
    const loggedOut = /\/login|\/checkpoint|\/authwall/.test(location.pathname)
    return { outcome: loggedOut ? 'logged_out' : 'no_results', url: location.pathname }
  }
  return { outcome: 'ready' }
}

// ── Diagnostics ─────────────────────────────────────────────────────────

function describe(el) {
  const r = el.getBoundingClientRect()
  const s = getComputedStyle(el)
  return {
    tag: el.tagName,
    role: el.getAttribute('role') || null,
    open: el.hasAttribute('open') ? true : null,
    cls: (el.className || '').toString().slice(0, 60),
    ckey: (el.getAttribute('componentkey') || '').slice(0, 70) || null,
    rect: `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.left)},${Math.round(r.top)}`,
    pos: s.position,
    display: s.display,
    vis: s.visibility,
    inShadow: el.getRootNode() !== document,
    text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
  }
}

// Dumps what the page ACTUALLY looks like while the invite modal is open, so we
// stop guessing at selectors: which of the current candidates match, and — found
// by its label text instead — where the real Send control lives and what its
// ancestor chain is.
function diagnoseModal() {
  const q = queryAll
  const candidates = q('.artdeco-modal, [role="dialog"], dialog').map(describe)

  // Find the send/note controls by their visible label, no structural assumptions.
  const labelRe = /^(send without a note|add a note|send)$/i
  const byLabel = q('button, a, [role="button"]')
    .filter((b) => labelRe.test((b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim()))
    .map((b) => ({
      ...describe(b),
      ancestors: (() => {
        const chain = []
        let p = b.parentElement
        while (p && chain.length < 12) {
          chain.push(`${p.tagName}${p.getAttribute('role') ? `[role=${p.getAttribute('role')}]` : ''}${p.className ? `.${(p.className || '').toString().split(/\s+/)[0].slice(0, 24)}` : ''}${p.hasAttribute('open') ? '[open]' : ''}`)
          p = p.parentElement
        }
        return chain
      })(),
    }))

  return {
    contentVersion: 'search-clean-bio',
    url: location.pathname,
    roots: allRoots().length,
    openDialogs: q('dialog[open]').map(describe),
    candidates,
    findConnectModal: findConnectModal() ? describe(findConnectModal()) : null,
    sendControls: byLabel,
    iframes: q('iframe').length,
  }
}


// ── Command router ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const syncHandlers = {
    rectConnectButton, rectMoreButton, rectConnectAddNote, checkConnectSent,
    scrapeSearchResults, rectSearchNext,
    diagnoseModal,
  }
  if (msg.cmd in syncHandlers) { sendResponse(syncHandlers[msg.cmd]()); return }

  const asyncHandlers = {
    afterConnectClick,
    rectConnectInMenu, rectConnectSend, waitForSearchResults,
    fillConnectNote: () => fillConnectNote(msg.text),
  }
  if (msg.cmd in asyncHandlers) {
    asyncHandlers[msg.cmd]()
      .then(sendResponse)
      .catch((e) => sendResponse({ outcome: 'failed', error: String(e && e.message ? e.message : e) }))
    return true // async
  }

  sendResponse({ outcome: 'failed', error: 'unknown cmd' })
})

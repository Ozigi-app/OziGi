// Ozigi LinkedIn Sender — background service worker.
//
// Orchestrates queued LinkedIn actions WITHOUT a headless server: it pulls the
// next action from Ozigi, drives the user's own logged-in LinkedIn tab to perform
// it, reports the outcome back, and paces everything to look human. Nothing runs
// unless the user is on Chrome with the extension enabled.
//
// Clicking uses the Chrome DevTools Protocol (chrome.debugger, Input domain)
// rather than content-script-dispatched events. LinkedIn's own click handlers
// check event.isTrusted before opening in-app overlays; a script-generated
// click (element.click() / dispatchEvent) is always isTrusted:false and gets
// silently ignored, so the link falls through to a raw href that only works via
// LinkedIn's internal router — a broken page on a cold load (confirmed in
// testing). CDP-dispatched input is indistinguishable from a real mouse click
// at the browser level, so it passes that check — this is the same mechanism
// Playwright/Puppeteer use for "real" clicks.
//
// Attaching chrome.debugger makes Chrome show a real, persistent "started
// debugging this browser" infobar on the tab — it's browser chrome, not page
// content, and it shrinks the tab's rendering viewport for as long as it stays
// attached. Rects were previously read from content.js BEFORE attaching (full
// viewport) and clicked AFTER attaching (shrunk viewport) — any element whose
// position depends on viewport height (LinkedIn's connect modal is vertically
// centered via a fixed/50% layout) had already moved by the infobar's height
// between the measurement and the dispatch, so the click silently missed with
// no error (confirmed root cause: same failure mode already hardened against
// for scrollIntoView, but recurring on every click). Fix: attach once per
// action, before the first rect is read, and hold it for the whole flow so
// every measurement and every click sees the identical (shrunk) viewport.

const DEFAULTS = {
  apiBase: 'https://ozigi.app',
  enabled: false,          // master on/off
  reviewMode: false,       // when true, ask the user before each send (handled in popup)
  // Messaging is OFF until the compose flow is trustworthy. LinkedIn's SDUI
  // profile only opens the message UI inside a hidden /preload iframe for this
  // session — no visible compose box exists to type into — and earlier attempts
  // produced a wrong-recipient send and a false 'done'. Connect is verified
  // against LinkedIn's own Pending state and ships on its own.
  messagingEnabled: false,
  dailyConnectCap: 20,
  dailyMessageCap: 25,
  minGapMs: 45_000,        // min delay between actions (jittered up)
  maxGapMs: 120_000,
}

const state = {
  running: false,          // an action is in flight
  nextAllowedAt: 0,        // pacing gate
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function cfg() {
  const s = await chrome.storage.local.get(Object.keys(DEFAULTS).concat(['token', 'counters']))
  return { ...DEFAULTS, ...s }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

async function getCounters() {
  const { counters } = await chrome.storage.local.get('counters')
  if (counters && counters.day === todayKey()) return counters
  const fresh = { day: todayKey(), connect: 0, message: 0 }
  await chrome.storage.local.set({ counters: fresh })
  return fresh
}

async function bumpCounter(action) {
  const c = await getCounters()
  if (action === 'connect') c.connect += 1
  else c.message += 1
  await chrome.storage.local.set({ counters: c })
  return c
}

async function api(path, opts, c) {
  const conf = c ?? await cfg()
  const res = await fetch(`${conf.apiBase}${path}`, {
    ...opts,
    headers: { 'Authorization': `Bearer ${conf.token}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  })
  return res
}

// ── Trusted clicks via CDP ──────────────────────────────────────────────

async function attachDebugger(tabId) {
  try {
    await chrome.debugger.attach({ tabId }, '1.3')
    return true
  } catch (e) {
    return false // another debugger (e.g. real DevTools) may already be attached
  }
}

async function detachDebugger(tabId) {
  try { await chrome.debugger.detach({ tabId }) } catch { /* already detached, e.g. tab navigated */ }
}

// Assumes the debugger is already attached for the whole action (see note
// above) — do not attach/detach per click, or measurements taken before this
// call will be stale by the time it dispatches.
async function dispatchClick(tabId, x, y) {
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await sleep(60)
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await sleep(60)
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    return true
  } catch (e) {
    return false
  }
}

async function dispatchKey(tabId, { key, code, keyCode }) {
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: keyCode, code, key })
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: keyCode, code, key })
    return true
  } catch { return false }
}

// Types into whatever is focused, through the browser's own input pipeline —
// the text equivalent of dispatchClick. Script-side insertion (execCommand,
// textContent) can put text in the DOM without LinkedIn's editor model ever
// registering it, which yields a box that looks filled but sends nothing.
async function dispatchInsertText(tabId, text) {
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Input.insertText', { text })
    return true
  } catch { return false }
}

const dispatchEnter = (tabId) => dispatchKey(tabId, { key: 'Enter', code: 'Enter', keyCode: 13 })
const dispatchEscape = (tabId) => dispatchKey(tabId, { key: 'Escape', code: 'Escape', keyCode: 27 })

// ── Tab / messaging helpers ─────────────────────────────────────────────

async function getLinkedInTab() {
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' })
  if (tabs.length) return tabs[0]
  return chrome.tabs.create({ url: 'https://www.linkedin.com/feed/', active: false })
}

function navigateAndWait(tabId, url) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        setTimeout(resolve, 2500) // settle for LinkedIn's SPA
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
    chrome.tabs.update(tabId, { url })
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve() }, 45_000)
  })
}

// After a trusted click that MIGHT cause a full page navigation, give the tab a
// moment to start, then — if it did navigate — wait for it to finish loading.
// If it didn't (inline overlay case), this just adds a short settle delay.
async function waitForTabSettle(tabId) {
  await sleep(1000)
  let tab
  try { tab = await chrome.tabs.get(tabId) } catch { return }
  if (tab.status !== 'loading') { await sleep(700); return }
  await new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        setTimeout(resolve, 1800)
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve() }, 25_000)
  })
}

function sendToContent(tabId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (chrome.runtime.lastError) return resolve({ outcome: 'retry_later', error: chrome.runtime.lastError.message })
      resolve(resp || { outcome: 'failed', error: 'no response from page' })
    })
  })
}

async function reportResult(id, outcome, error, c) {
  try {
    const res = await api('/api/gtm/linkedin/extension/result', { method: 'POST', body: JSON.stringify({ id, outcome, error }) }, c)
    // A silent failure here means the send happened but the queue never learned
    // about it — the item would be re-sent on a later tick, so it must be loud.
    if (!res.ok) console.warn('[ozigi] result POST failed:', res.status, (await res.text().catch(() => '')).slice(0, 200))
  } catch (e) {
    console.warn('[ozigi] result POST threw:', e) // item stays queued and retries
  }
}

// ── Action flows ─────────────────────────────────────────────────────────

async function runMessageAction(tabId, text, recipientName) {
  const startUrl = (await chrome.tabs.get(tabId).catch(() => null))?.url ?? ''

  // Every message step is anchored to this name. LinkedIn keeps chat bubbles open
  // across navigation, so without it the flow will happily type into whoever's
  // thread is on screen — that is how one lead's message was sent to another.
  if (!recipientName || !recipientName.trim()) {
    return { outcome: 'failed', error: 'no recipient name on the queue item — refusing to send blind' }
  }

  const attached = await attachDebugger(tabId)
  if (!attached) return { outcome: 'retry_later', error: 'debugger attach failed' }
  try {
    const check = await sendToContent(tabId, { cmd: 'rectMessageButton' })
    if (check.outcome !== 'exists') return check

    const clicked = await dispatchClick(tabId, check.x, check.y)
    if (!clicked) return { outcome: 'retry_later', error: 'trusted click failed' }

    await waitForTabSettle(tabId)

    // Locate the RECIPIENT's box, focus it with a trusted click, then type through
    // CDP. Focusing by real click also means a later Enter can only ever go to
    // this box — it is the one thing that makes an Enter-to-send safe.
    const boxRect = await sendToContent(tabId, { cmd: 'waitComposeBox', recipientName })
    if (boxRect.outcome !== 'exists') {
      const diag = await sendToContent(tabId, { cmd: 'diagnoseCompose', recipientName })
      console.warn('[ozigi] compose box not found:', boxRect.error, '\n', JSON.stringify(diag, null, 2))
      return { outcome: 'retry_later', error: boxRect.error || 'compose box not found' }
    }

    if (!await dispatchClick(tabId, boxRect.x, boxRect.y)) {
      return { outcome: 'retry_later', error: 'trusted click failed on compose box' }
    }
    await sleep(400)
    await dispatchInsertText(tabId, text)
    await sleep(600)

    let read = await sendToContent(tabId, { cmd: 'readComposeBox', recipientName })
    if (!read.chars) {
      // CDP typing didn't take (focus lost, or the box moved) — fall back to the
      // script-side fill before giving up.
      const filled = await sendToContent(tabId, { cmd: 'fillComposeBox', text, startUrl, recipientName })
      if (filled.outcome !== 'filled') {
        const diag = await sendToContent(tabId, { cmd: 'diagnoseCompose', recipientName })
        console.warn('[ozigi] compose failed:', filled.error, '\n', JSON.stringify(diag, null, 2))
        return filled
      }
      read = await sendToContent(tabId, { cmd: 'readComposeBox', recipientName })
    }
    console.log('[ozigi] compose box now holds', read.chars, 'chars')

    const sendRect = await sendToContent(tabId, { cmd: 'rectComposeSend', recipientName })
    if (sendRect.outcome === 'exists') {
      const ok = await dispatchClick(tabId, sendRect.x, sendRect.y)
      if (!ok) return { outcome: 'retry_later', error: 'trusted click failed on send button' }
    } else {
      return { outcome: 'retry_later', error: `send button not found in ${recipientName}'s thread — ${sendRect.error || ''}` }
    }
    await sleep(2000)

    // If the button click didn't take, try Enter — safe here ONLY because focus was
    // established by a trusted click inside this recipient's box above, so the
    // keystroke cannot land in someone else's thread.
    let confirmed = await sendToContent(tabId, { cmd: 'checkMessageSent', text, recipientName })
    if (confirmed.outcome !== 'done') {
      console.warn('[ozigi] send button click did not take, trying Enter. clicked:', sendRect)
      await dispatchClick(tabId, boxRect.x, boxRect.y)
      await sleep(300)
      await dispatchEnter(tabId)
      await sleep(2000)
      confirmed = await sendToContent(tabId, { cmd: 'checkMessageSent', text, recipientName })
    }

    // Verify against the thread itself. Returning 'done' because the click call
    // didn't throw marked a message as sent that never left the box — the queue
    // row went to 'done' and the lead would never be retried.
    const confirm = confirmed
    if (confirm.outcome !== 'done') {
      // Log where we actually clicked — a send that types fine but never leaves
      // the box is almost always a coordinate miss, not a selector miss.
      console.warn('[ozigi] send not confirmed. clicked:', sendRect, 'check:', confirm)
      return { outcome: 'retry_later', error: `message not confirmed in thread — ${confirm.error || confirm.outcome}` }
    }
    return { outcome: 'done' }
  } finally {
    await detachDebugger(tabId)
  }
}

// Opens the profile's "…" menu and returns the Connect item's coordinates.
// Only reached when the top card has no Connect button. If the menu has no
// Connect item either, THEN we can classify the lead — a 1st-degree connection's
// menu offers "Remove connection" instead, so absence here is the real signal.
async function openMoreMenuAndFindConnect(tabId, check) {
  const classify = () => check.hasMessage
    ? { outcome: 'done' }                                    // genuinely connected already
    : { outcome: 'not_connected', error: 'no connect control in top card or … menu (follow-only / private)' }

  if (!check.hasMore) return classify()

  const more = await sendToContent(tabId, { cmd: 'rectMoreButton' })
  if (more.outcome !== 'exists') return classify()

  if (!await dispatchClick(tabId, more.x, more.y)) {
    return { outcome: 'retry_later', error: 'trusted click failed on … menu' }
  }

  const item = await sendToContent(tabId, { cmd: 'rectConnectInMenu' })
  if (item.outcome !== 'exists') {
    await dispatchEscape(tabId) // leave the page as we found it
    return classify()
  }
  return item
}

async function runConnectAction(tabId, note) {
  const attached = await attachDebugger(tabId)
  if (!attached) return { outcome: 'retry_later', error: 'debugger attach failed' }
  try {
    const check = await sendToContent(tabId, { cmd: 'rectConnectButton' })
    if (check.outcome === 'done') return check

    let target = check
    if (check.outcome === 'no_top_card_connect') {
      // Connect lives in the "…" overflow menu on some profiles. Open it and look
      // there before concluding anything about this lead.
      const viaMenu = await openMoreMenuAndFindConnect(tabId, check)
      if (viaMenu.outcome !== 'exists') return viaMenu
      target = viaMenu
    } else if (check.outcome !== 'exists') {
      return { outcome: 'retry_later', error: `unexpected rectConnectButton result: ${check.outcome}` }
    }

    const clicked = await dispatchClick(tabId, target.x, target.y)
    if (!clicked) return { outcome: 'retry_later', error: 'trusted click failed' }

    const after = await sendToContent(tabId, { cmd: 'afterConnectClick' })
    if (after.outcome === 'no-modal') {
      // Some layouts genuinely send immediately with no modal — but a click that
      // silently did nothing looks identical from here, so verify before
      // declaring success: only trust this if the button now actually reads
      // "Pending" (confirmed bug: a modal-detection miss previously reported
      // "done" here while the request was never sent — LinkedIn's invite modal
      // is a native <dialog>, not always matched by className/role selectors).
      const verify = await sendToContent(tabId, { cmd: 'rectConnectButton' })
      return verify.outcome === 'done' ? { outcome: 'done' } : { outcome: 'retry_later', error: 'no modal appeared and button still shows Connect — click likely missed' }
    }

    if (note && note.trim()) {
      const noteRect = await sendToContent(tabId, { cmd: 'rectConnectAddNote' })
      if (noteRect.outcome === 'exists') {
        if (!await dispatchClick(tabId, noteRect.x, noteRect.y)) {
          return { outcome: 'retry_later', error: 'trusted click failed on Add a note' }
        }
        const filledNote = await sendToContent(tabId, { cmd: 'fillConnectNote', text: note })
        if (filledNote.outcome !== 'filled') {
          // We're now in the note stage with an empty box, where LinkedIn keeps
          // Send disabled — there is nothing useful left to click. Back out so the
          // page is clean for the retry rather than abandoning an open modal.
          await dispatchEscape(tabId)
          return { outcome: 'retry_later', error: `note not typed: ${filledNote.error || filledNote.outcome}` }
        }
      } else {
        // Deliberately falls through to a bare invite rather than skipping the
        // lead — but say so, since free accounts have a monthly cap on
        // personalized invites and hit this path once it runs out.
        console.warn('[ozigi] "Add a note" unavailable, sending bare invite:', noteRect)
      }
    }

    const sendRect = await sendToContent(tabId, { cmd: 'rectConnectSend' })
    if (sendRect.outcome !== 'exists') {
      return { outcome: 'retry_later', error: `connect send button not found — ${sendRect.error || sendRect.outcome}` }
    }
    const ok = await dispatchClick(tabId, sendRect.x, sendRect.y)
    if (!ok) return { outcome: 'retry_later', error: 'trusted click failed on connect send button' }
    await sleep(1200)

    // Verify against LinkedIn's own state — don't trust "the click call didn't
    // error" (confirmed bug: a stale-coordinate click reported success while the
    // modal stayed open and the invite was never actually sent).
    const confirm = await sendToContent(tabId, { cmd: 'checkConnectSent' })
    if (confirm.outcome !== 'done') return { outcome: 'retry_later', error: 'modal still open after clicking send — click likely missed' }
    return { outcome: 'done' }
  } finally {
    await detachDebugger(tabId)
  }
}

// Every early return here says why. This runs unattended on a 30s alarm, so the
// only way to tell "nothing was due" from "the token is wrong" or "the cap is
// hit" is the log — silence on all of them made a no-op impossible to diagnose.
const log = (...a) => console.log('[ozigi]', ...a)

async function tick() {
  if (state.running) return
  const c = await cfg()
  if (!c.enabled) return log('skip: not enabled')
  if (!c.token) return log('skip: no token set')
  if (Date.now() < state.nextAllowedAt) {
    return log(`skip: pacing, next run in ${Math.round((state.nextAllowedAt - Date.now()) / 1000)}s`)
  }

  state.running = true
  try {
    const counters = await getCounters()
    const res = await api('/api/gtm/linkedin/extension/pending?limit=1', { method: 'GET' }, c)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return log(`pending failed: HTTP ${res.status}`, body.slice(0, 200))
    }
    const { actions } = await res.json()
    const act = actions?.[0]
    if (!act) return log('nothing queued')

    const isConnect = act.action === 'connect'
    if (!isConnect && !c.messagingEnabled) {
      // Report 'not_connected' so the row reschedules a day out without burning an
      // attempt — the same treatment as "they haven't accepted yet". The lead stays
      // in the sequence and nothing is marked sent.
      log(`skip: messaging disabled, deferring ${act.action} for ${act.recipientName || act.profileUrl}`)
      await reportResult(act.id, 'not_connected', 'messaging disabled in extension', c)
      return
    }
    if (isConnect && counters.connect >= c.dailyConnectCap) return log(`skip: daily connect cap reached (${counters.connect}/${c.dailyConnectCap})`)
    if (!isConnect && counters.message >= c.dailyMessageCap) return log(`skip: daily message cap reached (${counters.message}/${c.dailyMessageCap})`)
    if (c.reviewMode) return log('skip: review mode on (manual sending not built yet)')

    log(`running ${act.action} → ${act.profileUrl}`)
    const tab = await getLinkedInTab()
    await navigateAndWait(tab.id, act.profileUrl)

    const result = isConnect
      ? await runConnectAction(tab.id, act.message)
      : await runMessageAction(tab.id, act.message, act.recipientName)

    log(`${act.action} result:`, result)
    await reportResult(act.id, result.outcome, result.error, c)
    if (result.outcome === 'done') await bumpCounter(act.action)

    const gap = c.minGapMs + Math.floor(Math.random() * (c.maxGapMs - c.minGapMs))
    state.nextAllowedAt = Date.now() + gap
  } catch (e) {
    log('tick threw:', e) // next tick retries
  } finally {
    state.running = false
  }
}

chrome.alarms.create('ozigi-tick', { periodInMinutes: 0.5 })
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'ozigi-tick') tick() })

// Run one action against a profile of your choosing, bypassing the queue, the
// API and the daily caps entirely — for verifying the browser-side mechanics
// (trusted clicks, modal handling, coordinate accuracy) without needing a
// linkedin_queue row or a running server. Call from the service worker console:
//   ozigiTest('https://www.linkedin.com/in/someone/')            // connect, no note
//   ozigiTest('https://www.linkedin.com/in/someone/', 'Hi …')    // connect with a note
// It sends a REAL invite from the signed-in account; it is not a dry run.
// Note: ozigiTest bypasses the messagingEnabled gate on purpose — it is the
// harness for getting the message flow working again.
async function testAction(profileUrl, note, action = 'connect', recipientName) {
  const tab = await getLinkedInTab()
  if (profileUrl) await navigateAndWait(tab.id, profileUrl)
  return action === 'connect'
    ? runConnectAction(tab.id, note)
    : runMessageAction(tab.id, note, recipientName)
}

// For a message test the 4th arg is required — it is what scopes every step to
// the intended recipient:
//   ozigiTest(url, 'hello', 'message', 'Their Name')
globalThis.ozigiTest = (profileUrl, note, action, recipientName) =>
  testAction(profileUrl, note, action, recipientName).then((r) => { console.log('[ozigi] result:', r); return r })

// Ask the page what it actually looks like right now — run it WHILE the invite
// modal is open to see which selectors match and where the real Send control is.
//   ozigiDiag()
globalThis.ozigiDiag = async () => {
  const tab = await getLinkedInTab()
  const d = await sendToContent(tab.id, { cmd: 'diagnoseModal' })
  console.log('[ozigi] diag:', JSON.stringify(d, null, 2))
  return d
}

// Run with the message compose overlay open: ozigiDiagCompose()
// Compact version — just the name-matched compose boxes. The full compose diag
// is long enough that this section scrolls off the top of the console.
globalThis.ozigiDiagBoxes = async (recipientName) => {
  const tab = await getLinkedInTab()
  const d = await sendToContent(tab.id, { cmd: 'diagnoseCompose', recipientName })
  console.log('[ozigi] namedBoxes:', JSON.stringify(d.namedBoxes ?? d, null, 2))
  return d.namedBoxes
}

globalThis.ozigiDiagCompose = async (recipientName) => {
  const tab = await getLinkedInTab()
  const d = await sendToContent(tab.id, { cmd: 'diagnoseCompose', recipientName })
  console.log('[ozigi] compose diag:', JSON.stringify(d, null, 2))
  return d
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'status') {
    (async () => {
      const c = await cfg()
      const counters = await getCounters()
      sendResponse({ enabled: c.enabled, reviewMode: c.reviewMode, hasToken: !!c.token, counters })
    })()
    return true
  }
  if (msg?.type === 'runNow') { tick(); sendResponse({ ok: true }); return true }
  if (msg?.type === 'testAction') {
    testAction(msg.profileUrl, msg.note, msg.action).then(sendResponse).catch((e) => sendResponse({ outcome: 'failed', error: String(e?.message ?? e) }))
    return true
  }
})

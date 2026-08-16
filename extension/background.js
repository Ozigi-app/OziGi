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
  dailyConnectCap: 20,
  minGapMs: 45_000,        // min delay between actions (jittered up)
  maxGapMs: 120_000,
}

const state = {
  running: false,          // an action is in flight
  nextAllowedAt: 0,        // pacing gate
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

// Bumped when a stored setting must be discarded rather than honoured. Values in
// chrome.storage win over DEFAULTS, so a cap set once during testing would
// otherwise throttle the extension forever with nothing in the UI to show why.
// v3 also drops reviewMode: it gated tick() but was never implemented, so anyone
// who ticked it had the pipeline silently stop with no way to tell why.
const SETTINGS_VERSION = 3

async function cfg() {
  const s = await chrome.storage.local.get(Object.keys(DEFAULTS).concat(['token', 'counters', 'settingsVersion']))
  if ((s.settingsVersion ?? 0) < SETTINGS_VERSION) {
    await chrome.storage.local.remove(['dailyConnectCap', 'dailyMessageCap', 'messagingEnabled', 'reviewMode'])
    await chrome.storage.local.set({ settingsVersion: SETTINGS_VERSION })
    delete s.dailyConnectCap
    delete s.dailyMessageCap
  }
  return { ...DEFAULTS, ...s }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

async function getCounters() {
  const { counters } = await chrome.storage.local.get('counters')
  if (counters && counters.day === todayKey()) return counters
  const fresh = { day: todayKey(), connect: 0, leads: 0 }
  await chrome.storage.local.set({ counters: fresh })
  return fresh
}

async function bumpCounter() {
  const c = await getCounters()
  c.connect += 1
  await chrome.storage.local.set({ counters: c })
  return c
}

async function bumpLeads(n) {
  const c = await getCounters()
  c.leads = (c.leads ?? 0) + n
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

const dispatchEscape = (tabId) => dispatchKey(tabId, { key: 'Escape', code: 'Escape', keyCode: 27 })

// ── Tab / page helpers ──────────────────────────────────────────────────

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

    let after = await sendToContent(tabId, { cmd: 'afterConnectClick' })
    if (after.outcome === 'no-modal') {
      // Give it one more window before concluding the click missed. Bailing here
      // strands a modal that mounts late: it opens with nothing driving it, and
      // the invite sits half-completed on screen.
      const stillConnect = await sendToContent(tabId, { cmd: 'rectConnectButton' })
      if (stillConnect.outcome === 'done') return { outcome: 'done' }
      after = await sendToContent(tabId, { cmd: 'afterConnectClick' })
    }
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

// Runs a LinkedIn people search in the user's own tab and posts the profiles
// back. This is the only source of leads carrying a linkedin_url, so without it
// the connect flow eventually runs dry no matter how well it works.
async function runSearchAction(tabId, job, c) {
  await navigateAndWait(tabId, job.searchUrl)

  const ready = await sendToContent(tabId, { cmd: 'waitForSearchResults' })
  if (ready.outcome === 'logged_out') {
    return { ok: false, error: 'LinkedIn session expired — sign in again in this browser' }
  }
  if (ready.outcome !== 'ready') return { ok: false, error: `no search results (${ready.url ?? ''})` }

  const attached = await attachDebugger(tabId)
  if (!attached) return { ok: false, error: 'debugger attach failed' }

  const profiles = []
  const seen = new Set()
  try {
    for (let page = 1; page <= 3 && profiles.length < job.limit; page++) {
      const res = await sendToContent(tabId, { cmd: 'scrapeSearchResults' })
      for (const p of res.profiles ?? []) {
        if (seen.has(p.url)) continue
        seen.add(p.url)
        profiles.push(p)
      }
      log(`search page ${page}: ${profiles.length} profiles so far`)
      if (profiles.length >= job.limit) break

      const next = await sendToContent(tabId, { cmd: 'rectSearchNext' })
      if (next.outcome !== 'exists') break
      if (!await dispatchClick(tabId, next.x, next.y)) break
      // Human-ish pause between pages; search is more rate-limit sensitive
      // than sending, so this is deliberately unhurried.
      await sleep(2500 + Math.floor(Math.random() * 2000))
      const more = await sendToContent(tabId, { cmd: 'waitForSearchResults' })
      if (more.outcome !== 'ready') break
    }
  } finally {
    await detachDebugger(tabId)
  }

  if (!profiles.length) return { ok: false, error: 'search returned no usable profiles' }

  const res = await api('/api/gtm/linkedin/extension/leads', {
    method: 'POST',
    body: JSON.stringify({ campaignId: job.campaignId, profiles: profiles.slice(0, job.limit) }),
  }, c)
  if (!res.ok) {
    return { ok: false, error: `leads POST failed: HTTP ${res.status}` }
  }
  const body = await res.json().catch(() => ({}))
  const inserted = body.inserted ?? 0
  if (inserted > 0) await bumpLeads(inserted)
  return { ok: true, found: profiles.length, inserted }
}

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
    if (!act) {
      // Nothing to send — see whether a people-search is due. Sending always wins
      // when both are available; searching only fills the funnel, and it is the
      // one thing that keeps the connect flow supplied, since every server-side
      // scraper stores linkedin_url as null.
      const sres = await api('/api/gtm/linkedin/extension/search', { method: 'GET' }, c)
      if (!sres.ok) return log(`nothing queued (search check: HTTP ${sres.status})`)
      const { job } = await sres.json()
      if (!job) return log('nothing queued, no search due')

      log(`running search for "${job.campaignName ?? job.campaignId}" → ${job.searchUrl}`)
      const searchTab = await getLinkedInTab()
      const out = await runSearchAction(searchTab.id, job, c)
      log('search result:', out)

      const searchGap = c.minGapMs + Math.floor(Math.random() * (c.maxGapMs - c.minGapMs))
      state.nextAllowedAt = Date.now() + searchGap
      return
    }

    // The connection request, with its note, is the whole LinkedIn channel.
    // Anything else is a leftover row from before messaging was dropped: skip it
    // permanently rather than deferring it forever.
    if (act.action !== 'connect') {
      log(`skip: ${act.action} steps are no longer sent — marking it done`)
      await reportResult(act.id, 'failed', 'LinkedIn messaging is no longer offered', c)
      return
    }
    if (counters.connect >= c.dailyConnectCap) return log(`skip: daily connect cap reached (${counters.connect}/${c.dailyConnectCap})`)

    log(`running connect → ${act.profileUrl}`)
    const tab = await getLinkedInTab()
    await navigateAndWait(tab.id, act.profileUrl)

    const result = await runConnectAction(tab.id, act.message)

    log('connect result:', result)
    await reportResult(act.id, result.outcome, result.error, c)
    if (result.outcome === 'done') await bumpCounter()

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
async function testAction(profileUrl, note) {
  const tab = await getLinkedInTab()
  if (profileUrl) await navigateAndWait(tab.id, profileUrl)
  return runConnectAction(tab.id, note)
}

globalThis.ozigiTest = (profileUrl, note) =>
  testAction(profileUrl, note).then((r) => { console.log('[ozigi] result:', r); return r })

// Ask the page what it actually looks like right now — run it WHILE the invite
// modal is open to see which selectors match and where the real Send control is.
//   ozigiDiag()
globalThis.ozigiDiag = async () => {
  const tab = await getLinkedInTab()
  const d = await sendToContent(tab.id, { cmd: 'diagnoseModal' })
  console.log('[ozigi] diag:', JSON.stringify(d, null, 2))
  return d
}

// Run a people-search now, without waiting for the queue to drain or the alarm
// to fire. With no argument it asks the server for the due job; pass a URL to
// search something specific:
//   ozigiSearch()
//   ozigiSearch('https://www.linkedin.com/search/results/people/?keywords=devrel')
globalThis.ozigiSearch = async (searchUrl) => {
  const c = await cfg()
  if (!c.token) { console.warn('[ozigi] no token set'); return }

  let job
  if (searchUrl) {
    const res = await api('/api/gtm/linkedin/extension/search', { method: 'GET' }, c)
    const body = res.ok ? await res.json().catch(() => ({})) : {}
    if (!body.job) { console.warn('[ozigi] no campaign available to attribute leads to'); return }
    job = { ...body.job, searchUrl }
  } else {
    const res = await api('/api/gtm/linkedin/extension/search', { method: 'GET' }, c)
    if (!res.ok) { console.warn('[ozigi] search endpoint HTTP', res.status); return }
    const body = await res.json().catch(() => ({}))
    if (!body.job) { console.warn('[ozigi] no search due (no active linkedin campaign, or already searched today)'); return }
    job = body.job
  }

  console.log('[ozigi] searching:', job.searchUrl)
  const tab = await getLinkedInTab()
  const out = await runSearchAction(tab.id, job, c)
  console.log('[ozigi] search result:', out)
  return out
}

// Scrape whatever search page is already open, without saving anything —
// checks the extraction in isolation from navigation and the API.
globalThis.ozigiScrapeHere = async () => {
  const tab = await getLinkedInTab()
  const r = await sendToContent(tab.id, { cmd: 'scrapeSearchResults' })
  console.log('[ozigi] scraped', r.profiles?.length ?? 0, 'profiles:', JSON.stringify((r.profiles ?? []).slice(0, 5), null, 2))
  return r.profiles
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'status') {
    (async () => {
      const c = await cfg()
      const counters = await getCounters()
      sendResponse({
        enabled: c.enabled, hasToken: !!c.token, counters,
        // Post-migration value, so the popup shows what is actually in force
        // rather than a stale override sitting in storage.
        dailyConnectCap: c.dailyConnectCap,
      })
    })()
    return true
  }
  if (msg?.type === 'runNow') { tick(); sendResponse({ ok: true }); return true }
  if (msg?.type === 'testAction') {
    testAction(msg.profileUrl, msg.note).then(sendResponse).catch((e) => sendResponse({ outcome: 'failed', error: String(e?.message ?? e) }))
    return true
  }
})

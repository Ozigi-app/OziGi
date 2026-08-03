# Ozigi LinkedIn engine (browser extension)

**This is Ozigi's LinkedIn pipeline.** It finds leads and sends connection
requests, both inside your own logged-in LinkedIn tab, at a human pace. Nothing
about LinkedIn happens server-side.

Ozigi sends **connection requests with a personalised note**. It does not send
LinkedIn messages or DMs — the request note is the whole channel.

## Why it lives in the browser

LinkedIn fingerprints and flags headless/server automation: it withholds the
Connect button and search results from flagged sessions, and will log you out.
Running inside *your* session sidesteps that — LinkedIn just sees you. The
server still does the parts that don't need a browser: scoring leads against
your ICP and writing the copy.

That split is why LinkedIn is the one source that can't come from a cron. Every
server-side scraper (GitHub, Dev.to, npm, Hacker News) stores `linkedin_url` as
null, so this extension is the only producer of leads the connect flow can act
on. With it switched off, LinkedIn outreach doesn't degrade — it stops.

## Install (Chrome / Edge)

1. Go to `chrome://extensions`, enable **Developer mode** (top right).
2. Click **Load unpacked** and select this `extension/` folder.
3. Pin the Ozigi icon.
4. In Ozigi → **GTM → Integrations**, copy your **connection token**.
5. Click the extension, paste the token, tick **Active**, and **Save**.
6. Keep a LinkedIn tab open while you work. That's it.

## How it works

Every 30 seconds the service worker asks Ozigi what to do next:

- **Send** — `/api/gtm/linkedin/extension/pending` returns the next due
  connection request. It navigates to the profile, sends the request with its
  note, and reports the outcome to `/result`, pacing the next one 45–120s later
  and respecting the daily cap.
- **Find** — when nothing is due to send, `/search` may return a people-search
  job built from a campaign's ICP (one per campaign per day, or on demand from
  the dashboard). It scrapes up to 3 result pages and posts the profiles to
  `/leads`, where they become leads with a `linkedin_url`.

Sending always takes priority; searching only fills the funnel. Nothing runs
when the browser is closed or **Active** is off.

## Controls (popup)

- **Active** — master on/off.
- **Review before sending** — pauses auto-send (manual review flow, coming next).
- **Connects / Leads found today** — live counters; connects run against the daily cap.
- **Run now** — process the next action immediately.

Status pill: **Active** (running), **Paused** (off), **No token** (set up but
unusable — it will silently do nothing until a token is saved).

## Debugging

Open `chrome://extensions` → **service worker** under the Ozigi card, then:

```js
ozigiTest('https://www.linkedin.com/in/someone/')            // connect, no note
ozigiTest('https://www.linkedin.com/in/someone/', 'Hi …')    // connect with a note
ozigiSearch()               // run the due search job now
ozigiSearch('https://www.linkedin.com/search/results/people/?keywords=devrel')
ozigiScrapeHere()           // scrape the open search page, saving nothing
ozigiDiag()                 // modal candidates — run with the invite modal open
tick()                      // run one real queue poll, logging why it skips
```

These bypass the queue, the API and the daily caps, and send for real —
`ozigiScrapeHere()` is the only read-only one.

Two gotchas that cost real debugging time:

- **Reloading the extension does not re-inject content scripts** into open tabs.
  Reload the LinkedIn tab too, or you are testing the old `content.js`. Every
  diagnostic reports `contentVersion` — bump it when you edit `content.js` so a
  stale injection is obvious.
- **Reloading the extension orphans the service worker console.** If `ozigiTest`
  is suddenly `undefined`, close the DevTools window, reload the extension, then
  reopen it from the **service worker** link.

## LinkedIn DOM notes (hard-won)

- Overlays live in **shadow roots**. `document.querySelectorAll` cannot see the
  invite modal at all. Use `queryAll()`, never `document` directly.
- There is a **hidden `/preload/?_bprMode=vanilla` iframe** carrying a second,
  never-displayed copy of LinkedIn's UI. Anything found inside it is real but
  invisible, so coordinates derived from it click nothing. `usableFrame()`
  deliberately skips it, along with any other hidden or off-screen frame.
- Never use `offsetParent !== null` as a visibility test: it is `null` for any
  `position: fixed` element, including a `showModal()`'d `<dialog>`.
- Never `scrollIntoView` before measuring a button in a fixed overlay. There is a
  content-script→background round trip before CDP dispatches, and any layout
  shift in that gap makes the click miss silently.
- Connect is **not always in the top card** — it is often in the "…" overflow
  menu, with Follow/Message taking the primary slots.
- A Message button with no Connect does **not** mean "already connected". Open
  Profile and 2nd-degree members show one too.

### Search results

- The result `<a>` wraps the **whole card**, and the name is printed twice (a
  visually-hidden copy for screen readers plus the visible one), so raw text
  reads `"John Duggan John Duggan • 2ndSenior Developer Advocate…"`.
- Adjacent text nodes concatenate with **no spaces**, so button labels arrive
  glued on (`…United StatesConnectSenior…`). Word-boundary matching never fires.
- Walk **result cards**, not links: the "X is a mutual connection" links live
  inside other people's cards, and link-walking turned 10 results into 27 leads.
- Filter already-connected on the degree **badge** (`• 1st`), never a bare
  `1st` — the loose version threw false positives.

## Notes

- Default API base is `https://ozigi.app`. For local testing, set `apiBase` to
  `http://localhost:3000` in the popup (already allowed by `host_permissions`;
  match patterns ignore the port).
- Daily caps and pacing live in `DEFAULTS` at the top of `background.js`. Values
  already saved in `chrome.storage` win over `DEFAULTS`, so to change one for an
  installed extension use e.g.
  `chrome.storage.local.set({ dailyConnectCap: 1 })` in the service worker console.
- Outcome semantics: `done` marks the row complete, `not_connected` retries in a
  day, `retry_later` retries in an hour, and only `failed` burns an attempt
  (3 strikes and the row fails permanently). Prefer `retry_later` over `done`
  when unsure — a false `done` silently drops a lead forever.

# Ozigi LinkedIn Sender (browser extension)

Sends your Ozigi-queued LinkedIn **connection requests** from your own browser,
inside your real logged-in LinkedIn tab — at a human pace.

> **Messaging is currently disabled** (`messagingEnabled: false` in `DEFAULTS`).
> Connect works and is verified against LinkedIn's own "Pending" state. Message
> rows are deferred a day at a time, untouched, until the compose flow is fixed —
> see [Messaging: why it's off](#messaging-why-its-off).

## Why this exists

LinkedIn fingerprints and flags headless/server automation (it withholds the
Message/Connect buttons from flagged sessions and can log you out). Running the
send from *your* browser session sidesteps all of that: LinkedIn just sees you.
Ozigi still does the heavy lifting on the server — finding leads and writing the
personalized copy — and this extension only performs the final action locally.

## Install (Chrome / Edge)

1. Go to `chrome://extensions`, enable **Developer mode** (top right).
2. Click **Load unpacked** and select this `extension/` folder.
3. Pin the Ozigi icon.
4. In Ozigi → **Settings → LinkedIn**, copy your **connection token**.
5. Click the extension, paste the token, tick **Enabled**, and **Save**.
6. Keep a LinkedIn tab open while you work. That's it.

## How it works

- The background worker polls Ozigi for the next due action (`/api/gtm/linkedin/extension/pending`).
- It navigates your LinkedIn tab to the lead's profile and asks the content
  script to perform the action (click Connect / open Message, type the text, send).
- It reports the outcome back (`/api/gtm/linkedin/extension/result`) and paces the
  next one with a jittered delay, respecting daily caps.
- Nothing runs when your browser is closed, or when **Enabled** is off.

## Controls (popup)

- **Enabled** — master on/off.
- **Review before sending** — pauses auto-send (manual review flow, coming next).
- **Connects / Messages today** — live counters against the daily caps.
- **Run now** — process the next action immediately.

## Debugging

Open `chrome://extensions` → **service worker** under the Ozigi card, then:

```js
ozigiTest('https://www.linkedin.com/in/someone/')            // connect, no note
ozigiTest('https://www.linkedin.com/in/someone/', 'Hi …')    // connect with a note
ozigiTest(url, 'text', 'message', 'Their Name')              // message (bypasses the gate)
ozigiDiag()                 // modal candidates — run with the invite modal open
ozigiDiagCompose('Name')    // full compose-side state
ozigiDiagBoxes('Name')      // just the name-matched compose boxes
tick()                      // run one real queue poll, logging why it skips
```

These bypass the queue, the API and the daily caps, and send for real.

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
  never-displayed copy of the messaging app. Typing into it "works" — the box
  reports the characters — but nothing is on screen and nothing ever sends.
  `usableFrame()` deliberately skips it.
- Never use `offsetParent !== null` as a visibility test: it is `null` for any
  `position: fixed` element, including a `showModal()`'d `<dialog>`.
- Never `scrollIntoView` before measuring a button in a fixed overlay. There is a
  content-script→background round trip before CDP dispatches, and any layout
  shift in that gap makes the click miss silently.
- Connect is **not always in the top card** — it is often in the "…" overflow
  menu, with Follow/Message taking the primary slots.
- A Message button with no Connect does **not** mean "already connected". Open
  Profile and 2nd-degree members show one too.

## Messaging: why it's off

The message flow produced two serious failures before being gated:

1. **A wrong-recipient send.** LinkedIn keeps chat bubbles open across
   navigation, so "the first compose box on the page" was the *previous* lead's.
   A message written for one person was typed into another's thread and sent.
   Fixed by anchoring every step to `recipientName` (`findComposeBoxFor`), which
   fails closed — but the fix is unproven end to end.
2. **A false `done`.** The flow returned success because the click call didn't
   throw, marking a queue row `done` for a message that never left the box. The
   lead would never be retried. `checkMessageSent` now requires the box to be
   empty *and* the text to appear in that recipient's own thread.

The blocker now: on the current SDUI profile layout, clicking **Message** never
produces a visible compose box in the top document — the UI only appears in the
hidden preload iframe. Until that is understood, `messagingEnabled` stays
`false`. Message rows are reported as `not_connected`, which reschedules them a
day out **without** burning an attempt or marking anything sent.

## Notes

- Default API base is `https://ozigi.app`. For local testing, set `apiBase` to
  `http://localhost:3000` in the popup (already allowed by `host_permissions`;
  match patterns ignore the port).
- Daily caps, pacing, and `messagingEnabled` live in `DEFAULTS` at the top of
  `background.js`. Values already saved in `chrome.storage` win over `DEFAULTS`,
  so to change one for an installed extension use e.g.
  `chrome.storage.local.set({ dailyConnectCap: 1 })` in the service worker console.
- Outcome semantics: `done` marks the row complete, `not_connected` retries in a
  day, `retry_later` retries in an hour, and only `failed` burns an attempt
  (3 strikes and the row fails permanently). Prefer `retry_later` over `done`
  when unsure — a false `done` silently drops a lead forever.

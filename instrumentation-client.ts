// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { CONSENT_EVENT, readConsent, type ConsentDecision } from "@/lib/consent";

Sentry.init({
  dsn: "https://0c22d3ac235eb3968f0b71ffab86dd67@o4511042432270336.ingest.de.sentry.io/4511042438758480",

  // Add optional integrations for additional features.
  //
  // maskAllText/blockAllMedia are Sentry's own defaults, but they are NOT the
  // defaults here: `sendDefaultPii: true` (set below) silently flips both to
  // false, which would ship the literal on-screen text of every recorded
  // session — draft content, lead lists, recipient addresses, and anything
  // pasted into /slop-checker — to Sentry. Pinning them back on keeps replays
  // useful for layout and interaction bugs without carrying user content off
  // the browser. Do not remove without deciding that trade deliberately.
  // Replay is added after consent instead of here — see startReplayOnConsent()
  // below. Errors and traces still report without it: those are operational
  // diagnostics rather than tracking, and carry no recording of the screen.
  integrations: [],

  // Every client trace, log and replay chunk is an HTTP POST from the browser.
  // Sampling these down cuts both Sentry quota and — because these are sent
  // from real user sessions — the volume of telemetry traffic we pay to carry.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  // Enable logs to be sent to Sentry
  enableLogs: process.env.NODE_ENV !== "production",

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

/**
 * Session Replay records real user sessions, so it is not "strictly necessary"
 * and must wait for consent. maskAllText/blockAllMedia are still pinned on for
 * the reason described above — consent governs whether we record at all, the
 * masking governs what a recording may contain, and both are wanted.
 */
let replayStarted = false;

function startReplay() {
  if (replayStarted) return;
  replayStarted = true;
  Sentry.addIntegration(Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }));
}

if (typeof window !== "undefined") {
  if (readConsent()?.decision === "granted") {
    startReplay();
  } else {
    window.addEventListener(CONSENT_EVENT, (event) => {
      if ((event as CustomEvent<ConsentDecision>).detail === "granted") startReplay();
    });
  }
}

/**
 * Cookie/tracking consent.
 *
 * The site loads a Google Ads tag (lib/gtag.ts, AW-*), which sets advertising
 * identifiers, plus Sentry Session Replay. Neither is "strictly necessary", so
 * both need consent before they may run.
 *
 * We use Google Consent Mode v2 rather than simply refusing to inject the tag:
 * the tag still loads, but with `ad_storage`/`analytics_storage` denied it
 * stores nothing and sends only cookieless pings, which is what lets Google
 * model conversions for users who decline. Defaults are set to "denied" in a
 * beforeInteractive script in app/layout.tsx so they are in place before the
 * Google tag evaluates them — if that ordering is ever broken, the tag reads
 * the implicit "granted" default and the consent gate silently stops working.
 *
 * Vercel Analytics/Speed Insights and Ghostly are cookieless and carry no
 * identifiers, so they are not gated here.
 */

export type ConsentDecision = 'granted' | 'denied';

export const CONSENT_STORAGE_KEY = 'ozigi.cookie-consent.v1';

/** Bumped when the tracker set changes, to re-ask people who already decided. */
export const CONSENT_VERSION = 1;

export interface StoredConsent {
  decision: ConsentDecision;
  version: number;
  /** ISO timestamp — evidence of when consent was given, for audit. */
  decidedAt: string;
}

export function readConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed?.version !== CONSENT_VERSION) return null;
    if (parsed.decision !== 'granted' && parsed.decision !== 'denied') return null;
    return parsed;
  } catch {
    // Private-mode or corrupted value — treat as undecided rather than throwing.
    return null;
  }
}

export function writeConsent(decision: ConsentDecision): StoredConsent {
  const record: StoredConsent = {
    decision,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable: the decision still applies to this page view via
    // applyConsent() below, we just cannot remember it.
  }
  return record;
}

/**
 * Push the decision into Google Consent Mode. Safe to call before the Google
 * tag has loaded: gtag() queues into dataLayer, which the tag drains on init.
 */
export function applyConsent(decision: ConsentDecision): void {
  if (typeof window === 'undefined') return;
  // Deliberately reached through a local cast rather than the ambient
  // Window.dataLayer declared in lib/gtag.ts, so this module type-checks on
  // its own and does not depend on that file being loaded first.
  const w = window as unknown as { dataLayer?: unknown[][] };
  const dataLayer = (w.dataLayer = w.dataLayer || []);
  // Pushing the raw args array is what gtag() does internally. We cannot call
  // window.gtag here: it only exists once the tag script runs, and a decision
  // made before then must still reach the queue.
  dataLayer.push([
    'consent',
    'update',
    {
      ad_storage: decision,
      ad_user_data: decision,
      ad_personalization: decision,
      analytics_storage: decision,
    },
  ]);
}

/** Emitted so other client code (e.g. Sentry Replay) can react to a decision. */
export const CONSENT_EVENT = 'ozigi:consent-change';

export function broadcastConsent(decision: ConsentDecision): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ConsentDecision>(CONSENT_EVENT, { detail: decision }));
}

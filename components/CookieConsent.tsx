"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  applyConsent,
  broadcastConsent,
  readConsent,
  writeConsent,
  type ConsentDecision,
} from "@/lib/consent";

/** Fire this to reopen the banner (e.g. a "Cookie settings" link in a footer). */
export const REOPEN_CONSENT_EVENT = "ozigi:consent-reopen";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    if (stored) {
      // Consent Mode defaults back to denied on every page load, so a previous
      // "accept" has to be re-applied here or the grant silently lapses after
      // the first navigation.
      applyConsent(stored.decision);
      broadcastConsent(stored.decision);
    } else {
      setVisible(true);
    }

    const reopen = () => setVisible(true);
    window.addEventListener(REOPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_CONSENT_EVENT, reopen);
  }, []);

  const decide = useCallback((decision: ConsentDecision) => {
    writeConsent(decision);
    applyConsent(decision);
    broadcastConsent(decision);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white p-4 shadow-lg sm:p-5"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-sm text-slate-600">
          We use cookies for advertising measurement and to diagnose errors.
          They are off until you accept. Essential cookies that keep you signed
          in are always on.{" "}
          <Link href="/cookie-policy" className="underline hover:text-slate-900">
            Cookie Policy
          </Link>
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reject all
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

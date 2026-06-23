"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const TIER_NAMES: Record<number, string> = {
  1: "Launch",
  2: "Builder",
  3: "Dominate",
};

const SESSION_KEY = "appsumo_pending_license_key";

async function redeemKey(licenseKey: string) {
  const res = await fetch("/api/appsumo/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ license_key: licenseKey.trim() }),
  });
  return { ok: res.ok, data: await res.json() };
}

function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [licenseKey, setLicenseKey] = useState(
    typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) ?? "" : ""
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    "loading-code" | "idle" | "signing-up" | "check-email" | "activating" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [activatedTier, setActivatedTier] = useState<number | null>(null);
  const autoSubmittedRef = useRef(false);
  const codeExchangedRef = useRef(false);

  // On mount: if AppSumo redirected with ?code=, exchange it for license details.
  // NOTE: Supabase's PKCE email-confirmation flow ALSO returns a ?code= param.
  // We mark our email-redirect URLs with ?confirmed=1 and skip the AppSumo
  // exchange in that case, otherwise we'd send Supabase's code to AppSumo and
  // get a (harmless but confusing) "Failed to exchange code" error.
  useEffect(() => {
    const code = searchParams.get("code");
    const isEmailConfirmation = searchParams.get("confirmed") === "1";
    if (code && !isEmailConfirmation && !codeExchangedRef.current) {
      codeExchangedRef.current = true;
      setStatus("loading-code");
      const finish = () => {
        // Strip the single-use code from the URL so a refresh or back-nav
        // never re-attempts the (now-consumed) exchange.
        window.history.replaceState({}, "", "/appsumo/activate");
      };
      fetch("/api/appsumo/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
        .then((r) => r.json())
        .then((data) => {
          finish();
          if (data.error) {
            // Non-fatal: if a key was already captured, just fall through to
            // the form/auto-redeem instead of showing a scary error.
            if (localStorage.getItem(SESSION_KEY)) { setStatus("idle"); return; }
            setErrorMsg(`Could not load your license: ${data.error}`);
            setStatus("error");
            return;
          }
          if (data.license_key) {
            setLicenseKey(data.license_key);
            localStorage.setItem(SESSION_KEY, data.license_key);
          }
          if (data.email) setEmail(data.email);
          setStatus("idle");
        })
        .catch((err) => {
          finish();
          if (localStorage.getItem(SESSION_KEY)) { setStatus("idle"); return; }
          setErrorMsg(`Network error: ${err?.message ?? "unknown"}`);
          setStatus("error");
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist key to localStorage (shared across tabs) so it survives the
  // email-confirmation redirect, which opens in a separate tab.
  useEffect(() => {
    if (licenseKey) localStorage.setItem(SESSION_KEY, licenseKey);
  }, [licenseKey]);

  // Auto-redeem when user becomes logged in (handles email confirmation return)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s && !autoSubmittedRef.current) {
        const key = licenseKey || localStorage.getItem(SESSION_KEY) || "";
        if (key) {
          autoSubmittedRef.current = true;
          setLicenseKey(key);
          setStatus("activating");
          redeemKey(key).then(({ ok, data }) => {
            if (ok) {
              localStorage.removeItem(SESSION_KEY);
              setActivatedTier(data.tier);
              setStatus("success");
              setTimeout(() => router.push("/dashboard"), 2500);
            } else {
              setStatus("error");
              setErrorMsg(data.error ?? "Something went wrong. Please try again.");
            }
          });
        }
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("signing-up");
    setErrorMsg("");
    localStorage.setItem(SESSION_KEY, licenseKey);

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        // ?confirmed=1 tells our mount effect this return carries a Supabase
        // PKCE code (not an AppSumo OAuth code), so we don't try to exchange it.
        emailRedirectTo: `${window.location.origin}/appsumo/activate?confirmed=1`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    // If email confirmation required, onAuthStateChange won't fire yet.
    // Show "check email" — clicking the link returns here and auto-redeem fires.
    setStatus("check-email");
  }

  if (status === "loading-code") {
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#E8320A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Loading your license details…</p>
        </div>
      </Shell>
    );
  }

  if (status === "error" && !licenseKey) {
    return (
      <Shell>
        <div className="text-center py-4">
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
            {errorMsg || "Something went wrong loading your license."}
          </p>
          <button
            onClick={() => { setStatus("idle"); setErrorMsg(""); }}
            className="text-sm text-slate-500 underline underline-offset-2"
          >
            Continue manually
          </button>
        </div>
      </Shell>
    );
  }

  if (status === "activating") {
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#E8320A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Activating your license…</p>
        </div>
      </Shell>
    );
  }

  if (status === "success") {
    return (
      <Shell>
        <div className="text-center py-4">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-xl font-black text-slate-900 mb-1">You're in!</h2>
          <p className="text-slate-600 text-sm">
            <strong>{TIER_NAMES[activatedTier!] ?? "AppSumo"}</strong> plan activated.
            Taking you to your dashboard…
          </p>
        </div>
      </Shell>
    );
  }

  if (status === "check-email") {
    return (
      <Shell>
        <div className="text-center py-4">
          <div className="text-4xl mb-3">📬</div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Check your email</h2>
          <p className="text-slate-500 text-sm">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it and your license will activate automatically.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-black text-slate-900 mb-1">Activate your license</h1>
      <p className="text-slate-500 text-sm mb-6">
        Create your Ozigi account and activate your AppSumo deal in one step.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            License key
          </label>
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            required
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        {status === "error" && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "signing-up" || !licenseKey.trim() || !email.trim() || !password}
          className="w-full bg-[#E8320A] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#d12d08] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "signing-up" ? "Creating account…" : "Create account & activate"}
        </button>
      </form>

      <p className="text-xs text-slate-400 text-center mt-5">
        Need help?{" "}
        <a href="mailto:hello@ozigi.app" className="underline underline-offset-2">
          hello@ozigi.app
        </a>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-2 mb-8">
          <img src="/favicon.ico" alt="Ozigi" className="w-7 h-7" />
          <span className="font-black text-xl tracking-tight text-slate-900">Ozigi</span>
          <span className="ml-2 text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            AppSumo
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AppSumoActivatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC]" />}>
      <ActivateForm />
    </Suspense>
  );
}

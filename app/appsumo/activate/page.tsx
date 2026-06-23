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

  const urlKey = searchParams.get("license_key") ?? "";
  const [licenseKey, setLicenseKey] = useState(
    urlKey || (typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) ?? "" : "")
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "signing-up" | "check-email" | "activating" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [activatedTier, setActivatedTier] = useState<number | null>(null);
  const autoSubmittedRef = useRef(false);

  // Persist key to sessionStorage so it survives email-confirmation redirects
  useEffect(() => {
    if (licenseKey) sessionStorage.setItem(SESSION_KEY, licenseKey);
  }, [licenseKey]);

  // When user returns after email confirmation, auto-redeem
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s && !autoSubmittedRef.current) {
        const key = licenseKey || sessionStorage.getItem(SESSION_KEY) || "";
        if (key) {
          autoSubmittedRef.current = true;
          setLicenseKey(key);
          setStatus("activating");
          redeemKey(key).then(({ ok, data }) => {
            if (ok) {
              sessionStorage.removeItem(SESSION_KEY);
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

    sessionStorage.setItem(SESSION_KEY, licenseKey);

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/appsumo/activate`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    // If Supabase requires email confirmation, onAuthStateChange won't fire yet
    // Show "check your email" — when they click the link they land back here and auto-redeem fires
    setStatus("check-email");
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-xl font-black text-slate-900 mb-1">You're in!</h2>
          <p className="text-slate-600 text-sm">
            <strong>{TIER_NAMES[activatedTier!] ?? "AppSumo"}</strong> plan activated.
            Taking you to your dashboard…
          </p>
        </div>
      </div>
    );
  }

  if (status === "activating") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#E8320A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Activating your license…</p>
        </div>
      </div>
    );
  }

  if (status === "check-email") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">📬</div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Check your email</h2>
          <p className="text-slate-500 text-sm">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it and your license will activate automatically.
          </p>
        </div>
      </div>
    );
  }

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
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Email
            </label>
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
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Password
            </label>
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

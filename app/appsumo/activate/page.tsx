"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import AuthModal from "@/components/AuthModal";

const TIER_NAMES: Record<number, string> = {
  1: "Launch",
  2: "Builder",
  3: "Dominate",
};

function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<any>(null);
  const [licenseKey, setLicenseKey] = useState(searchParams.get("license_key") ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [activatedTier, setActivatedTier] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!session) { setShowAuth(true); return; }

    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/appsumo/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: licenseKey.trim() }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setErrorMsg(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setActivatedTier(data.tier);
    setStatus("success");
    setTimeout(() => router.push("/dashboard"), 2500);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <img src="/favicon.ico" alt="Ozigi" className="w-7 h-7" />
          <span className="font-black text-xl tracking-tight text-slate-900">Ozigi</span>
          <span className="ml-2 text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            AppSumo
          </span>
        </div>

        {status === "success" ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-black text-slate-900 mb-1">You're in!</h2>
            <p className="text-slate-600 text-sm">
              <strong>{TIER_NAMES[activatedTier!] ?? "AppSumo"}</strong> plan activated.
              Taking you to your dashboard…
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-slate-900 mb-1">Activate your license</h1>
            <p className="text-slate-500 text-sm mb-6">
              Paste the license key from your AppSumo purchase confirmation below.
            </p>

            {!session && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
                You need to be signed in to activate your license.{" "}
                <button
                  onClick={() => setShowAuth(true)}
                  className="font-semibold underline underline-offset-2"
                >
                  Sign in or create an account
                </button>
              </div>
            )}

            <form onSubmit={handleRedeem} className="space-y-4">
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

              {status === "error" && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "loading" || !licenseKey.trim()}
                className="w-full bg-[#E8320A] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#d12d08] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "loading" ? "Activating…" : "Activate license"}
              </button>
            </form>

            <p className="text-xs text-slate-400 text-center mt-5">
              Need help?{" "}
              <a href="mailto:hello@ozigi.app" className="underline underline-offset-2">
                hello@ozigi.app
              </a>
            </p>
          </>
        )}
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
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

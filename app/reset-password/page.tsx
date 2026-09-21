"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase sends the recovery token in the URL hash — wait for the session
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setError(error.message); return; }
      // Recovery reset: revoke every other session so a login that was already
      // compromised cannot survive the password change. This session is kept.
      const { error: revokeError } = await supabase.auth.signOut({ scope: "others" });
      if (revokeError) console.error("Failed to revoke other sessions:", revokeError.message);
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 3000);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-offwhite flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="Ozigi" className="h-9 w-auto" />
          <span className="text-2xl font-black text-brand-navy tracking-tight">Ozigi</span>
        </div>

        {success ? (
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Password updated!</h2>
            <p className="text-sm text-slate-500 mb-6">
              Redirecting you to the dashboard…
            </p>
            <Link
              href="/dashboard"
              className="text-brand-red text-sm font-bold hover:underline"
            >
              Go now →
            </Link>
          </div>
        ) : !ready ? (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">Verifying your reset link…</p>
            <p className="text-xs text-slate-400 mt-3">
              If nothing happens,{" "}
              <Link href="/" className="text-brand-red hover:underline">
                go back and request a new link
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-black text-slate-900 mb-1">Choose a new password</h2>
            <p className="text-sm text-slate-500 mb-6">Must be at least 6 characters.</p>

            {error && (
              <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  required
                  minLength={8}
                  className="w-full bg-slate-50 text-slate-900 rounded-xl px-4 py-3 pr-10 border border-slate-200 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={8}
                className="w-full bg-slate-50 text-slate-900 rounded-xl px-4 py-3 border border-slate-200 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 text-sm transition-all"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-red text-white py-3 rounded-xl font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? "Updating…" : "Update Password"}
                {!isLoading && <ArrowRight size={16} />}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

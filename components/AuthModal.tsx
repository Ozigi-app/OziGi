"use client";
import { useState } from "react";
import { Provider } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { OAUTH_PROVIDERS, OAUTH_SCOPES } from "@/lib/platforms";
import { X, Mail, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";

type AuthView = "signin" | "signup" | "reset";

export default function AuthModal({
  onClose,
  defaultView = "signin",
  redirectTo,
}: {
  onClose: () => void;
  defaultView?: AuthView;
  /** After sign-in/up, redirect here instead of /dashboard. Defaults to /dashboard. */
  redirectTo?: string;
}) {
  const [view, setView] = useState<AuthView>(defaultView);
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  // Email/password state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleOAuthSignIn = async (provider: Provider) => {
    setLoadingProvider(provider);
    setError("");
    
    let scopes = undefined;
    if (provider === OAUTH_PROVIDERS.X) {
      scopes = OAUTH_SCOPES.X;
    } else if (provider === OAUTH_PROVIDERS.LINKEDIN) {
      scopes = OAUTH_SCOPES.LINKEDIN;
    }

    const next = redirectTo ?? window.location.pathname;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: scopes,
      },
    });

    if (error) {
      console.error(`Error with ${provider} login:`, error);
      setError(error.message);
      setLoadingProvider(null);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please try again or create an account.");
        } else if (error.message.includes("Email not confirmed")) {
          setError("Please check your email and confirm your account first.");
        } else {
          setError(error.message);
        }
        return;
      }
      
      onClose();
      window.location.href = redirectTo ?? "/dashboard";
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      });
      
      if (signUpError) {
        if (signUpError.message.includes("User already registered")) {
          setError("An account with this email already exists. Please sign in instead.");
        } else if (signUpError.message.includes("Password should be")) {
          setError("Password must be at least 6 characters long.");
        } else {
          setError(signUpError.message);
        }
        return;
      }
      
      setSuccess("Account created! Check your email to confirm, then sign in.");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setError("");
    setSuccess("");
  };

  const switchView = (newView: AuthView) => {
    resetForm();
    setView(newView);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess("Check your email — we sent a password reset link.");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Compact OAuth buttons
  const OAuthButtons = () => (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => handleOAuthSignIn("google")}
        disabled={!!loadingProvider}
        className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50 px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {loadingProvider === "google" ? "..." : "Google"}
      </button>

      <button
        onClick={() => handleOAuthSignIn("linkedin_oidc")}
        disabled={!!loadingProvider}
        className="flex items-center justify-center gap-2 bg-[#0A66C2] text-white hover:bg-[#084e96] px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        {loadingProvider === "linkedin_oidc" ? "..." : "LinkedIn"}
      </button>

      <button
        onClick={() => handleOAuthSignIn(OAUTH_PROVIDERS.X as Provider)}
        disabled={!!loadingProvider}
        className="flex items-center justify-center gap-2 bg-black text-white hover:bg-slate-800 px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        {loadingProvider === "twitter" ? "..." : "X"}
      </button>

      <button
        onClick={() => handleOAuthSignIn("github")}
        disabled={!!loadingProvider}
        className="flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-700 px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        {loadingProvider === "github" ? "..." : "GitHub"}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Header with logo */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="Ozigi" className="h-10 w-auto" />
            <span className="text-2xl font-black text-brand-navy tracking-tight">Ozigi</span>
          </div>
          
          {/* View toggle tabs — hidden on reset view */}
          {view !== "reset" && (
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              <button
                onClick={() => switchView("signin")}
                className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${
                  view === "signin"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => switchView("signup")}
                className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${
                  view === "signup"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Create Account
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 flex items-start gap-2 bg-green-50 border border-green-200 text-green-700 px-3 py-2.5 rounded-xl text-sm">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Sign In View */}
          {view === "signin" && (
            <>
              <OAuthButtons />
              
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-slate-400 font-medium">or with email</span>
                </div>
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 text-brand-slate rounded-xl px-4 py-3 border border-slate-200 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 text-sm transition-all"
                  placeholder="Email address"
                  required
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 rounded-xl text-brand-slate px-4 py-3 pr-10 border border-slate-200 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 text-sm transition-all"
                    placeholder="Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchView("reset")}
                    className="text-xs text-slate-400 hover:text-brand-red transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand-red text-white py-3 rounded-xl font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                  {!isLoading && <ArrowRight size={16} />}
                </button>
              </form>
            </>
          )}

          {/* Password Reset View */}
          {view === "reset" && (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-black text-slate-900 mb-1">Reset your password</h3>
                <p className="text-sm text-slate-500">
                  Enter your email and we'll send you a link to get back in.
                </p>
              </div>
              <form onSubmit={handlePasswordReset} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 text-brand-slate rounded-xl px-4 py-3 border border-slate-200 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 text-sm transition-all"
                  placeholder="Email address"
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand-red text-white py-3 rounded-xl font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                  {!isLoading && <ArrowRight size={16} />}
                </button>
              </form>
              <button
                onClick={() => switchView("signin")}
                className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-700 transition-colors"
              >
                ← Back to sign in
              </button>
            </>
          )}

          {/* Sign Up View */}
          {view === "signup" && (
            <>
              <OAuthButtons />
              
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-slate-400 font-medium">or with email</span>
                </div>
              </div>

              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 text-sm transition-all"
                  placeholder="Full name"
                  required
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 text-sm transition-all"
                  placeholder="Email address"
                  required
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 rounded-xl px-4 py-3 pr-10 border border-slate-200 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 text-sm transition-all"
                    placeholder="Password (min 6 characters)"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand-red text-white py-3 rounded-xl font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? "Creating account..." : "Create Account"}
                  {!isLoading && <ArrowRight size={16} />}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-slate-400 mt-5">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

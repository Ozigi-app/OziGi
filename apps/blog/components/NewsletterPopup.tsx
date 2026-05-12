"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MAIN_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ozigi.app";

const STORAGE_KEY = "founders_thoughts_dismissed";

export default function NewsletterPopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const onScroll = () => {
      if (window.scrollY > 600) {
        setVisible(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  }

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");

    const res = await fetch(`${MAIN_APP_URL}/api/newsletter/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    if (res.ok) {
      setStatus("success");
      localStorage.setItem(STORAGE_KEY, "1");
    } else {
      setStatus("error");
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="fixed bottom-6 right-6 z-50 w-[320px] rounded-2xl overflow-hidden"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(15,23,42,0.10)",
            boxShadow: "0 24px 64px rgba(15,23,42,0.14), 0 4px 16px rgba(232,50,10,0.08)",
          }}
          role="dialog"
          aria-label="Subscribe to Founder's Thoughts newsletter"
        >
          <div className="h-1 w-full" style={{ background: "linear-gradient(to right, #E8320A, #c52000)" }} />

          <div className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] mb-0.5 text-brand-red">
                  Newsletter
                </p>
                <h3 className="text-base font-black italic uppercase tracking-tight leading-tight text-slate-900">
                  Founder&apos;s Thoughts
                </h3>
              </div>
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="text-slate-400 hover:text-slate-700 transition-colors mt-0.5 cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {status === "success" ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-3 text-center"
              >
                <p className="text-2xl mb-2">✓</p>
                <p className="text-sm font-black uppercase tracking-tight text-slate-900">You&apos;re in!</p>
                <p className="text-xs mt-1 text-slate-500">We&apos;ll be in touch soon.</p>
              </motion.div>
            ) : (
              <>
                <p className="text-xs leading-relaxed mb-4 text-slate-600">
                  Founder insights, product thinking, and what we&apos;re building — straight to your inbox.
                </p>
                <form onSubmit={subscribe} className="flex flex-col gap-2.5">
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 bg-slate-50 border border-slate-200 focus:border-brand-red text-slate-900"
                  />
                  {status === "error" && (
                    <p className="text-[11px] text-brand-red">Something went wrong. Please try again.</p>
                  )}
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #E8320A 0%, #c52000 100%)" }}
                  >
                    {status === "loading" ? "Subscribing…" : "Subscribe →"}
                  </button>
                </form>
                <p className="text-[10px] text-center mt-2.5 text-slate-400">
                  No spam. Unsubscribe anytime.
                </p>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

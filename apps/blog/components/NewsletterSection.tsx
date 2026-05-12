"use client";
import { useState } from "react";

const MAIN_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ozigi.app";

export default function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

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
    } else {
      setStatus("error");
    }
  }

  return (
    <section className="bg-slate-950 py-20 px-6 mt-12">
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4 text-brand-red">
          Newsletter
        </p>
        <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95] text-white mb-5">
          Founder&apos;s<br />Thoughts
        </h2>
        <p className="text-base font-medium mb-8 text-slate-400 max-w-md mx-auto">
          Founder insights, product thinking, and what we&apos;re building — straight to your inbox. No noise, no fluff.
        </p>

        {status === "success" ? (
          <div className="inline-flex flex-col items-center gap-2 px-8 py-5 rounded-2xl bg-slate-800 border border-slate-700">
            <p className="text-lg font-black uppercase tracking-tight text-white">You&apos;re in!</p>
            <p className="text-sm text-slate-400">We&apos;ll be in touch soon.</p>
          </div>
        ) : (
          <form onSubmit={subscribe} className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 bg-slate-800 border border-slate-700 focus:border-brand-red text-white placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-60 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #E8320A 0%, #c52000 100%)" }}
            >
              {status === "loading" ? "…" : "Subscribe →"}
            </button>
          </form>
        )}

        {status === "error" && (
          <p className="text-xs mt-3 text-brand-red">Something went wrong. Please try again.</p>
        )}

        <p className="text-[10px] mt-4 text-slate-600">No spam. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}

"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Copy, Check, Mail } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import { SignUpGate, PostGenerationBanner } from "@/components/demo/SignUpGate";
import { supabase } from "@/lib/supabase/client";

const STORAGE_KEY = "ozigi_demo_email_outreach";

function track(event: string, properties?: Record<string, unknown>) {
  fetch("/api/demo/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties }),
  }).catch(() => {});
}

export default function EmailOutreachPage() {
  const [senderName, setSenderName] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [targetDescription, setTargetDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ subject: string; body: string } | null>(null);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track("demo_page_viewed", { page: "email_outreach" });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setIsAuthenticated(true);
    });
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setResult(parsed.result);
        setHasGeneratedOnce(true);
      } catch {}
    }
  }, []);

  const handleGenerate = async () => {
    if (!senderName.trim() || !productName.trim() || !productDescription.trim() || !targetDescription.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }

    if (!isAuthenticated && hasGeneratedOnce) {
      setShowGate(true);
      track("demo_gate_shown", { page: "email_outreach" });
      return;
    }

    setLoading(true);
    setResult(null);
    track("demo_generate_clicked", { page: "email_outreach", authenticated: isAuthenticated });

    try {
      const res = await fetch("/api/demo/email-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName, productName, productDescription, targetDescription }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "demo_limit_reached") {
          setHasGeneratedOnce(true);
          setShowGate(true);
          track("demo_gate_shown", { page: "email_outreach", reason: "limit_reached" });
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setResult(data);
      setHasGeneratedOnce(true);

      if (!isAuthenticated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ result: data, params: { senderName, productName, productDescription, targetDescription } }));
      }

      track("demo_generate_succeeded", { page: "email_outreach", authenticated: isAuthenticated });
      toast.success("Email generated!");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: any) {
      toast.error(err.message || "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Ozigi" className="h-8 w-auto" />
            <span className="text-xl font-black text-[#0A1628] tracking-tighter">Ozigi</span>
          </Link>
          <button
            onClick={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "email_outreach", location: "header" }); }}
            className="bg-[#E8320A] hover:bg-[#C5280A] text-white text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all"
          >
            Sign Up Free
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#E8320A]/10 text-[#E8320A] text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            <Mail className="w-3.5 h-3.5" />
            Cold Email Generator
          </div>
          <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-[#0A1628] leading-[0.9] mb-5">
            Cold emails that get
            <br />
            <span className="text-[#E8320A]">replies, not unsubscribes.</span>
          </h1>
          <p className="text-slate-600 text-lg max-w-xl mx-auto">
            Describe your product and who you're targeting — get a personalised first-touch email in seconds.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Your Name *</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Alex Chen"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Product Name *</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Ozigi"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-600 mb-1.5">What does your product do? *</label>
            <textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="e.g. Ozigi helps founders automate cold outreach by scraping leads from GitHub and generating personalised emails and LinkedIn messages."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30 resize-none"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Who are you targeting? *</label>
            <textarea
              value={targetDescription}
              onChange={(e) => setTargetDescription(e.target.value)}
              placeholder="e.g. CTOs at early-stage B2B SaaS startups who are actively hiring engineers and building their go-to-market motion."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30 resize-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-[#E8320A] hover:bg-[#C5280A] disabled:opacity-60 text-white font-black uppercase tracking-widest text-sm px-6 py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : "Generate Email →"}
          </button>
        </div>

        <AnimatePresence>
          {showGate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <SignUpGate
                toolName="email"
                onSignUp={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "email_outreach", location: "gate" }); }}
                onViewResult={() => setShowGate(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {result && !showGate && (
            <motion.div
              ref={resultRef}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                {/* Subject */}
                <div className="mb-6 pb-6 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subject Line</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(result.subject); setCopiedSubject(true); setTimeout(() => setCopiedSubject(false), 2000); }}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#E8320A] transition-colors"
                    >
                      {copiedSubject ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedSubject ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="font-bold text-lg text-[#0A1628]">{result.subject}</p>
                </div>

                {/* Body */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Body</span>
                    <button
                      onClick={() => {
                        const text = result.body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                        navigator.clipboard.writeText(text);
                        setCopiedBody(true);
                        setTimeout(() => setCopiedBody(false), 2000);
                      }}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#E8320A] transition-colors"
                    >
                      {copiedBody ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedBody ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div
                    className="prose prose-sm prose-slate max-w-none"
                    dangerouslySetInnerHTML={{ __html: result.body }}
                  />
                </div>
              </div>

              {!isAuthenticated && (
                <PostGenerationBanner
                  onSignUp={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "email_outreach", location: "post_generation" }); }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isAuthModalOpen && (
        <AuthModal
          onClose={() => setIsAuthModalOpen(false)}
          defaultView="signup"
          redirectTo={typeof window !== "undefined" ? window.location.pathname : "/email-outreach"}
        />
      )}
    </div>
  );
}

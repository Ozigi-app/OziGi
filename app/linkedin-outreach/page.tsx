"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Copy, Check, Share2 } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import { SignUpGate, PostGenerationBanner } from "@/components/demo/SignUpGate";
import { LeadListTeaser } from "@/components/demo/LeadListTeaser";
import { supabase } from "@/lib/supabase/client";

const STORAGE_KEY = "ozigi_demo_linkedin_outreach";

function track(event: string, properties?: Record<string, unknown>) {
  fetch("/api/demo/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties }),
  }).catch(() => {});
}

export default function LinkedInOutreachPage() {
  const [senderName, setSenderName] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [targetDescription, setTargetDescription] = useState("");
  const [messageType, setMessageType] = useState<"connect" | "message">("connect");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track("demo_page_viewed", { page: "linkedin_outreach" });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setIsAuthenticated(true);
    });
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMessage(parsed.message);
        setHasGeneratedOnce(true);
      } catch {}
    }
  }, []);

  const handleGenerate = async () => {
    if (!senderName.trim() || !productName.trim() || !targetDescription.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (!isAuthenticated && hasGeneratedOnce) {
      setShowGate(true);
      track("demo_gate_shown", { page: "linkedin_outreach" });
      return;
    }

    setLoading(true);
    setMessage(null);
    track("demo_generate_clicked", { page: "linkedin_outreach", messageType, authenticated: isAuthenticated });

    try {
      const res = await fetch("/api/demo/linkedin-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName, productName, productDescription, targetDescription, messageType }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "demo_limit_reached") {
          setHasGeneratedOnce(true);
          setShowGate(true);
          track("demo_gate_shown", { page: "linkedin_outreach", reason: "limit_reached" });
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setMessage(data.message);
      setHasGeneratedOnce(true);

      if (!isAuthenticated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ message: data.message, params: { senderName, productName, productDescription, targetDescription, messageType } }));
      }

      track("demo_generate_succeeded", { page: "linkedin_outreach", messageType, authenticated: isAuthenticated, charCount: data.message?.length });
      toast.success("Message generated!");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: any) {
      toast.error(err.message || "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const charCount = message?.length ?? 0;
  const charLimit = messageType === "connect" ? 300 : 2000;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Ozigi" className="h-8 w-auto" />
            <span className="text-xl font-black text-[#0A1628] tracking-tighter">Ozigi</span>
          </Link>
          <button
            onClick={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "linkedin_outreach", location: "header" }); }}
            className="bg-[#E8320A] hover:bg-[#C5280A] text-white text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all"
          >
            Sign Up Free
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#0077B5]/10 text-[#0077B5] text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            <Share2 className="w-3.5 h-3.5" />
            LinkedIn Outreach Generator
          </div>
          <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-[#0A1628] leading-[0.9] mb-5">
            LinkedIn messages that
            <br />
            <span className="text-[#E8320A]">don't get ignored.</span>
          </h1>
          <p className="text-slate-600 text-lg max-w-xl mx-auto">
            Generate personalised connection requests and follow-up messages — specific, human, and under the character limit.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-8">
          {/* Message type toggle */}
          <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
            {(["connect", "message"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setMessageType(type)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  messageType === type
                    ? "bg-white text-[#0A1628] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {type === "connect" ? "Connection Request" : "Direct Message"}
              </button>
            ))}
          </div>

          {messageType === "connect" && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4 font-medium">
              Connection notes have a 300 character limit — the AI will keep it tight.
            </p>
          )}

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
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Product / Company Name *</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Ozigi"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30"
              />
            </div>
          </div>

          {messageType === "message" && (
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-600 mb-1.5">What does your product do?</label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="e.g. Automates cold outreach by finding technical leads from GitHub and writing personalised messages."
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30 resize-none"
              />
            </div>
          )}

          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Who are you reaching out to? *</label>
            <textarea
              value={targetDescription}
              onChange={(e) => setTargetDescription(e.target.value)}
              placeholder="e.g. Founder of an early-stage DevTools startup, open-source contributor on GitHub, based in London, building a CI/CD product."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30 resize-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-[#E8320A] hover:bg-[#C5280A] disabled:opacity-60 text-white font-black uppercase tracking-widest text-sm px-6 py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : "Generate Message →"}
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
                toolName="message"
                onSignUp={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "linkedin_outreach", location: "gate" }); }}
                onViewResult={() => setShowGate(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {message && !showGate && (
            <motion.div
              ref={resultRef}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {messageType === "connect" ? "Connection Request Note" : "LinkedIn Message"}
                    </span>
                    <p className={`text-xs mt-1 font-medium ${charCount > charLimit ? "text-red-500" : "text-slate-400"}`}>
                      {charCount} / {charLimit} characters
                    </p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#E8320A] border border-slate-200 hover:border-[#E8320A]/40 px-4 py-2 rounded-lg transition-all"
                  >
                    {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{message}</p>
              </div>

              {!isAuthenticated && (
                <PostGenerationBanner
                  onSignUp={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "linkedin_outreach", location: "post_generation" }); }}
                />
              )}

              <LeadListTeaser
                type="linkedin"
                isAuthenticated={isAuthenticated}
                onSignUp={() => {
                  if (isAuthenticated) {
                    window.location.href = "/dashboard/gtm/linkedin";
                  } else {
                    setIsAuthModalOpen(true);
                    track("demo_signup_clicked", { page: "linkedin_outreach", location: "lead_teaser" });
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isAuthModalOpen && (
        <AuthModal
          onClose={() => setIsAuthModalOpen(false)}
          defaultView="signup"
          redirectTo={typeof window !== "undefined" ? window.location.pathname : "/linkedin-outreach"}
        />
      )}
    </div>
  );
}

"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Copy, Check, Inbox } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import { SignUpGate, PostGenerationBanner } from "@/components/demo/SignUpGate";
import { supabase } from "@/lib/supabase/client";

const STORAGE_KEY = "ozigi_demo_newsletter";

const TONE_OPTIONS = [
  { value: "conversational", label: "Conversational" },
  { value: "opinionated", label: "Opinionated" },
  { value: "analytical", label: "Analytical" },
  { value: "storytelling", label: "Storytelling" },
];

function track(event: string, properties?: Record<string, unknown>) {
  fetch("/api/demo/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties }),
  }).catch(() => {});
}

export default function NewsletterPage() {
  const [topic, setTopic] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [tone, setTone] = useState("conversational");
  const [authorName, setAuthorName] = useState("");

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
    track("demo_page_viewed", { page: "newsletter" });
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
    if (!topic.trim()) {
      toast.error("Please enter a topic.");
      return;
    }

    if (!isAuthenticated && hasGeneratedOnce) {
      setShowGate(true);
      track("demo_gate_shown", { page: "newsletter" });
      return;
    }

    setLoading(true);
    setResult(null);
    track("demo_generate_clicked", { page: "newsletter", tone, authenticated: isAuthenticated });

    try {
      const res = await fetch("/api/demo/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, keyPoints, tone, authorName }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "demo_limit_reached") {
          setHasGeneratedOnce(true);
          setShowGate(true);
          track("demo_gate_shown", { page: "newsletter", reason: "limit_reached" });
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ result: data, params: { topic, keyPoints, tone, authorName } }));
      }

      track("demo_generate_succeeded", { page: "newsletter", tone, authenticated: isAuthenticated });
      toast.success("Newsletter generated!");
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
            onClick={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "newsletter", location: "header" }); }}
            className="bg-[#E8320A] hover:bg-[#C5280A] text-white text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all"
          >
            Sign Up Free
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#E8320A]/10 text-[#E8320A] text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            <Inbox className="w-3.5 h-3.5" />
            Newsletter Generator
          </div>
          <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-[#0A1628] leading-[0.9] mb-5">
            Newsletters people
            <br />
            <span className="text-[#E8320A]">actually open and read.</span>
          </h1>
          <p className="text-slate-600 text-lg max-w-xl mx-auto">
            Give us a topic and key points — get a full issue in your voice, with a subject line that earns opens.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-8">
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Newsletter Topic *</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Why most founders fail at content marketing — and what the few who succeed do differently"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Key Points to Cover <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              placeholder={"e.g.\n- Most founders treat content as a vanity metric\n- The ones who win treat it as a distribution channel first\n- Specific example: how X grew to 50k subscribers by posting frameworks not opinions"}
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30"
              >
                {TONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Author Name <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g. Sam"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-[#E8320A] hover:bg-[#C5280A] disabled:opacity-60 text-white font-black uppercase tracking-widest text-sm px-6 py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : "Generate Newsletter →"}
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
                toolName="newsletter"
                onSignUp={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "newsletter", location: "gate" }); }}
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

                {/* Newsletter body */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Newsletter Body</span>
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
                    className="prose prose-slate max-w-none"
                    dangerouslySetInnerHTML={{ __html: result.body }}
                  />
                </div>
              </div>

              {!isAuthenticated && (
                <PostGenerationBanner
                  onSignUp={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "newsletter", location: "post_generation" }); }}
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
          redirectTo={typeof window !== "undefined" ? window.location.pathname : "/newsletter"}
        />
      )}
    </div>
  );
}

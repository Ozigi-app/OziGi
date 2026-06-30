"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Copy, Check, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AuthModal from "@/components/AuthModal";
import { SignUpGate, PostGenerationBanner } from "@/components/demo/SignUpGate";
import { supabase } from "@/lib/supabase/client";

const STORAGE_KEY = "ozigi_demo_longform";

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Technical" },
  { value: "storytelling", label: "Storytelling" },
];
const STRUCTURE_OPTIONS = [
  { value: "narrative", label: "Narrative" },
  { value: "listicle", label: "Listicle" },
  { value: "how-to", label: "How-To Guide" },
  { value: "opinion", label: "Opinion Piece" },
  { value: "analysis", label: "Deep Analysis" },
];
const DEPTH_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];
const LENGTH_OPTIONS = [
  { value: 800, label: "~800 words" },
  { value: 1500, label: "~1500 words" },
  { value: 2500, label: "~2500 words" },
];

function track(event: string, properties?: Record<string, unknown>) {
  fetch("/api/demo/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties }),
  }).catch(() => {});
}

export default function LongFormPage() {
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("professional");
  const [structure, setStructure] = useState("narrative");
  const [depth, setDepth] = useState("intermediate");
  const [targetLength, setTargetLength] = useState(1500);

  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track("demo_page_viewed", { page: "long_form" });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setIsAuthenticated(true);
    });

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setArticle(parsed.article);
        setHasGeneratedOnce(true);
      } catch {}
    }
  }, []);

  const handleGenerate = async () => {
    if (!context.trim()) {
      toast.error("Please enter a topic or brief.");
      return;
    }

    if (!isAuthenticated && hasGeneratedOnce) {
      setShowGate(true);
      track("demo_gate_shown", { page: "long_form" });
      return;
    }

    setLoading(true);
    setArticle(null);
    track("demo_generate_clicked", { page: "long_form", authenticated: isAuthenticated });

    try {
      const endpoint = isAuthenticated ? "/api/long-form/generate" : "/api/demo/long-form";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, tone, structure, depth, targetLength }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "demo_limit_reached") {
          setHasGeneratedOnce(true);
          setShowGate(true);
          track("demo_gate_shown", { page: "long_form", reason: "limit_reached" });
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      const result = isAuthenticated ? data.article : data.article;
      setArticle(result);
      setHasGeneratedOnce(true);

      if (!isAuthenticated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ article: result, params: { context, tone, structure, depth, targetLength } }));
      }

      track("demo_generate_succeeded", { page: "long_form", authenticated: isAuthenticated, wordCount: result?.totalWordCount });
      toast.success("Article generated!");

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: any) {
      toast.error(err.message || "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!article) return;
    const text = article.sections?.map((s: any) => `## ${s.heading}\n\n${s.content}`).join("\n\n") ?? "";
    navigator.clipboard.writeText(`# ${article.title}\n\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const articleMarkdown = article
    ? `# ${article.title}\n\n${article.sections?.map((s: any) => `## ${s.heading}\n\n${s.content}`).join("\n\n") ?? ""}`
    : "";

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Ozigi" className="h-8 w-auto" />
            <span className="text-xl font-black text-[#0A1628] tracking-tighter">Ozigi</span>
          </Link>
          <button
            onClick={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "long_form", location: "header" }); }}
            className="bg-[#E8320A] hover:bg-[#C5280A] text-white text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all"
          >
            Sign Up Free
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#E8320A]/10 text-[#E8320A] text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            <FileText className="w-3.5 h-3.5" />
            Long-Form Generator
          </div>
          <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-[#0A1628] leading-[0.9] mb-5">
            Articles that don't
            <br />
            <span className="text-[#E8320A]">sound like AI wrote them.</span>
          </h1>
          <p className="text-slate-600 text-lg max-w-xl mx-auto">
            Paste a brief, pick your format — get a 800–2500 word article in seconds. No fluff, no corporate speak.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-8">
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">Topic or Brief *</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Describe what you want to write about. Include your angle, target audience, and any key points you want covered..."
              rows={5}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Structure</label>
              <select
                value={structure}
                onChange={(e) => setStructure(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30"
              >
                {STRUCTURE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Depth</label>
              <select
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30"
              >
                {DEPTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Length</label>
              <select
                value={targetLength}
                onChange={(e) => setTargetLength(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8320A]/30"
              >
                {LENGTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-[#E8320A] hover:bg-[#C5280A] disabled:opacity-60 text-white font-black uppercase tracking-widest text-sm px-6 py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : "Generate Article →"}
          </button>
        </div>

        {/* Gate overlay */}
        <AnimatePresence>
          {showGate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <SignUpGate
                toolName="article"
                onSignUp={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "long_form", location: "gate" }); }}
                onViewResult={() => setShowGate(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {article && !showGate && (
            <motion.div
              ref={resultRef}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-black text-xl text-[#0A1628]">{article.title}</h2>
                    {article.totalWordCount && (
                      <p className="text-slate-400 text-xs mt-1">{article.totalWordCount.toLocaleString()} words</p>
                    )}
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#E8320A] border border-slate-200 hover:border-[#E8320A]/40 px-4 py-2 rounded-lg transition-all"
                  >
                    {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>

                <div className="prose prose-slate max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{articleMarkdown}</ReactMarkdown>
                </div>
              </div>

              {!isAuthenticated && (
                <PostGenerationBanner
                  onSignUp={() => { setIsAuthModalOpen(true); track("demo_signup_clicked", { page: "long_form", location: "post_generation" }); }}
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
          redirectTo={typeof window !== "undefined" ? window.location.pathname : "/long-form"}
        />
      )}
    </div>
  );
}

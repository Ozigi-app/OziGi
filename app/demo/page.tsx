"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, Lock, Zap, Send, Users, BarChart3, FileText } from "lucide-react";
import Distillery from "../../components/ContextEngine";
import DistributionGrid from "../../components/DistributionGrid";
import GeneratingState from "../../components/GeneratingState";
import DashboardPreview from "../../components/DashboardPreview";
import AuthModal from "../../components/AuthModal";
import { PLATFORMS } from "@/lib/platforms";

const C = {
  red:     "#E8320A",
  navy:    "#0A1628",
  muted:   "rgba(51,65,85,0.85)",
  border:  "rgba(15,23,42,0.08)",
  redSoft: "rgba(232,50,10,0.10)",
  redGlow: "rgba(232,50,10,0.20)",
};

/* ─── Sample inputs ──────────────────────────────────────────────── */
const SAMPLES = [
  { label: "Product update",    text: `We just shipped Ozigi v3 — find leads, run outbound sequences, and publish content that sounds like you. Outbound email, LinkedIn automation, lead scraping from GitHub and Dev.to, CRM sync (HubSpot, Zoho). Plus the content engine you already know. One platform, full pipeline.` },
  { label: "Release notes",     text: `Ozigi v3 ships with: AI-powered ICP scoring on every scraped lead, email sequences with reply detection, LinkedIn DM automation, and a new overview dashboard showing your leads, outreach, and content in one view. Rolling out to all users this week.` },
  { label: "Founder insight",   text: `Most outbound fails because it's generic. If your cold email could have been sent to 10,000 people, it reads that way. We built Ozigi's outbound engine to personalise every message from the lead's actual GitHub profile — their repos, commit messages, what they're building.` },
];

/* ─── GTM feature showcase (non-interactive) ─────────────────────── */
const GTM_FEATURES = [
  {
    icon: <Users className="w-5 h-5" />,
    title: "Lead Scraping",
    desc: "Gemini scores every lead against your ICP. Only qualified prospects enter your sequence.",
    note: "Requires sign-up",
    locked: true,
  },
  {
    icon: <Send className="w-5 h-5" />,
    title: "Email Sequences",
    desc: "Personalised cold intros, follow-ups, and breakup emails — written from the lead's actual profile.",
    note: "Requires sign-up",
    locked: true,
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: "LinkedIn Automation",
    desc: "Connect requests, DMs, and follow-ups — your account, your sequence, running on autopilot.",
    note: "Requires sign-up",
    locked: true,
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "CRM Sync",
    desc: "HubSpot, Zoho — leads sync automatically on first contact.",
    note: "Requires sign-up",
    locked: true,
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: "Content Engine",
    desc: "Social posts, newsletters, blog articles — in your voice. Try it live below ↓",
    note: "Live demo below",
    locked: false,
  },
];

/* ─── Post-generation gate ───────────────────────────────────────── */
function DemoGate({ onSignUp, onViewPrevious }: { onSignUp: () => void; onViewPrevious: () => void }) {
  return (
    <div className="relative">
      <div className="opacity-20 blur-sm pointer-events-none select-none h-32 bg-slate-100 rounded-2xl" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-2xl px-8 py-10 max-w-md w-full text-center"
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: C.red }}>
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-black uppercase tracking-tight text-2xl mb-3" style={{ color: C.navy }}>
            That's the content engine.
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-2">
            Sign up free to save your campaign, run unlimited generations, and unlock outbound — email sequences, LinkedIn outreach, lead scraping, and CRM sync.
          </p>
          <p className="text-xs text-slate-400 mb-6">7-day full trial. No credit card.</p>
          <button onClick={onSignUp}
            className="block w-full text-white font-black uppercase tracking-widest text-sm px-6 py-4 rounded-xl transition-all active:scale-[0.98] mb-3"
            style={{ background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)` }}>
            Start Free — Find Leads & Run Outreach →
          </button>
          <button onClick={onViewPrevious}
            className="mt-2 text-sm text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors">
            View your previous campaign
          </button>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Post-generation CTA strip ─────────────────────────────────── */
function PostGenCTA({ onSignUp }: { onSignUp: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="mt-8 rounded-2xl px-8 py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
      style={{ background: C.navy, borderLeft: `4px solid ${C.red}` }}
    >
      <div>
        <p className="text-white font-black uppercase tracking-tight text-xl md:text-2xl mb-2">
          Content engine: done. Now run the outbound side.
        </p>
        <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
          Sign up to save this campaign, then unlock outbound — email sequences, LinkedIn automation, lead scraping, and CRM sync.
        </p>
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <button onClick={onSignUp}
          className="text-white font-black uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-all active:scale-[0.98] whitespace-nowrap"
          style={{ background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)` }}>
          Start Free →
        </button>
        <p className="text-slate-500 text-xs text-center">7-day trial · no credit card</p>
      </div>
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function DemoPage() {
  const [loading, setLoading]             = useState(false);
  const [campaign, setCampaign]           = useState<any[]>([]);
  const [emailContent, setEmailContent]   = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [showGate, setShowGate]           = useState(false);
  const [previousOutput, setPreviousOutput] = useState<any>(null);
  const campaignRef = useRef<HTMLDivElement>(null);

  const [inputs, setInputs] = useState({
    url: "",
    text: "",
    fileUrls: [] as string[],
    files: [] as File[],
    platforms: [PLATFORMS.X, PLATFORMS.LINKEDIN, PLATFORMS.DISCORD],
    tweetFormat: "single" as const,
    additionalInfo: "",
    personaId: "default",
  });

  useEffect(() => {
    const stored = localStorage.getItem("ozigi_demo_last_output");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreviousOutput(parsed);
        setHasGeneratedOnce(true);
      } catch {}
    }
  }, []);

  const handleGenerate = async () => {
    if (hasGeneratedOnce) { setShowGate(true); return; }
    setLoading(true);
    setCampaign([]);
    setEmailContent(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Demo-Mode": "true" },
        body: JSON.stringify({
          sourceMaterial: { url: inputs.url, rawText: inputs.text, assetUrls: inputs.fileUrls },
          campaignDirectives: {
            platforms: inputs.platforms, tweetFormat: inputs.tweetFormat,
            additionalContext: inputs.additionalInfo,
            personaVoice: "Expert Social Media Copywriter who sounds like a real person, never like AI",
          },
        }),
      });

      if (response.status === 403) {
        const data = await response.json();
        if (data.error === "demo_limit_reached") { setHasGeneratedOnce(true); setShowGate(true); setLoading(false); return; }
      }
      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();
      const cleanJson = data.output.replace(/```json/gi, "").replace(/```/gi, "").trim();
      const finalResponse = JSON.parse(cleanJson);
      const finalCampaign = finalResponse.campaign || [];
      const finalEmail = finalResponse.email || null;

      if (finalCampaign.length > 0) {
        setCampaign(finalCampaign);
        setEmailContent(finalEmail);
        setHasGeneratedOnce(true);
        localStorage.setItem("ozigi_demo_last_output", JSON.stringify({ campaign: finalCampaign, email: finalEmail }));
        setPreviousOutput({ campaign: finalCampaign, email: finalEmail });
        requestAnimationFrame(() => {
          campaignRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
        });
      }
    } catch {
      toast.error("Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewPrevious = () => {
    setShowGate(false);
    if (previousOutput?.campaign) { setCampaign(previousOutput.campaign); setEmailContent(previousOutput.email || null); }
  };

  return (
    <div className="min-h-screen" style={{ background: "#F8FAFC", color: C.navy }}>

      {/* ── Top nav ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: C.border }}>
        <Link href="/" className="flex items-center gap-2 group">
          <img src="/logo.png" alt="Ozigi" className="h-7 w-auto logo-spin" />
          <span className="text-xl font-black italic uppercase tracking-tighter" style={{ color: C.navy }}>Ozigi</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
            ← Back to home
          </Link>
          <button onClick={() => setIsAuthModalOpen(true)}
            className="text-xs font-black uppercase tracking-widest text-white px-4 py-2 rounded-xl transition-all active:scale-95"
            style={{ background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)` }}>
            Sign up free →
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6"
            style={{ background: C.redSoft, color: C.red, border: `1px solid rgba(232,50,10,0.2)` }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.red }} />
            Interactive Demo
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-5"
            style={{ color: C.navy }}>
            Find leads. Run outreach. Publish content.
          </h1>
          <p className="text-lg font-medium leading-relaxed max-w-2xl mx-auto" style={{ color: C.muted }}>
            Watch the full loop — find leads, run outbound sequences, publish content — then try the content engine live yourself.
          </p>
        </div>

        {/* ── Animated dashboard demo ───────────────────────────────── */}
        <div className="mb-6">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-center mb-4"
            style={{ color: "rgba(100,116,139,0.75)" }}>
            Overview → Outbound Campaign → Content Engine
          </p>
          <div style={{ zoom: 0.9 }} className="w-full origin-top">
            <DashboardPreview />
          </div>
        </div>

        {/* ── What you saw ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-16">
          {GTM_FEATURES.map((f) => (
            <div key={f.title}
              className={`rounded-2xl p-4 flex flex-col gap-2 relative ${f.locked ? "opacity-80" : ""}`}
              style={{ background: f.locked ? "#F1F5F9" : "#FFF5F3", border: `1px solid ${f.locked ? "rgba(15,23,42,0.08)" : "rgba(232,50,10,0.2)"}` }}>
              {f.locked && (
                <Lock size={10} className="absolute top-3 right-3 text-slate-300" />
              )}
              <span style={{ color: f.locked ? "#94A3B8" : C.red }}>{f.icon}</span>
              <h3 className="text-xs font-black uppercase tracking-tight" style={{ color: f.locked ? "#475569" : C.navy }}>
                {f.title}
              </h3>
              <p className="text-[10px] leading-relaxed" style={{ color: f.locked ? "#94A3B8" : C.muted }}>
                {f.desc}
              </p>
              <span className={`text-[8px] font-black uppercase tracking-widest mt-auto px-1.5 py-0.5 rounded w-fit ${
                f.locked ? "bg-slate-200 text-slate-400" : "text-brand-red bg-red-50"
              }`}>
                {f.note}
              </span>
            </div>
          ))}
        </div>

        {/* ── Live content engine trial ─────────────────────────────── */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px flex-1" style={{ background: C.border }} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: C.red }}>
              Try it live
            </span>
            <div className="h-px flex-1" style={{ background: C.border }} />
          </div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-center mb-1"
            style={{ color: C.navy }}>
            Generate a social post right now
          </h2>
          <p className="text-sm text-center mb-8" style={{ color: C.muted }}>
            Paste anything — a URL, product update, or raw notes. Get posts for LinkedIn, X, and Discord.
          </p>
        </div>

        {/* Sample pills */}
        {!campaign.length && !loading && !showGate && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-slate-400 font-medium">Try a sample:</span>
            {SAMPLES.map(s => (
              <button key={s.label}
                onClick={() => setInputs(i => ({ ...i, text: s.text }))}
                className="text-xs text-slate-500 hover:text-slate-900 border border-slate-200 rounded-full px-3 py-1.5 transition-colors hover:border-slate-400">
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Generator */}
        {showGate ? (
          <DemoGate onSignUp={() => setIsAuthModalOpen(true)} onViewPrevious={handleViewPrevious} />
        ) : (
          <div className="bg-white rounded-3xl border shadow-sm p-6 md:p-8" style={{ borderColor: C.border }}>
            {!loading && campaign.length === 0 && (
              <Distillery
                session={null}
                userPersonas={[]}
                demoMode
                inputs={inputs}
                setInputs={setInputs}
                loading={loading}
                onGenerate={handleGenerate}
              />
            )}

            {loading && <GeneratingState />}

            {!loading && campaign.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-8" ref={campaignRef}>
                <div className="flex justify-between items-center mb-6">
                  <button onClick={() => { setCampaign([]); setShowGate(false); }}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    ← Try again
                  </button>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.25)" }}>
                    Generated ✓
                  </span>
                </div>

                <DistributionGrid
                  campaign={campaign}
                  session={null}
                  selectedPlatforms={inputs.platforms}
                  emailContent={emailContent}
                  setEmailContent={setEmailContent}
                  demoMode
                />

                <PostGenCTA onSignUp={() => setIsAuthModalOpen(true)} />
              </div>
            )}
          </div>
        )}

        {/* ── Final CTA ────────────────────────────────────────────── */}
        {!campaign.length && !loading && (
          <div className="mt-16 text-center">
            <p className="text-sm text-slate-400 mb-4">
              Ready for the full suite — outbound + content together?
            </p>
            <button onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex items-center gap-2 text-white font-black uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-all active:scale-95 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)`, boxShadow: `0 8px 32px ${C.redGlow}` }}>
              Start free — 7-day trial →
            </button>
            <p className="text-xs text-slate-400 mt-3">No credit card required</p>
          </div>
        )}
      </div>

      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
    </div>
  );
}

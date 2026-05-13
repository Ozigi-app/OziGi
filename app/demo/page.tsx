"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Mail, User, Sparkles, Lock, Zap } from "lucide-react";
import Distillery from "../../components/ContextEngine";
import DistributionGrid from "../../components/DistributionGrid";
import GeneratingState from "../../components/GeneratingState";
import Footer from "../../components/Footer";
import AuthModal from "../../components/AuthModal";
import { PLATFORMS } from "@/lib/platforms";

// Sample content for one-click demos
const SAMPLE_GITHUB = `We just shipped Ozigi v1.2. Key changes:
- Added Firecrawl URL scraping for faster context extraction
- Expanded Banned Lexicon to 8 categories including Gemini-specific patterns
- Mem0AI persistent memory now saves persona context across sessions
- Fixed scheduling edge case where X reminders weren't firing at the correct timezone
- Email newsletter generation now runs independently of campaign posts`;

const SAMPLE_PRODUCT_UPDATE = `Ozigi now supports Slack webhooks. 
You can publish directly to your Slack workspace the same way Discord works — 
paste your webhook URL in Settings and your campaign drafts route there automatically. 
Took us about a day to build. The hardest part was the formatting rules — 
Slack markdown is different from Discord in a few annoying ways.`;

const SAMPLE_BLOG_URL = `https://ozigi.app/docs/the-banned-lexicon`;

// Locked sidebar nav items for demo
const DEMO_NAV_ITEMS = [
  {
    label: "Generation History",
    icon: (
      <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Scheduled Posts",
    icon: (
      <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Subscribers",
    icon: <Mail className="w-5 h-5 opacity-70" />,
  },
  {
    label: "Personas",
    icon: <User className="w-5 h-5 opacity-70" />,
  },
  {
    label: "Settings & Integrations",
    icon: (
      <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Copilot Settings",
    icon: <Sparkles className="w-5 h-5 opacity-70" />,
  },
];

// Demo Sidebar Component (locked version)
function DemoSidebar({
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  onSignUp,
}: {
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  onSignUp: () => void;
}) {
  return (
    <aside
      className={`
        ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 transition-all duration-300 ease-in-out
        fixed md:relative z-50 h-full bg-white border-r border-slate-200 flex flex-col shadow-2xl md:shadow-none
        ${isSidebarCollapsed ? "w-20" : "w-64 md:w-72"}
      `}
    >
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
        {!isSidebarCollapsed ? (
          <>
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Ozigi" className="h-8 w-auto logo-spin" />
            </Link>
            <Link href="/" className="text-2xl font-black text-brand-navy tracking-tighter">
              Ozigi
            </Link>
          </>
        ) : (
          <img src="/logo.png" alt="Ozigi" className="h-8 w-auto logo-spin" />
        )}
        <button
          className="hidden md:block text-slate-400 hover:text-slate-600"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
          {isSidebarCollapsed ? "→" : "←"}
        </button>
        <button className="md:hidden text-slate-400" onClick={() => setIsMobileSidebarOpen(false)}>
          ✕
        </button>
      </div>

      <nav className="flex-1 px-2 py-6 space-y-2 overflow-hidden">
        {DEMO_NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={onSignUp}
            className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-slate-400 hover:bg-slate-50 rounded-xl transition-colors ${
              isSidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <span className={`${isSidebarCollapsed ? "mx-auto" : ""} opacity-50`}>{item.icon}</span>
            {!isSidebarCollapsed && (
              <>
                <span className="opacity-50 truncate">{item.label}</span>
                <Lock size={12} className="ml-auto text-slate-300 shrink-0" />
              </>
            )}
          </button>
        ))}
      </nav>

      {/* Demo Stats Widget (locked) */}
      <div className={`p-4 border-t border-slate-100 ${isSidebarCollapsed ? "hidden" : ""}`}>
        <div className="bg-slate-50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Demo Mode</span>
            <Lock size={12} className="text-slate-300" />
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Campaigns</span>
              <span className="font-bold text-slate-300">--</span>
            </div>
            <div className="flex justify-between">
              <span>Scheduled</span>
              <span className="font-bold text-slate-300">--</span>
            </div>
            <div className="flex justify-between">
              <span>Personas</span>
              <span className="font-bold text-slate-300">--</span>
            </div>
          </div>
          <button
            onClick={onSignUp}
            className="w-full mt-4 py-2 bg-brand-red text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#C5280A] transition-colors"
          >
            Sign Up Free
          </button>
        </div>
      </div>
    </aside>
  );
}

// Second-generation gate overlay
function DemoGateOverlay({
  previousOutput,
  onSignUp,
  onViewPrevious,
}: {
  previousOutput: any;
  onSignUp: () => void;
  onViewPrevious: () => void;
}) {
  return (
    <div className="relative">
      {/* Blurred previous output */}
      <div className="opacity-30 blur-[2px] pointer-events-none select-none">
        <div className="bg-slate-100 rounded-2xl p-8 min-h-[300px] flex items-center justify-center">
          <p className="text-slate-400 text-sm">Your previous campaign content</p>
        </div>
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-2xl px-8 py-10 max-w-md w-full text-center"
        >
          <div className="w-12 h-12 bg-brand-red rounded-full flex items-center justify-center mx-auto mb-5">
            <Zap className="w-6 h-6 text-white" />
          </div>

          <h2 className="text-brand-navy font-black uppercase tracking-tight text-2xl mb-3">
            That didn't sound like AI. That's the point.
          </h2>

          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Sign up free to save your campaign, run unlimited generations, and publish directly from the dashboard — always in your voice.
          </p>

          <button
            onClick={onSignUp}
            className="block w-full bg-brand-red hover:bg-[#C5280A] text-white font-black uppercase tracking-widest text-sm px-6 py-4 rounded-xl transition-all active:scale-[0.98] mb-3"
          >
            Sign Up Free — Keep Your Campaign
          </button>

          <p className="text-slate-400 text-xs">Free plan includes 5 campaigns/month. No credit card required.</p>

          <button
            onClick={onViewPrevious}
            className="mt-4 text-sm text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            View your previous campaign
          </button>
        </motion.div>
      </div>
    </div>
  );
}

// Post-generation CTA component
function PostGenerationCTA({ onSignUp }: { onSignUp: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="mt-8 rounded-2xl bg-brand-navy border-l-4 border-brand-red px-8 py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
    >
      <div>
        <p className="text-white font-black uppercase tracking-tight text-xl md:text-2xl mb-2">
          This is what it sounds like when AI doesn't sound like AI.
        </p>
        <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
          Sign up free to save this campaign, run unlimited generations, and publish directly to X, LinkedIn, and Discord — always in your voice, never in AI's.
        </p>
      </div>
      <div className="flex flex-col gap-3 shrink-0">
        <button
          onClick={onSignUp}
          className="bg-brand-red hover:bg-[#C5280A] text-white font-black uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-all active:scale-[0.98] text-center whitespace-nowrap"
        >
          Sign Up Free →
        </button>
        <p className="text-slate-500 text-xs text-center">No credit card. 5 campaigns free.</p>
      </div>
    </motion.div>
  );
}

export default function DemoSandbox() {
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<any[]>([]);
  const [emailContent, setEmailContent] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [previousOutput, setPreviousOutput] = useState<any>(null);
  const campaignRef = useRef<HTMLDivElement>(null);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

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

  // Check localStorage for previous demo output on mount
  useEffect(() => {
    const stored = localStorage.getItem("ozigi_demo_last_output");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreviousOutput(parsed);
        setHasGeneratedOnce(true);
      } catch (e) {
        // Invalid stored data, ignore
      }
    }
  }, []);

  // Pre-populate from landing page demo widget
  useEffect(() => {
    const landingInput = sessionStorage.getItem("ozigi_landing_demo_input");
    if (landingInput) {
      setInputs((prev) => ({ ...prev, text: landingInput }));
      sessionStorage.removeItem("ozigi_landing_demo_input");

      const params = new URLSearchParams(window.location.search);
      if (params.get("from") === "landing") {
        setTimeout(() => {
          document.getElementById("demo-generate-btn")?.click();
        }, 400);
      }
    }
  }, []);

  const handleSampleClick = (sample: string) => {
    setInputs({ ...inputs, text: sample });
  };

  const handleGenerate = async () => {
    // If user has already generated once, show gate
    if (hasGeneratedOnce) {
      setShowGate(true);
      return;
    }

    setLoading(true);
    setCampaign([]);
    setEmailContent(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Demo-Mode": "true",
        },
        body: JSON.stringify({
          sourceMaterial: {
            url: inputs.url,
            rawText: inputs.text,
            assetUrls: inputs.fileUrls,
          },
          campaignDirectives: {
            platforms: inputs.platforms,
            tweetFormat: inputs.tweetFormat,
            additionalContext: inputs.additionalInfo,
            personaVoice: "Expert Social Media Copywriter",
          },
        }),
      });

      if (response.status === 403) {
        const data = await response.json();
        if (data.error === "demo_limit_reached") {
          setHasGeneratedOnce(true);
          setShowGate(true);
          setLoading(false);
          return;
        }
      }

      if (!response.ok) {
        throw new Error("Generation failed");
      }

      const data = await response.json();
      const cleanJson = data.output.replace(/```json/gi, "").replace(/```/gi, "").trim();
      const finalResponse = JSON.parse(cleanJson);
      const finalCampaign = finalResponse.campaign || [];
      const finalEmail = finalResponse.email || null;

      if (finalCampaign.length > 0) {
        setCampaign(finalCampaign);
        setEmailContent(finalEmail);
        setHasGeneratedOnce(true);

        // Store in localStorage for gate screen
        localStorage.setItem(
          "ozigi_demo_last_output",
          JSON.stringify({ campaign: finalCampaign, email: finalEmail })
        );
        setPreviousOutput({ campaign: finalCampaign, email: finalEmail });

        // Snap to campaign immediately — smooth scroll on mobile causes the
        // page to linger on the input form while the campaign is already ready
        requestAnimationFrame(() => {
          campaignRef.current?.scrollIntoView({
            behavior: "instant" as ScrollBehavior,
            block: "start",
          });
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewPrevious = () => {
    setShowGate(false);
    if (previousOutput?.campaign) {
      setCampaign(previousOutput.campaign);
      setEmailContent(previousOutput.email || null);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Demo Sidebar */}
      <DemoSidebar
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        onSignUp={() => setIsAuthModalOpen(true)}
      />

      {/* Mobile sidebar overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto relative bg-slate-50">
        {/* Mobile top bar - only shows hamburger and sign up on mobile */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 text-slate-600 hover:text-slate-900"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-brand-red hover:bg-[#C5280A] text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-colors"
            >
              Sign Up
            </button>
          </div>
        </div>

        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
          {/* Page Header - Updated copy */}
          <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-red transition-colors mb-6"
            >
              <span className="text-lg leading-none">←</span> Back to Home
            </Link>
            <h1 className="text-4xl md:text-5xl text-brand-navy font-black italic uppercase tracking-tighter mb-4">
              See What Human Sounds Like
            </h1>
            <p className="text-slate-500 font-medium max-w-xl mx-auto">
              Paste a URL, drop your notes, or upload a file. Get content that sounds like you wrote it, in 20 seconds.
            </p>
          </div>

          {/* Show gate if trying to generate again */}
          {showGate ? (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              <DemoGateOverlay
                previousOutput={previousOutput}
                onSignUp={() => setIsAuthModalOpen(true)}
                onViewPrevious={handleViewPrevious}
              />
            </div>
          ) : (
            <>
              {/* Context Engine Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {!loading && campaign.length === 0 && (
                  <>
                    <Distillery
                      session={null}
                      userPersonas={[]}
                      demoMode
                      inputs={inputs}
                      setInputs={setInputs}
                      loading={loading}
                      onGenerate={handleGenerate}
                    />

                    {/* Sample Input Pills - Change 2 */}
                    <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                      <span className="text-xs text-slate-400 font-medium">Try a sample:</span>
                      <button
                        onClick={() => handleSampleClick(SAMPLE_GITHUB)}
                        className="text-xs text-slate-500 hover:text-slate-900 border border-slate-200 rounded-full px-3 py-1.5 transition-colors hover:border-slate-400"
                      >
                        GitHub release notes
                      </button>
                      <button
                        onClick={() => handleSampleClick(SAMPLE_PRODUCT_UPDATE)}
                        className="text-xs text-slate-500 hover:text-slate-900 border border-slate-200 rounded-full px-3 py-1.5 transition-colors hover:border-slate-400"
                      >
                        Product update
                      </button>
                      <button
                        onClick={() => handleSampleClick(SAMPLE_BLOG_URL)}
                        className="text-xs text-slate-500 hover:text-slate-900 border border-slate-200 rounded-full px-3 py-1.5 transition-colors hover:border-slate-400"
                      >
                        Blog post URL
                      </button>
                    </div>
                  </>
                )}

                {loading && <GeneratingState />}

                {!loading && campaign.length > 0 && (
                  <div className="animate-in fade-in slide-in-from-bottom-8">
                    <div className="flex justify-between items-center mb-8">
                      <button
                        onClick={() => setIsAuthModalOpen(true)}
                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-red transition-colors bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md active:scale-95"
                      >
                        ← Architect New Campaign
                      </button>
                    </div>

                    <div className="scroll-mt-32" ref={campaignRef}>
                      <DistributionGrid
                        campaign={campaign}
                        session={null}
                        selectedPlatforms={inputs.platforms}
                        emailContent={emailContent}
                        setEmailContent={setEmailContent}
                        demoMode
                      />
                    </div>

                    {/* Post-generation CTA - Change 4 */}
                    <PostGenerationCTA onSignUp={() => setIsAuthModalOpen(true)} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <Footer />
      </main>

      {/* Locked Copilot Button */}
      <div className="fixed bottom-6 right-6 z-40 group">
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="bg-slate-400 text-white p-4 rounded-full shadow-2xl cursor-pointer flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Copilot unavailable"
        >
          <Sparkles className="w-6 h-6" />
        </button>
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
          Sign up to unlock Copilot
        </div>
      </div>

      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
    </div>
  );
}

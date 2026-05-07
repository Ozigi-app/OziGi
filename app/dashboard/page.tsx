"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Sparkles, User, FileText, Store } from "lucide-react";
import Distillery from "@/components/ContextEngine";
import DistributionGrid from "@/components/DistributionGrid";
import GuestModeBanner from "@/components/GuestModeBanner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import SkeletonGrid from "@/components/SkeletonGrid";
import GeneratingState from "@/components/GeneratingState";
import DashboardLoading from "@/components/DashboardLoading";
import ScheduledPostsModal from "@/components/ScheduledPostsModal";
import SettingsModal from "@/components/SettingsModal";
import Sidebar from "@/components/dashboard/Sidebar";
import EmailBanner from "@/components/dashboard/EmailBanner";
import HistoryModal from "@/components/dashboard/HistoryModal";
import SubscribersModal from "@/components/dashboard/SubscribersModal";
import PersonasModal from "@/components/dashboard/PersonasModal";
import { useSession } from "@/components/hooks/useSession";
import { usePersonas } from "@/components/hooks/usePersonas";
import { useCampaignHistory } from "@/components/hooks/useCampaignHistory";
import { useStats } from "@/components/hooks/useStats";
import { useEmailBanner } from "@/components/hooks/useEmailBanner";
import { supabase } from "@/lib/supabase/client";
import CopilotPanel from "@/components/CopilotPannel";
import CopilotSettingsModal from "@/components/CopilotSettingsModal";
import { usePlanStatus } from "@/components/hooks/usePlanStatus";
import PricingCards from "@/components/PricingCards";
import UpgradeModal from "@/components/UpgradeModal";
import DashboardTour from "@/components/dashboard/DashboardTour";
import { incrementCampaignGeneration } from "@/lib/plan";
import { toast } from "sonner";
import { PLATFORMS } from "@/lib/platforms";
import { fireConversion } from "@/lib/gtag";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, sessionLoading } = useSession();
  const { planStatus, loading: planLoading } = usePlanStatus();

  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<any[]>([]);
  const [inputs, setInputs] = useState({
    url: "",
    text: "",
    fileUrls: [],
    files: [],
    platforms: [PLATFORMS.X, PLATFORMS.LINKEDIN, PLATFORMS.DISCORD, PLATFORMS.EMAIL],
    tweetFormat: "single" as const,
    additionalInfo: "",
    personaId: "default",
    campaignName: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [emailContent, setEmailContent] = useState<string | null>(null);
  const campaignRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  const { personas, refreshPersonas } = usePersonas(session?.user?.id);
  const { pastCampaigns, fetchHistory, restoreCampaign } = useCampaignHistory(session?.user?.id);
  const { stats, isLoadingStats, refreshStats } = useStats(session?.user?.id);
  const { needsEmail, setNeedsEmail, dismissBanner } = useEmailBanner(session);
  const [campaignName, setCampaignName] = useState("");

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isScheduledOpen, setIsScheduledOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSubscribersOpen, setIsSubscribersOpen] = useState(false);
  const [isPersonasOpen, setIsPersonasOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const [isTourReady, setIsTourReady] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isCopilotSettingsOpen, setIsCopilotSettingsOpen] = useState(false);
  const hasCopilot = planStatus?.hasCopilot || false;

  const navItems = [
    {
      label: "Generation History",
      icon: (
        <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => setIsHistoryOpen(true),
    },
    {
      label: "Scheduled Posts",
      icon: (
        <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      onClick: () => setIsScheduledOpen(true),
    },
    {
      label: "Subscribers",
      icon: <Mail className="w-5 h-5 opacity-70" />,
      onClick: () => setIsSubscribersOpen(true),
    },
    {
      label: "Personas",
      icon: <User className="w-5 h-5 opacity-70" />,
      onClick: () => setIsPersonasOpen(true),
    },
    {
      label: "Persona Marketplace",
      icon: <Store className="w-5 h-5 opacity-70" />,
      onClick: () => router.push("/dashboard/personas/marketplace"),
    },
    {
      label: "Blog Post",
      icon: <FileText className="w-5 h-5 opacity-70" />,
      onClick: () => planStatus?.hasLongForm
        ? router.push("/dashboard/long-form")
        : setIsUpgradeModalOpen(true),
      locked: !planStatus?.hasLongForm,
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
      onClick: () => setIsSettingsOpen(true),
    },
    {
      label: "Copilot Settings",
      icon: <Sparkles className="w-5 h-5 opacity-70" />,
      onClick: () => setIsCopilotSettingsOpen(true),
    },
  ];

const handleGenerate = async () => {
  setLoading(true);
  setErrorMessage("");
  if (!session?.access_token) {
    setErrorMessage("Your session expired. Please log in again.");
    setLoading(false);
    return;
  }
  setCampaign([]);

  try {
    let selectedVoice =
      "Expert Social Media Copywriter who adapts perfectly to the provided context";
    if (inputs.personaId && inputs.personaId !== "default") {
      const found = personas.find((p: any) => p.id === inputs.personaId);
      if (found && found.prompt) {
        selectedVoice = found.prompt;
      }
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = inputs.text.match(urlRegex);
    let url = "";
    let rawText = inputs.text;
    if (matches && matches.length > 0) {
      url = matches[0];
      rawText = inputs.text.replace(url, "").trim();
    }

    const payload = {
      sourceMaterial: {
        url,
        rawText,
        assetUrls: inputs.fileUrls,
      },
      campaignDirectives: {
        platforms: inputs.platforms,
        tweetFormat: inputs.tweetFormat,
        additionalContext: inputs.additionalInfo,
        personaVoice: selectedVoice,
      },
    };

    // Step 1: enqueue the job (returns in <1s)
    let enqueueRes: Response;
    try {
      enqueueRes = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setLoading(false);
      return;
    }

    if (!enqueueRes.ok) {
      let errorMsg = "We encountered a hiccup starting the generation. Please try again.";
      try {
        const errorData = await enqueueRes.json();
        if (errorData.error) errorMsg = errorData.error;
      } catch { /* ignore */ }
      setErrorMessage(errorMsg);
      setLoading(false);
      return;
    }

    const { jobId, error: enqueueError } = await enqueueRes.json();
    if (enqueueError || !jobId) {
      setErrorMessage(enqueueError || "Failed to start generation.");
      setLoading(false);
      return;
    }

    // Step 2: poll /api/generate/status until done or error
    // Max 3 minutes (90 attempts × 2s). QStash retries the worker automatically
    // if it times out, so heavy content may complete on a second worker attempt.
    const MAX_ATTEMPTS = 90;
    const POLL_INTERVAL_MS = 2_000;
    let data: { output: string; lexiconWarnings?: any[] } | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      let statusRes: Response;
      try {
        statusRes = await fetch(`/api/generate/status?jobId=${jobId}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      } catch {
        // Transient network blip — keep polling
        continue;
      }

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();

      if (statusData.status === "error") {
        setErrorMessage(statusData.error || "Generation failed. Please try again.");
        setLoading(false);
        return;
      }

      if (statusData.status === "done" && statusData.result) {
        data = statusData.result;
        break;
      }
    }

    if (!data) {
      setErrorMessage(
        "Generation is taking longer than expected. Your content may still be processing — check back in a moment or try again with less content."
      );
      setLoading(false);
      return;
    }

    // Step 3: parse and display the result (same logic as before)
    let jsonString = data.output;
    let finalResponse;

    try {
      jsonString = jsonString.replace(/```json\s*([\s\S]*?)\s*```/gi, '$1');
      jsonString = jsonString.replace(/```\s*([\s\S]*?)\s*```/gi, '$1').trim();

      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.slice(firstBrace, lastBrace + 1);
      }

      if (!jsonString.startsWith('{')) {
        const possibleMatch = jsonString.match(/\{[\s\S]*\}/);
        if (possibleMatch) jsonString = possibleMatch[0];
      }

      finalResponse = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      setErrorMessage("The AI returned an unexpected format. Please try again with different context.");
      setLoading(false);
      return;
    }

    const finalCampaign = finalResponse.campaign || [];
    const finalEmail = finalResponse.email || null;

    if (finalCampaign.length === 0) {
      setErrorMessage("The AI returned an empty campaign. Please try again.");
      setLoading(false);
      return;
    }

    setCampaign(finalCampaign);
    setEmailContent(finalEmail);
    setTimeout(() => {
      campaignRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    // Save to database and update stats – but don't show error if it fails
    if (session?.user) {
      try {
        const { error: insertError } = await supabase.from("campaigns").insert({
          user_id: session.user.id,
          source_url: url,
          source_notes: rawText || inputs.fileUrls.join(", "),
          name: inputs.campaignName?.trim() || null,
          generated_content: finalCampaign,
        });
        if (insertError) {
          console.error('Campaign insert error:', insertError);
          toast.error('Campaign saved locally but failed to sync to history.');
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
        refreshStats();
        fetchHistory(session.user.id);
      } catch (dbError) {
        console.error('Database operation error:', dbError);
        toast.error('Campaign generated but could not update stats.');
      }
    }
  } catch (err) {
    console.error("Unexpected error in handleGenerate:", err);
    setErrorMessage("An unexpected error occurred. Please try again.");
  } finally {
    setLoading(false);
  }
};


  const handleEmailAdded = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.email) setNeedsEmail(false);
  };



  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openSettings") === "true") {
      window.dispatchEvent(new Event("openSettingsModal"));
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    const errorDesc = hashParams.get("error_description") || searchParams.get("error_description");
    if (errorDesc) {
      setErrorMessage(decodeURIComponent(errorDesc).replace(/\+/g, " "));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !planLoading) {
      const timer = setTimeout(() => setIsTourReady(true), 800);
      return () => clearTimeout(timer);
    } else {
      setIsTourReady(false);
    }
  }, [sessionLoading, planLoading]);

useEffect(() => {
if (!sessionLoading && !planLoading && session) {
const t = setTimeout(() => setIsTourReady(true), 800);
return () => clearTimeout(t);
}
}, [sessionLoading, planLoading, session]);

// Fire Google Ads conversion when redirected back after a successful checkout
useEffect(() => {
  if (searchParams.get("checkout") === "success") {
    fireConversion();
    // Clean the param from the URL so it doesn't re-fire on refresh
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    router.replace(url.pathname + url.search, { scroll: false });
  }
}, [searchParams, router]);

// Handle persona pre-selection from URL (e.g., from marketplace redirect)
useEffect(() => {
  const personaParam = searchParams.get("persona");
  if (personaParam && personas && personas.length > 0) {
    // Find the persona by uuid
    const found = personas.find((p: any) => p.uuid === personaParam);
    if (found) {
      setInputs((prev) => ({ ...prev, personaId: found.uuid }));
      toast.success(`Persona "${found.name}" selected`);
      // Clear the URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete("persona");
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }
}, [searchParams, personas, router]);

  if (sessionLoading) {
    return <DashboardLoading />;
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-bg text-foreground overflow-hidden">
      <Sidebar
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        navItems={navItems}
        stats={stats}
        planStatus={planStatus}
        isLoadingStats={isLoadingStats}
      />

      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <main className="flex-1 h-full overflow-y-auto relative bg-bg">
        <div className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border">
          <Header
            session={session}
            onSignIn={() => setIsAuthModalOpen(true)}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          />
        </div>

        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
          <EmailBanner
            needsEmail={needsEmail}
            onDismiss={dismissBanner}
            onGoToSettings={() => setIsSettingsOpen(true)}
          />

          {isUpgradeModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="bg-surface text-foreground w-full max-w-4xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto relative border border-border">
                <button
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="absolute top-4 right-4 text-foreground-subtle hover:text-accent font-black text-xl"
                >
                  ✕
                </button>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-4 text-foreground">
                  Upgrade Your Plan
                </h2>
                <PricingCards onOpenAuthModal={() => setIsAuthModalOpen(true)} />
              </div>
            </div>
          )}

          {!session && <GuestModeBanner onSignIn={() => setIsAuthModalOpen(true)} />}

          {errorMessage && (
            <div className="mb-8 p-5 rounded-2xl bg-accent/10 border border-accent/30 text-accent text-sm font-bold flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
              <span className="text-xl" aria-hidden>!</span> {errorMessage}
            </div>
          )}

          <div className="bg-surface text-foreground rounded-3xl border border-border shadow-sm p-6 md:p-8 mt-6">
            {!loading && campaign.length === 0 && (
              <Distillery
                session={session}
                userPersonas={personas}
                inputs={inputs}
                setInputs={setInputs}
                loading={loading}
                onOpenSettings={() => {
                  window.dispatchEvent(new Event("openSettingsModal"));
                  setIsSettingsOpen(true);
                }}
                onOpenPersonas={() => setIsPersonasOpen(true)}
                onGenerate={handleGenerate}
              />
            )}

            {loading && (
              <div className="mt-8">
                <GeneratingState />
              </div>
            )}

            {!loading && campaign.length > 0 && (
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-8">
                <div className="flex justify-between items-center mb-8">
                  <button
                    onClick={() => setCampaign([])}
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground-muted hover:text-accent transition-colors bg-surface px-5 py-3 rounded-xl border border-border shadow-sm hover:shadow-md active:scale-95"
                  >
                    ← Architect New Campaign
                  </button>
                </div>
                <div className="scroll-mt-32" id="campaign-cards" ref={campaignRef} data-tour="campaign-cards">
                  <DistributionGrid
                    campaign={campaign}
                    selectedPlatforms={inputs.platforms}
                    session={session}
                    emailContent={emailContent}
                    setEmailContent={setEmailContent}
                    onStatsChange={refreshStats}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <Footer />
      </main>

      {/* MODALS */}
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
      {isScheduledOpen && (
        <ScheduledPostsModal onClose={() => setIsScheduledOpen(false)} onStatsChange={refreshStats} />
      )}
      {isSettingsOpen && (
        <SettingsModal
          session={session}
          onClose={() => setIsSettingsOpen(false)}
          onEmailAdded={handleEmailAdded}
        />
      )}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        pastCampaigns={pastCampaigns}
        onRestore={(rec) => restoreCampaign(rec, setInputs, setCampaign)}
      />
      <SubscribersModal
        isOpen={isSubscribersOpen}
        onClose={() => setIsSubscribersOpen(false)}
        session={session}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
      />
      <PersonasModal isOpen={isPersonasOpen} onClose={() => setIsPersonasOpen(false)} session={session} />
      <CopilotSettingsModal
        isOpen={isCopilotSettingsOpen}
        onClose={() => setIsCopilotSettingsOpen(false)}
        session={session}
      />
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Copilot button and panel */}
      {planStatus?.hasCopilot ? (
        <>
          <button
            data-tour="copilot-button"
            onClick={() => setIsCopilotOpen(true)}
            className="fixed bottom-6 right-6 z-40 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
            aria-label="Open Copilot"
          >
            <span className="text-2xl">✨</span>
          </button>
          <CopilotPanel
            isOpen={isCopilotOpen}
            onClose={() => setIsCopilotOpen(false)}
            onSendToEngine={(text) => {
              setInputs((prev) => ({ ...prev, text }));
              setIsCopilotOpen(false);
            }}
          />
        </>
      ) : (
        <div className="fixed bottom-6 right-6 z-40 group">
          <button
            disabled
            className="bg-slate-400 text-white p-4 rounded-full shadow-2xl cursor-not-allowed flex items-center justify-center opacity-50"
            aria-label="Copilot unavailable"
          >
            <span className="text-2xl">✨</span>
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
            Upgrade to Organization to use Copilot
          </div>
        </div>
      )}
<DashboardTour isReady={isTourReady} hasCopilot={planStatus?.hasCopilot ?? false} />
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

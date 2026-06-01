"use client";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Sparkles, User, FileText, Store, LayoutDashboard, Megaphone, ListOrdered, Clock, Settings, Send, UserPlus, AtSign } from "lucide-react";
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

function StatCard({ label, value, desc }: { label: string; value: string | number; desc: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 group relative overflow-hidden">
      <div className="text-3xl font-black text-foreground mb-1 tabular-nums">{value}</div>
      <div className="text-foreground-subtle text-xs font-medium leading-snug">{label}</div>
      {/* Hover tooltip */}
      <div className="absolute inset-0 bg-surface-2/95 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center px-4 pointer-events-none">
        <p className="text-foreground-subtle text-xs text-center leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

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

  // ── View state ──────────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<'overview' | 'social' | 'newsletter'>('overview');

  // ── Unified overview stats ───────────────────────────────────────────────────
  type OverviewStats = {
    content: {
      socialCampaigns: number; newslettersGenerated: number; blogPostsWritten: number;
      postsScheduled: number; personasSaved: number; newsletterSubscribers: number;
    };
    outbound: {
      emailsSent: number; replyRate: string; liConnections: number;
      liMessages: number; totalLeads: number; emailsScraped: number;
    };
  };
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const fetchOverviewStats = useCallback(() => {
    setOverviewLoading(true);
    fetch('/api/stats/overview')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setOverviewStats(d); })
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
  }, []);

  useEffect(() => {
    if (session?.user) fetchOverviewStats();
  }, [session?.user, fetchOverviewStats]);

  const navItems = [
    // ── Workspace ──────────────────────────────────────────────────────────────
    {
      label: "Overview",
      sectionLabel: "Workspace",
      icon: <LayoutDashboard className="w-5 h-5 opacity-70" />,
      onClick: () => { setCurrentView('overview'); setCampaign([]); },
    },
    // ── Content Engine ─────────────────────────────────────────────────────────
    {
      label: "Social Posts",
      sectionLabel: "Content Engine",
      icon: <Megaphone className="w-5 h-5 opacity-70" />,
      onClick: () => { setCurrentView('social'); setCampaign([]); },
      subItems: [
        {
          label: "Generation History",
          icon: <Clock className="w-4 h-4" />,
          onClick: () => setIsHistoryOpen(true),
        },
        {
          label: "Scheduled Posts",
          icon: <ListOrdered className="w-4 h-4" />,
          onClick: () => setIsScheduledOpen(true),
        },
      ],
    },
    {
      label: "Newsletter",
      icon: <AtSign className="w-5 h-5 opacity-70" />,
      onClick: () => { setCurrentView('newsletter'); setCampaign([]); },
    },
    {
      label: "Blog Post",
      icon: <FileText className="w-5 h-5 opacity-70" />,
      onClick: () => planStatus?.hasLongForm
        ? router.push("/dashboard/long-form")
        : setIsUpgradeModalOpen(true),
      locked: !planStatus?.hasLongForm,
    },
    // ── Audience ───────────────────────────────────────────────────────────────
    {
      label: "Subscribers",
      sectionLabel: "Audience",
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
    // ── Outbound Growth ────────────────────────────────────────────────────────
    {
      label: "Email Outreach",
      sectionLabel: "Outbound Growth",
      icon: <Send className="w-5 h-5 opacity-70" />,
      onClick: () => planStatus?.hasGtm ? router.push("/dashboard/gtm/outreach") : router.push("/pricing"),
      locked: !planStatus?.hasGtm,
    },
    {
      label: "LinkedIn Outreach",
      icon: <UserPlus className="w-5 h-5 opacity-70" />,
      onClick: () => planStatus?.hasGtm ? router.push("/dashboard/gtm/linkedin") : router.push("/pricing"),
      locked: !planStatus?.hasGtm,
    },
    {
      label: "Outreach Settings",
      icon: <Settings className="w-5 h-5 opacity-70" />,
      onClick: () => planStatus?.hasGtm ? router.push("/dashboard/gtm/settings") : router.push("/pricing"),
      locked: !planStatus?.hasGtm,
    },
    // ── Settings ───────────────────────────────────────────────────────────────
    {
      label: "Settings & Integrations",
      sectionLabel: "Settings",
      icon: <Settings className="w-5 h-5 opacity-70" />,
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

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMsg = "We encountered a hiccup connecting to the AI engine. Please try again.";
      try {
        const errorData = await response.json();
        if (errorData.error) errorMsg = errorData.error;
      } catch { /* ignore */ }
      setErrorMessage(errorMsg);
      setLoading(false);
      return;
    }

    const data = await response.json();
    if (data.error) {
      setErrorMessage(data.error);
      setLoading(false);
      return;
    }

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
          type: currentView === 'newsletter' ? 'newsletter' : 'social',
        });
        if (insertError) {
          console.error('Campaign insert error:', insertError);
          toast.error('Campaign saved locally but failed to sync to history.');
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
        // Increment the right counter based on what was generated
        fetch('/api/stats/increment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: currentView === 'newsletter' ? 'newsletter' : 'social' }),
        }).catch(() => {});
        refreshStats();
        fetchOverviewStats();
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

          {/* ── OVERVIEW VIEW ─────────────────────────────────────────────────── */}
          {currentView === 'overview' && (
            <div className="mt-6 space-y-8">

              <div>
                <h1 className="text-2xl font-black text-foreground tracking-tight">Overview</h1>
                <p className="text-foreground-subtle text-sm mt-0.5">Everything you've done on Ozigi, at a glance</p>
              </div>

              {overviewLoading ? (
                /* Skeleton */
                <div className="space-y-6">
                  {[6, 6].map((cols, si) => (
                    <div key={si} className={`grid grid-cols-2 md:grid-cols-${cols} gap-3`}>
                      {Array(cols).fill(0).map((_, i) => (
                        <div key={i} className="bg-surface border border-border rounded-xl p-5">
                          <div className="h-8 w-12 bg-surface-2 animate-pulse rounded mb-2" />
                          <div className="h-3 w-24 bg-surface-2 animate-pulse rounded" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : overviewStats ? (
                <div data-tour="overview-stats">
                  {/* ── Content Studio ──────────────────────────────────────── */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Megaphone className="w-3.5 h-3.5 text-foreground-subtle" />
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-foreground-subtle">
                        Content Studio
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: 'Social Campaigns',      value: overviewStats.content.socialCampaigns,       desc: 'Social content campaigns generated'    },
                        { label: 'Newsletters Generated', value: overviewStats.content.newslettersGenerated,  desc: 'Email newsletters drafted and generated' },
                        { label: 'Blog Posts Written',    value: overviewStats.content.blogPostsWritten,      desc: 'Long-form blog articles generated'       },
                        { label: 'Posts Scheduled',       value: overviewStats.content.postsScheduled,        desc: 'Posts queued for auto-publishing'        },
                        { label: 'Subscribers',           value: overviewStats.content.newsletterSubscribers, desc: 'Active newsletter subscribers'           },
                        { label: 'Personas Saved',        value: overviewStats.content.personasSaved,         desc: 'Custom writing voices created'           },
                      ].map(s => (
                        <StatCard key={s.label} label={s.label} value={s.value} desc={s.desc} />
                      ))}
                    </div>
                  </section>

                  {/* ── Outbound Growth ─────────────────────────────────────── */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Send className="w-3.5 h-3.5 text-foreground-subtle" />
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-foreground-subtle">
                        Outbound Growth
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: 'Outbound Emails Sent',   value: overviewStats.outbound.emailsSent,    desc: 'Cold + follow-up emails sent via Gmail / SMTP' },
                        { label: 'Emails Scraped',         value: overviewStats.outbound.emailsScraped, desc: 'Lead profiles where an email was found'        },
                        { label: 'LinkedIn Connections',   value: overviewStats.outbound.liConnections, desc: 'Connection requests sent via LinkedIn'         },
                        { label: 'LinkedIn Messages Sent', value: overviewStats.outbound.liMessages,    desc: 'DMs and follow-up messages sent via LinkedIn'  },
                        { label: 'Total Leads Sourced',    value: overviewStats.outbound.totalLeads,    desc: 'Prospect profiles collected across all campaigns' },
                        { label: 'Reply Rate',             value: overviewStats.outbound.replyRate,     desc: 'Outbound emails that received a reply'         },
                      ].map(s => (
                        <StatCard key={s.label} label={s.label} value={s.value} desc={s.desc} />
                      ))}
                    </div>
                  </section>
                </div>
              ) : (
                <p className="text-foreground-subtle text-sm">Could not load stats. Refresh to try again.</p>
              )}

              {/* ── Plan usage ────────────────────────────────────────────────── */}
              {planStatus && planStatus.generationsLimit !== -1 && (
                <div className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex justify-between text-sm font-semibold text-foreground mb-2">
                    <span>Generations used this period</span>
                    <span className="text-foreground-subtle tabular-nums">
                      {planStatus.generationsUsed} / {planStatus.generationsLimit}
                    </span>
                  </div>
                  <div className="w-full bg-surface-2 rounded-full h-2">
                    <div
                      className="bg-accent h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((planStatus.generationsUsed / planStatus.generationsLimit) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── SOCIAL / NEWSLETTER CONTENT VIEWS ────────────────────────────── */}
          {(currentView === 'social' || currentView === 'newsletter') && (
            <div className="bg-surface text-foreground rounded-3xl border border-border shadow-sm p-6 md:p-8 mt-6">
              {/* view label */}
              <div className="flex items-center gap-2 mb-5">
                <button
                  onClick={() => { setCurrentView('overview'); setCampaign([]); }}
                  className="text-foreground-subtle hover:text-accent text-xs font-medium transition-colors"
                >
                  Overview
                </button>
                <span className="text-foreground-subtle text-xs">/</span>
                <span className="text-foreground text-xs font-semibold">
                  {currentView === 'social' ? 'Social Posts' : 'Newsletter'}
                </span>
              </div>

              {!loading && campaign.length === 0 && (
                <Distillery
                  session={session}
                  userPersonas={personas}
                  inputs={currentView === 'newsletter'
                    ? { ...inputs, platforms: [PLATFORMS.EMAIL] }
                    : { ...inputs, platforms: inputs.platforms.filter(p => p !== PLATFORMS.EMAIL) }
                  }
                  setInputs={setInputs}
                  loading={loading}
                  lockedPlatforms={currentView === 'newsletter'
                    ? [PLATFORMS.X, PLATFORMS.LINKEDIN, PLATFORMS.DISCORD, PLATFORMS.SLACK]
                    : [PLATFORMS.EMAIL]
                  }
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
                      ← New {currentView === 'newsletter' ? 'Newsletter' : 'Campaign'}
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
          )}
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
        onOpen={() => session?.user?.id && fetchHistory(session.user.id)}
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
            Upgrade to Pro to use Copilot
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

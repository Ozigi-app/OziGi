"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SourceBudgetEntry } from "@/lib/types/longform";
import { toast } from "sonner";
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  ArrowLeft,
  Loader2,
  Lock,
  Square,
  Globe,
  Link2,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Sidebar from "@/components/dashboard/Sidebar";
import { useSession } from "@/components/hooks/useSession";
import { usePlanStatus } from "@/components/hooks/usePlanStatus";
import { useStats } from "@/components/hooks/useStats";
import { usePersonas } from "@/components/hooks/usePersonas";
import { CopilotKit, useCopilotChatInternal, useCopilotReadable, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";

interface LongFormSection {
  heading: string;
  content: string;
  wordCount: number;
}

interface LongFormReference {
  title: string;
  url: string;
  note?: string;
}

interface LongFormArticle {
  title: string;
  subtitle?: string;
  sections: LongFormSection[];
  totalWordCount: number;
  references?: LongFormReference[];
  metadata: {
    tone: string;
    structure: string;
    depth?: "beginner" | "intermediate" | "advanced";
    webResearch?: boolean;
    generatedAt: string;
  };
}

const TONE_OPTIONS = [
  { value: "professional", label: "Professional", desc: "Authoritative and polished" },
  { value: "casual", label: "Casual", desc: "Conversational and approachable" },
  { value: "technical", label: "Technical", desc: "Precise and detailed" },
  { value: "storytelling", label: "Storytelling", desc: "Narrative and engaging" },
];

const STRUCTURE_OPTIONS = [
  { value: "narrative", label: "Narrative", desc: "Flowing prose with clear arc" },
  { value: "listicle", label: "Listicle", desc: "Numbered list format" },
  { value: "how-to", label: "How-To Guide", desc: "Step-by-step instructions" },
  { value: "opinion", label: "Opinion Piece", desc: "Persuasive argument" },
  { value: "analysis", label: "Deep Analysis", desc: "Thorough examination" },
];

const LENGTH_OPTIONS = [
  { value: 800, label: "Short (~800 words)", desc: "Quick read, 3-4 min" },
  { value: 1500, label: "Medium (~1500 words)", desc: "Standard article, 6-8 min" },
  { value: 2500, label: "Long (~2500 words)", desc: "Deep dive, 10-12 min" },
  { value: 4000, label: "Extended (~4000 words)", desc: "Comprehensive, 15-20 min" },
];

const DEPTH_OPTIONS = [
  { value: "beginner", label: "Beginner", desc: "Define terms, simple examples" },
  { value: "intermediate", label: "Intermediate", desc: "Practical patterns, working knowledge" },
  { value: "advanced", label: "Advanced", desc: "Internals, edge cases, primary sources" },
];

// ---------------------------------------------------------------------------
// Brief agent instructions — two separate blocks injected via
// useCopilotAdditionalInstructions. Keep them split so they're easier to
// audit independently.
// ---------------------------------------------------------------------------

// 1. Discipline rules: what the brief must NOT do (framing, evidence, URLs)
const BRIEF_DISCIPLINE_RULES = `
## BRIEF WRITER'S DISCIPLINE (non-negotiable)

You are writing for the ARTICLE AUTHOR, not for the product vendor or the client commissioning the piece.
Your job is to help the writer produce credible, defensible journalism — not to make a product look good.
Apply these rules without exception:

### 1. No sponsored framing
If you find yourself writing prose that a vendor's marketing team would approve without edits, stop and rewrite it.
Banned patterns:
- Positioning the product as the obvious or inevitable solution
- Listing competitor weaknesses without listing the product's own weaknesses
- Describing adoption, growth, or community traction without a primary source
- Phrases like "uniquely positioned", "purpose-built", "industry-leading", "game-changing", "first-of-its-kind", "pioneering"

### 2. Evidence confidence labels on every Key Argument
Each Key Argument must end with a confidence marker:
- [HIGH] — you have a direct primary source URL in the Research Anchors section
- [MEDIUM] — you have credible secondary coverage (blog post from the maintainer, official changelog, well-sourced news)
- [LOW] — this is your inference, or you found no primary source

A brief with more than one [LOW] argument is not ready to use. Flag it explicitly.

### 3. Claim attribution hygiene
Any claim about:
- a specification gap or missing standard → must cite the spec document, not a blog post about the gap
- a benchmark or performance characteristic → must name the benchmark, version, and who ran it
- a security vulnerability → must cite a CVE, advisory, or primary researcher write-up
- adoption, usage, or market share → must name the source and date

If you cannot cite a primary source, write: "CLAIM NEEDS PRIMARY SOURCE: [your claim here]" so the writer knows to verify before using it.

### 4. Research anchor discipline
Only include URLs in Research Anchors if you have HIGH confidence they resolve to the correct page.
If you searched for something but couldn't find a reliable canonical URL, describe the source WITHOUT a link:
  [Source description — search required] — no URL — what to search for and why it matters
Never guess a URL. A missing link is far less damaging than a dead or misdirected one.

### 5. Required: Tensions section
Every brief must include a "## Tensions & Honest Critique" section that surfaces:
- The strongest objection a skeptical reader will raise against the article's central argument
- At least one weakness or limitation of the product/approach being covered
- Any area where the brief's Key Arguments are based on [LOW] or [MEDIUM] evidence
This section is for the writer's benefit, not for publication. Be candid.
`.trim();

// 2. Gold standard: positive example of the exact output format and depth
const BRIEF_GOLD_STANDARD = `
## GOLD STANDARD EXAMPLE — match this level of specificity, evidence labeling, and candor:

--- START GOLD STANDARD ---
## Audience

Senior SDETs, staff engineers, and QA leads running Playwright at scale within CI/CD pipelines. They've shipped feature-flagged code before and rely on LaunchDarkly, Split/Harness, Flagsmith, or a homegrown toggle system. Their pain points: tests that break when flags change in shared environments, parallel workers colliding on flag state, and flag-dependent tests either too tightly coupled to a live SDK or too loosely defined to be trusted. They want architectural patterns, not a beginner introduction to feature flags.

## Outcome

By the end, readers will understand why feature flags break Playwright's isolation model, know the exact mechanisms (route mocking, fixture-level injection, per-worker scoping, globalSetup seeding) to achieve deterministic per-test flag state, and be able to audit their own suites for flag-induced flakiness.

## Key Arguments

1. Playwright isolates browser context, not external flag state — treating them as equivalent is the root cause of flag-induced flakiness. [HIGH — documented in Playwright architecture docs]
2. API-level flag mutation under parallelism is an anti-pattern; fixture-level injection is the correct primitive. [HIGH — Playwright fixture scoping docs + multiple postmortems]
3. Flag state must be declared like auth state — deterministic and scoped — not read reactively from the environment. [MEDIUM — well-established pattern in Playwright community, no single canonical source]
4. Worker-scoped fixtures are faster but require all co-located tests to share identical flag configurations. [HIGH — Playwright worker model docs]
5. Cross-run observability (not just test isolation) is required to diagnose flag-induced regressions reliably. [MEDIUM — supported by incident reports but no primary benchmark]

## Suggested Structure

### Introduction
- Open with the core tension: feature flags and Playwright's isolation guarantees operate at different layers.
- Playwright isolates browser contexts (cookies, localStorage, sessions), but feature flags are evaluated outside that boundary — often via backend services or SDKs. This creates hidden shared state across tests.
- Example: a beforeAll mutating a flag via an API in Worker 1 can affect what Worker 3 sees mid-test.
- Acknowledge the common initial response: hardcoding flag state in environments, conditional test logic. Explain why these break under parallelism.

## H2: Why Feature Flags Break Playwright's Isolation Model
- Clarify that Playwright isolation is not broken, but limited to browser context. Feature flags introduce state outside that boundary.
- Flag evaluation paths: server-side evaluation based on user identity; client-side SDK fetching remote config; cookie or header overrides.

### H3: The Shared Environment Problem
- In shared environments, flag state is effectively global unless scoped per user. Parallel workers operate as the same user, hit the same endpoints, and share flag state.
- [Code example: beforeAll API mutation creating cross-worker race condition]

### H3: Conditional Test Logic as a Code Smell
- Critique: if (featureEnabled) { … } else { test.skip() }
- Principle: Flag state should be declared like auth state, not read reactively.

## H2: A Taxonomy of Flag Integration Patterns
- Live SDK: No isolation, only for smoke tests validating real production config.
- API-level mutation: Fragile under parallelism, requires strict isolation or serial execution.
- Network interception (page.route): Full per-test isolation, preferred for client-side flags.
- Cookie/header overrides: Lightweight and isolated within browser context.

## H2: Fixture-Level Flag Architecture

### H3: The Flag Context Fixture
- Introduce flagContext / withFlags fixture pattern.
- [Code example: Route handler registered before page.goto()]

### H3: Worker-Scoped vs Test-Scoped Fixtures
- Test-scoped: full isolation; higher overhead.
- Worker-scoped: faster; safe only when all tests share the same flag config.

## Tensions & Honest Critique

- The central argument (fixture injection > API mutation) is strong for client-side flags. For server-side evaluated flags, the pattern requires the test to mock the evaluation endpoint, which can drift from production behavior. The article must acknowledge this.
- LaunchDarkly's Playwright integration guide recommends a different pattern. The article should address why it disagrees, or the argument will look under-researched to LaunchDarkly users.
- Argument 5 (observability) has only [MEDIUM] evidence. It should be framed as a recommendation, not a hard requirement, or the writer needs to find a primary source.

## Research Anchors

[Playwright Fixtures Docs] — https://playwright.dev/docs/test-fixtures — Official guide to fixture scoping; essential for understanding worker vs test scope [HIGH confidence URL]
[LaunchDarkly Playwright Integration] — https://docs.launchdarkly.com/sdk/client-side/javascript/playwright — SDK evaluation model and override patterns [MEDIUM confidence — verify this path]
[Currents.dev Playwright Blog] — https://currents.dev/posts/debugging-playwright-timeouts — Observability patterns for parallel Playwright runs [HIGH confidence URL]
--- END GOLD STANDARD ---

Always output all six sections: Audience, Outcome, Key Arguments, Suggested Structure, Tensions & Honest Critique, Research Anchors.
Match the specificity, the evidence labels on Key Arguments, and the candor in Tensions. A brief without Tensions is incomplete.
`.trim();

export default function LongFormPage() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <LongFormContent />
    </CopilotKit>
  );
}

function LongFormContent() {
  const router = useRouter();
  const { session, sessionLoading } = useSession();
  const { planStatus, loading: planLoading } = usePlanStatus();
  const { stats, isLoadingStats } = useStats(session?.user?.id);
  const { personas } = usePersonas(session?.user?.id);

  // Form state
  const [context, setContext] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState("default");
  const [tone, setTone] = useState("professional");
  const [structure, setStructure] = useState("narrative");
  const [targetLength, setTargetLength] = useState(1500);
  const [depth, setDepth] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [enableWebResearch, setEnableWebResearch] = useState(true);
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [article, setArticle] = useState<LongFormArticle | null>(null);
  const [savedPostId, setSavedPostId] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"input" | "output" | "history" | "brief">("input");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Pipeline state
  type PipelineStage = "idle" | "planning" | "plan-review" | "verifying" | "generating";
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("idle");
  const [planData, setPlanData] = useState<{
    plan_id: string | null;
    outline: Array<{ heading: string; summary: string }>;
    source_budget: SourceBudgetEntry[];
  } | null>(null);
  const [verifiedBudget, setVerifiedBudget] = useState<SourceBudgetEntry[]>([]);
  const [verifyGateReport, setVerifyGateReport] = useState<{
    dead_count: number; total_count: number; dead_rate: number;
  } | null>(null);
  // Derived: any active processing (avoids TypeScript narrowing issues inside JSX guards)
  const isPipelineRunning = pipelineStage !== "idle" && pipelineStage !== "plan-review";
  const isPlanReview = pipelineStage === "plan-review";

  const hasAccess = planStatus?.plan === "organization" || planStatus?.plan === "enterprise";

  useEffect(() => {
    if (!session) return;
    fetchHistory();
  }, [session]);

  const fetchHistory = async () => {
    if (!session) return;
    setIsLoadingHistory(true);
    try {
      const response = await fetch("/api/long-form/history", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch history");
      }
      const data = await response.json();
      setHistory(data.articles || []);
    } catch (error) {
      console.error("[LongForm] History fetch error:", error);
      toast.error("Failed to load history");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLoadFromHistory = (historyArticle: any) => {
    const parsedArticle: LongFormArticle = {
      title: historyArticle.title,
      subtitle: historyArticle.subtitle ?? historyArticle.metadata?.subtitle,
      totalWordCount: historyArticle.totalWordCount,
      sections: historyArticle.sections || [],
      references: Array.isArray(historyArticle.references) ? historyArticle.references : undefined,
      metadata: {
        tone: historyArticle.tone,
        structure: historyArticle.structure,
        depth: historyArticle.depth,
        webResearch: historyArticle.webResearch,
        generatedAt: historyArticle.createdAt,
      },
    };
    setArticle(parsedArticle);
    setActiveTab("output");
    toast.success("Article loaded from history");
  };

  const handleGenerate = async () => {
    if (!context.trim() || context.length < 50) {
      toast.error("Please enter at least 50 characters of context");
      return;
    }

    // Stage 1: PLAN
    setPipelineStage("planning");
    try {
      const planResp = await fetch("/api/longform/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: context.trim() }),
      });
      const planJson = await planResp.json();
      if (!planResp.ok) throw new Error(planJson.error || "Planning failed");
      setPlanData({
        plan_id: planJson.plan_id ?? null,
        outline: planJson.outline ?? [],
        source_budget: planJson.source_budget ?? [],
      });
      setPipelineStage("plan-review");
    } catch (err: any) {
      console.error("[LongForm][plan]", err);
      toast.error(err.message || "Planning step failed — generating without plan");
      setPlanData(null);
      await runGenerate(null, []);
    }
  };

  const handleProceedFromPlan = async () => {
    if (!planData) { await runGenerate(null, []); return; }

    // Stage 2: VERIFY
    setPipelineStage("verifying");
    try {
      const verifyResp = await fetch("/api/longform/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planData.plan_id,
          source_budget: planData.plan_id ? undefined : planData.source_budget,
        }),
      });
      const verifyJson = await verifyResp.json();
      if (!verifyResp.ok) throw new Error(verifyJson.error || "Verification failed");

      if (verifyJson.gate_triggered) {
        setVerifyGateReport({
          dead_count: verifyJson.dead_count,
          total_count: verifyJson.total_count,
          dead_rate: verifyJson.dead_rate,
        });
        setPipelineStage("plan-review");
        toast.error(`Source gate triggered: ${verifyJson.dead_count}/${verifyJson.total_count} sources dead or unsupporting. Review before proceeding.`);
        return;
      }

      const budget = verifyJson.annotated_budget ?? [];
      setVerifiedBudget(budget);
      setVerifyGateReport(null);
      await runGenerate(planData.plan_id, budget);
    } catch (err: any) {
      console.error("[LongForm][verify]", err);
      toast.error(err.message || "Verification failed — proceeding without verified budget");
      await runGenerate(planData.plan_id, []);
    }
  };

  const runGenerate = async (planId: string | null, budget: SourceBudgetEntry[]) => {
    setPipelineStage("generating");
    setIsGenerating(true);
    try {
      let personaVoice: string | undefined;
      if (selectedPersonaId !== "default") {
        const persona = personas?.find(p => p.uuid === selectedPersonaId);
        personaVoice = persona?.prompt;
      }

      const response = await fetch("/api/long-form/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: context.trim(),
          personaVoice,
          tone,
          structure,
          targetLength,
          depth,
          enableWebResearch,
          additionalInstructions: additionalInstructions.trim() || undefined,
          planId,
          verifiedSourceBudget: budget.length > 0 ? budget : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate article");

      setArticle(data.article);
      setSavedPostId(data.post_id ?? null);
      setActiveTab("output");
      toast.success("Article generated successfully!");
      fetchHistory();
    } catch (error: any) {
      console.error("[LongForm] Error:", error);
      toast.error(error.message || "Failed to generate article");
    } finally {
      setIsGenerating(false);
      setPipelineStage("idle");
    }
  };

  const handleCopySection = async (index: number, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedSection(index);
    setTimeout(() => setCopiedSection(null), 2000);
    toast.success("Copied to clipboard");
  };

  const handleCopyAll = async () => {
    if (!article) return;
    const refsBlock =
      article.references && article.references.length > 0
        ? [
            "## References",
            "",
            ...article.references.map(
              (r, i) =>
                `${i + 1}. [${r.title}](${r.url})${r.note ? ` — ${r.note}` : ""}`
            ),
          ].join("\n")
        : "";

    const fullText = [
      `# ${article.title}`,
      article.subtitle ? `*${article.subtitle}*` : '',
      '',
      ...article.sections.map(s => `## ${s.heading}\n\n${s.content}`),
      refsBlock,
    ].filter(Boolean).join('\n\n');
    await navigator.clipboard.writeText(fullText);
    toast.success("Full article copied to clipboard");
  };

  if (sessionLoading || planLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!session) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Header
        session={session}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <div className="flex flex-1 relative">
        <Sidebar
          navItems={[]}
          stats={stats || { campaignsGenerated: 0, scheduledCount: 0, personasSaved: 0 }}
          planStatus={planStatus}
          isLoadingStats={isLoadingStats}
          isMobileSidebarOpen={isMobileSidebarOpen}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
        />

        <main className={`flex-1 p-4 md:p-8 transition-all duration-300 ${
          isSidebarCollapsed ? "md:ml-16" : "md:ml-64"
        }`}>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-foreground-muted hover:text-foreground mb-6 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-8 h-8 text-accent" />
              <h1 className="text-3xl font-black uppercase tracking-tighter">
                Long-Form Content
              </h1>
            </div>
            <p className="text-foreground-muted">Generate articles and structured technical briefs for your audience</p>
          </div>

          {!hasAccess ? (
            <div className="bg-surface border-4 border-border rounded-2xl p-8 text-center">
              <Lock className="w-12 h-12 text-foreground-subtle mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">
                Upgrade to Access Long-Form Generation
              </h2>
              <p className="text-foreground-muted mb-6">
                Blog post and brief generation are available on Organization and Enterprise plans.
              </p>
              <button
                onClick={() => router.push("/pricing")}
                className="bg-accent text-accent-foreground px-6 py-3 rounded-lg font-bold uppercase tracking-widest text-xs hover:bg-accent-strong transition-colors"
              >
                View Plans
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex flex-wrap gap-2 mb-6">
                {(["input", "output", "history", "brief"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    disabled={tab === "output" && !article}
                    className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2 ${
                      activeTab === tab
                        ? "bg-surface text-white"
                        : "bg-surface text-foreground-muted hover:bg-surface-2 border border-border"
                    }`}
                  >
                    {tab === "history" ? `History (${history.length})` :
                     tab === "brief" ? (
                       <>
                         <Sparkles className="w-3.5 h-3.5" />
                         Technical Brief
                       </>
                     ) : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Plan Review Step — shown between input submission and generation */}
              {pipelineStage === "plan-review" && planData && (
                <div className="bg-surface border-4 border-border rounded-2xl p-6 space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-widest text-foreground">Article Plan</h2>
                      <p className="text-sm text-foreground-muted mt-1">
                        Review the outline and source budget before drafting. Most users can proceed directly.
                      </p>
                    </div>
                    <button
                      onClick={() => { setPipelineStage("idle"); setPlanData(null); setVerifyGateReport(null); }}
                      className="text-xs text-foreground-muted hover:text-accent transition-colors flex-shrink-0"
                    >
                      ← Back to input
                    </button>
                  </div>

                  {verifyGateReport && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                      <p className="font-bold mb-1">⚠ Source gate triggered</p>
                      <p>
                        {verifyGateReport.dead_count} of {verifyGateReport.total_count} sources ({Math.round(verifyGateReport.dead_rate * 100)}%) are dead or don&apos;t support their claims — above the 20% threshold.
                        Review and remove dead sources below, or proceed anyway.
                      </p>
                    </div>
                  )}

                  {/* Outline */}
                  {planData.outline.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground-subtle mb-3">Outline</h3>
                      <ol className="space-y-2">
                        {planData.outline.map((section, i) => (
                          <li key={i} className="flex gap-3 p-3 bg-bg border border-border rounded-lg">
                            <span className="text-xs font-bold text-foreground-subtle mt-0.5 flex-shrink-0">{i + 1}.</span>
                            <div>
                              <p className="text-sm font-bold text-foreground">{section.heading}</p>
                              <p className="text-xs text-foreground-muted mt-0.5">{section.summary}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Source budget preview */}
                  {planData.source_budget.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground-subtle mb-3">
                        Source Budget ({planData.source_budget.length})
                      </h3>
                      <div className="space-y-2">
                        {planData.source_budget.map((entry, i) => (
                          <div key={i} className="p-3 bg-bg border border-border rounded-lg text-xs">
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:underline break-all font-medium"
                            >
                              {entry.url}
                            </a>
                            <p className="text-foreground-muted mt-0.5">{entry.justification}</p>
                            {entry.from_brief && (
                              <span className="inline-block mt-1 text-[10px] font-bold uppercase bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                                From brief
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleProceedFromPlan}
                      disabled={isPipelineRunning}
                      className="flex-1 bg-accent text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isPipelineRunning ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Working...</>
                      ) : (
                        <><Sparkles className="w-4 h-4" />Verify &amp; Generate Draft</>
                      )}
                    </button>
                    {verifyGateReport && !isPipelineRunning && (
                      <button
                        onClick={() => runGenerate(planData.plan_id, [])}
                        className="px-4 py-3.5 border-2 border-border-strong hover:border-accent rounded-xl text-foreground-muted hover:text-accent transition-colors font-bold text-sm"
                      >
                        Skip verify &amp; draft anyway
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Input Tab */}
              {activeTab === "input" && !isPlanReview && (
                <div className="bg-surface border-4 border-border rounded-2xl p-6 space-y-6">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-foreground-subtle mb-2">
                      Source Context *
                    </label>
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="Paste your source material here: articles, notes, research, URLs content, etc. The more context you provide, the better the output."
                      className="w-full h-48 p-4 border border-border rounded-xl text-sm resize-none focus:border-accent focus:ring-1 focus:ring-brand-red outline-none text-foreground placeholder:text-foreground-subtle"
                    />
                    <p className="text-xs text-foreground-subtle mt-1">
                      {context.length} characters ({context.length < 50 ? "min 50 required" : "ready"})
                    </p>
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold text-amber-900 mb-1">Pro Tip:</p>
                      <p className="text-xs text-amber-700">Avoid overly verbose or repetitive context/briefs as they can confuse the model and break the generation cycle. Keep your input concise and focused.</p>
                    </div>
                  </div>

                  {/* Web research toggle */}
                  <button
                    type="button"
                    onClick={() => setEnableWebResearch((v) => !v)}
                    aria-pressed={enableWebResearch}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-colors flex items-start gap-4 ${
                      enableWebResearch
                        ? "border-accent bg-red-50/60"
                        : "border-border bg-surface hover:border-border-strong"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${
                        enableWebResearch ? "bg-accent text-white" : "bg-surface-2 text-foreground-muted"
                      }`}
                    >
                      <Globe className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black uppercase tracking-widest text-xs text-foreground">
                          Live Web Research
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            enableWebResearch
                              ? "bg-accent text-white"
                              : "bg-surface-3 text-foreground-muted"
                          }`}
                        >
                          {enableWebResearch ? "On" : "Off"}
                        </span>
                      </div>
                      <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                        Pull current sources from the open web (Exa + Tavily + Firecrawl) and ground the article in real, citable evidence with inline links.
                      </p>
                    </div>
                    <div
                      className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${
                        enableWebResearch ? "bg-accent" : "bg-surface-3"
                      }`}
                      aria-hidden
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${
                          enableWebResearch ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-foreground-subtle mb-2">
                        Voice/Persona
                      </label>
                      <select
                        value={selectedPersonaId}
                        onChange={(e) => setSelectedPersonaId(e.target.value)}
                        className="w-full p-3 border border-border rounded-xl text-sm focus:border-accent outline-none appearance-none bg-surface text-foreground"
                      >
                        <option value="default">Default (no specific voice)</option>
                        {personas?.map((p) => (
                          <option key={p.uuid} value={p.uuid}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-foreground-subtle mb-2">
                        Tone
                      </label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="w-full p-3 border border-border rounded-xl text-sm focus:border-accent outline-none appearance-none bg-surface text-foreground"
                      >
                        {TONE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label} - {t.desc}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-foreground-subtle mb-2">
                        Structure
                      </label>
                      <select
                        value={structure}
                        onChange={(e) => setStructure(e.target.value)}
                        className="w-full p-3 border border-border rounded-xl text-sm focus:border-accent outline-none appearance-none bg-surface text-foreground"
                      >
                        {STRUCTURE_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label} - {s.desc}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-foreground-subtle mb-2">
                        Target Length
                      </label>
                      <select
                        value={targetLength}
                        onChange={(e) => setTargetLength(Number(e.target.value))}
                        className="w-full p-3 border border-border rounded-xl text-sm focus:border-accent outline-none appearance-none bg-surface text-foreground"
                      >
                        {LENGTH_OPTIONS.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-black uppercase tracking-widest text-foreground-subtle mb-2">
                        <span className="inline-flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5" />
                          Reader Depth
                        </span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {DEPTH_OPTIONS.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setDepth(d.value as typeof depth)}
                            className={`p-3 rounded-xl border-2 text-left transition-colors ${
                              depth === d.value
                                ? "border-accent bg-red-50/60"
                                : "border-border bg-surface hover:border-border-strong"
                            }`}
                          >
                            <div className="text-sm font-black text-foreground">{d.label}</div>
                            <div className="text-xs text-foreground-muted mt-0.5 leading-snug">{d.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-foreground-subtle mb-2">
                      Additional Instructions (Optional)
                    </label>
                    <textarea
                      value={additionalInstructions}
                      onChange={(e) => setAdditionalInstructions(e.target.value)}
                      placeholder="Any specific requirements, focus areas, or constraints..."
                      className="w-full h-24 p-4 border border-border rounded-xl text-sm resize-none focus:border-accent focus:ring-1 focus:ring-brand-red outline-none text-foreground placeholder:text-foreground-subtle"
                    />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isPipelineRunning || context.length < 50}
                    className="w-full bg-accent text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isPipelineRunning ? (
                      <><Loader2 className="w-5 h-5 animate-spin" />Working...</>
                    ) : (
                      <><Sparkles className="w-5 h-5" />Generate Blog Post</>
                    )}
                  </button>
                  <p className="text-xs text-foreground-subtle text-center -mt-2 leading-relaxed">
                    Pipeline: Plan → Verify sources → Draft → Audit → Review. Every article runs through the slop validator.
                  </p>
                </div>
              )}

              {/* Output Tab */}
              {activeTab === "output" && article && (
                <div className="space-y-6">
                  <div className="bg-surface border-4 border-border rounded-2xl p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="min-w-0">
                        <h2 className="text-2xl font-black text-foreground mb-1 text-balance">{article.title}</h2>
                        {article.subtitle && (
                          <p className="text-foreground-muted">{article.subtitle}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {savedPostId && (
                          <button
                            onClick={() => router.push(`/dashboard/longform/${savedPostId}/review`)}
                            className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 text-foreground rounded-lg text-sm font-bold transition-colors border border-border"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Review
                          </button>
                        )}
                        <button
                          onClick={handleCopyAll}
                          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-strong text-accent-foreground rounded-lg text-sm font-bold transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                          Copy All
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-md bg-surface-2 text-foreground font-medium">
                        {article.totalWordCount} words
                      </span>
                      <span className="px-2 py-1 rounded-md bg-surface-2 text-foreground font-medium capitalize">
                        {article.metadata.tone} tone
                      </span>
                      <span className="px-2 py-1 rounded-md bg-surface-2 text-foreground font-medium capitalize">
                        {article.metadata.structure}
                      </span>
                      {article.metadata.depth && (
                        <span className="px-2 py-1 rounded-md bg-surface-2 text-foreground font-medium capitalize">
                          {article.metadata.depth} depth
                        </span>
                      )}
                      {article.metadata.webResearch && (
                        <span className="px-2 py-1 rounded-md bg-green-100 text-green-800 font-bold inline-flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          Web-researched
                        </span>
                      )}
                      {article.references && article.references.length > 0 && (
                        <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-800 font-bold inline-flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          {article.references.length} sources
                        </span>
                      )}
                    </div>
                  </div>

                  {article.sections.map((section, index) => (
                    <div key={index} className="bg-surface border border-border rounded-xl p-6 group">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h3 className="text-lg font-bold text-foreground text-pretty">{section.heading}</h3>
                        <button
                          onClick={() => handleCopySection(index, `## ${section.heading}\n\n${section.content}`)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-foreground rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                        >
                          {copiedSection === index ? (
                            <>
                              <Check className="w-3 h-3 text-green-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <ArticleMarkdown content={section.content} />
                      <p className="text-xs text-foreground-subtle mt-4">{section.wordCount} words</p>
                    </div>
                  ))}

                  {/* References / Sources */}
                  {article.references && article.references.length > 0 && (
                    <div className="bg-surface border border-border rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Link2 className="w-5 h-5 text-accent" />
                        <h3 className="text-lg font-black uppercase tracking-widest text-foreground">
                          References
                        </h3>
                        <span className="text-xs text-foreground-subtle">
                          ({article.references.length})
                        </span>
                      </div>
                      <ol className="space-y-3">
                        {article.references.map((ref, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="text-xs font-bold text-foreground-subtle mt-0.5 flex-shrink-0 w-6">
                              [{i + 1}]
                            </span>
                            <div className="min-w-0 flex-1">
                              <a
                                href={ref.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-bold text-foreground hover:text-accent transition-colors inline-flex items-start gap-1.5 group/ref break-words"
                              >
                                <span className="break-words">{ref.title}</span>
                                <ExternalLink className="w-3 h-3 mt-1 flex-shrink-0 opacity-0 group-hover/ref:opacity-100 transition-opacity" />
                              </a>
                              {ref.note && (
                                <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">
                                  {ref.note}
                                </p>
                              )}
                              <p className="text-xs text-foreground-subtle mt-0.5 break-all">
                                {ref.url}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setArticle(null);
                      setActiveTab("input");
                    }}
                    className="w-full py-3 border-2 border-dashed border-border-strong rounded-xl text-foreground-muted hover:border-accent hover:text-accent transition-colors font-medium"
                  >
                    Generate Another Article
                  </button>
                </div>
              )}

              {/* History Tab */}
              {activeTab === "history" && (
                <div className="bg-surface border-4 border-border rounded-2xl p-6">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-accent" />
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-foreground-subtle mx-auto mb-4" />
                      <p className="text-foreground-muted font-medium">No articles generated yet</p>
                      <p className="text-foreground-subtle text-sm mt-1">Generate your first article to see it here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="font-bold text-foreground mb-4">Generated Articles</h3>
                      {history.map((historyArticle, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleLoadFromHistory(historyArticle)}
                          className="p-4 border border-border rounded-xl hover:border-accent hover:bg-bg transition-colors cursor-pointer group"
                        >
                          <h4 className="font-bold text-foreground group-hover:text-accent transition-colors">
                            {historyArticle.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-foreground-muted">
                            <span>{historyArticle.totalWordCount} words</span>
                            <span className="text-foreground-subtle">|</span>
                            <span className="capitalize">{historyArticle.structure}</span>
                            <span className="text-foreground-subtle">|</span>
                            <span className="capitalize">{historyArticle.tone}</span>
                            {historyArticle.depth && (
                              <>
                                <span className="text-foreground-subtle">|</span>
                                <span className="capitalize">{historyArticle.depth}</span>
                              </>
                            )}
                            <span className="text-foreground-subtle">|</span>
                            <span>{new Date(historyArticle.createdAt).toLocaleDateString()}</span>
                            {historyArticle.webResearch && (
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-bold inline-flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                Web
                              </span>
                            )}
                            {Array.isArray(historyArticle.references) &&
                              historyArticle.references.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold inline-flex items-center gap-1">
                                  <Link2 className="w-3 h-3" />
                                  {historyArticle.references.length}
                                </span>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Technical Brief Tab */}
              {activeTab === "brief" && (
                <BriefTab session={session} />
              )}
            </>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArticleMarkdown — rich rendering for generated long-form sections
// Handles: markdown, inline links, fenced code (with syntax highlighting),
// and ASCII / line diagrams (rendered in monospace, no highlighting).
// ---------------------------------------------------------------------------
const DIAGRAM_LANGS = new Set(["diagram", "text", "ascii", "txt", "plain", ""]);

function ArticleMarkdown({ content }: { content: string }) {
  return (
    <div
      className="prose prose-slate dark:prose-invert prose-sm md:prose-base max-w-none
        prose-headings:font-black prose-headings:tracking-tight prose-headings:text-foreground
        prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-2
        prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2
        prose-p:text-foreground prose-p:leading-relaxed
        prose-li:text-foreground prose-li:leading-relaxed
        prose-strong:text-foreground prose-strong:font-bold
        prose-a:text-accent prose-a:font-medium prose-a:no-underline hover:prose-a:underline
        prose-blockquote:border-l-brand-red prose-blockquote:bg-bg prose-blockquote:rounded-r prose-blockquote:py-1
        prose-code:bg-surface-2 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em] prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none
      "
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const lang = (match?.[1] || "").toLowerCase();
            const codeStr = String(children).replace(/\n$/, "");

            // No language class = inline code — react-markdown v10 dropped the inline prop
            if (!match) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            // ASCII diagrams / plain text → monospace pre, no highlighter
            if (DIAGRAM_LANGS.has(lang)) {
              return (
                <div className="my-4 rounded-lg border border-border bg-bg overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-border bg-surface">
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">
                      {lang === "diagram" ? "Diagram" : lang || "Text"}
                    </span>
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm leading-none font-mono text-foreground whitespace-pre">
                    <code>{codeStr}</code>
                  </pre>
                </div>
              );
            }

            // Highlighted code block
            return (
              <div className="my-4 rounded-lg overflow-hidden border border-slate-800">
                <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground-subtle">
                    {lang || "code"}
                  </span>
                </div>
                <SyntaxHighlighter
                  language={lang || "text"}
                  style={oneDark as any}
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    fontSize: "0.8rem",
                    lineHeight: 1.55,
                    background: "#0f172a",
                  }}
                  codeTagProps={{ style: { fontFamily: "var(--font-mono, ui-monospace, monospace)" } }}
                >
                  {codeStr}
                </SyntaxHighlighter>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Technical Brief Tab — powered by CopilotKit agent with Google Search
// ---------------------------------------------------------------------------
function BriefTab({ session }: { session: any }) {
  const [topic, setTopic] = useState("");
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [anchorResults, setAnchorResults] = useState<Array<{
    url: string; status: string; claim_support?: string;
  }> | null>(null);
  const [isVerifyingAnchors, setIsVerifyingAnchors] = useState(false);

  // In CopilotKit v1.56.5 there is a type/runtime mismatch:
  //   • TS type says useCopilotChatInternal returns `visibleMessages`
  //   • Runtime actually returns a property called `messages`
  // We cast to any and probe both names so the component works regardless.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _chat = useCopilotChatInternal() as any;
  const messages: any[] = _chat.messages ?? _chat.visibleMessages ?? [];
  const appendMessage: (...args: any[]) => Promise<void> = _chat.appendMessage;
  const isLoading: boolean = Boolean(_chat.isLoading);
  const stopGeneration: () => void = _chat.stopGeneration ?? (() => {});

  // Make the topic available to the agent as context
  useCopilotReadable({
    description:
      "The user's topic, rough notes, or target audience they want turned into a structured technical brief.",
    value: topic,
  });

  // Discipline rules first — what NOT to do (framing, evidence, URL hygiene)
  useCopilotAdditionalInstructions({
    instructions: BRIEF_DISCIPLINE_RULES,
  });

  // Gold-standard example — what the output format and depth should look like
  useCopilotAdditionalInstructions({
    instructions: BRIEF_GOLD_STANDARD,
  });

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic or notes first");
      return;
    }
    try {
      await appendMessage(
        new TextMessage({
          role: Role.User,
          content: `Generate a comprehensive technical brief for: ${topic}`,
        })
      );
    } catch (err) {
      console.error("[BriefTab] appendMessage error:", err);
      toast.error("Failed to start generation. Please try again.");
    }
  }, [topic, appendMessage]);

  // Extract the latest assistant message text (messages may be undefined before agent syncs)
  const briefText: string = (() => {
    const msgs = messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i] as any;
      if (m.role === "assistant" && typeof m.content === "string" && m.content.length > 0) {
        return m.content as string;
      }
    }
    return "";
  })();

  const handleCopyBrief = useCallback(() => {
    if (!briefText) return;
    navigator.clipboard.writeText(briefText);
    setCopiedBrief(true);
    toast.success("Brief copied to clipboard");
    setTimeout(() => setCopiedBrief(false), 2000);
  }, [briefText]);

  const handleVerifyAnchors = useCallback(async () => {
    if (!briefText || !session) return;
    // Extract all https URLs from the brief text
    const urls = [...new Set(
      [...briefText.matchAll(/https?:\/\/[^\s\)\]"']+/g)].map(m => m[0].replace(/[.,;:]+$/, ""))
    )];
    if (urls.length === 0) { toast.error("No URLs found in brief"); return; }

    setIsVerifyingAnchors(true);
    setAnchorResults(null);
    try {
      const resp = await fetch("/api/longform/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          source_budget: urls.map(url => ({
            url,
            justification: "Research anchor from brief",
            from_brief: true,
            supports_claims: [],
          })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Verification failed");
      setAnchorResults(
        (data.annotated_budget ?? []).map((e: any) => ({
          url: e.url,
          status: e.status ?? "unknown",
          claim_support: e.claim_support,
        }))
      );
      const deadCount = (data.annotated_budget ?? []).filter((e: any) => e.status === "dead").length;
      if (deadCount > 0) {
        toast.error(`${deadCount} of ${urls.length} research anchor${urls.length !== 1 ? "s" : ""} are dead or unreachable`);
      } else {
        toast.success(`All ${urls.length} research anchors resolved`);
      }
    } catch (err: any) {
      toast.error(err.message || "Anchor verification failed");
    } finally {
      setIsVerifyingAnchors(false);
    }
  }, [briefText, session]);

  return (
    <div className="space-y-6">
      {/* Input card */}
      <div className="bg-surface border-4 border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest text-foreground">
              Technical Brief Generator
            </h2>
            <p className="text-sm text-foreground-muted mt-0.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-green-500" />
              AI agent with real-time web search · Audience · Outcome · Structure · Research Anchors
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-foreground-subtle mb-2">
            Topic / Notes *
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Describe your topic, paste rough notes, or outline your target audience and their pain points. The more context you give, the more detailed the brief."
            className="w-full h-44 p-4 border border-border rounded-xl text-sm resize-none focus:border-accent focus:ring-1 focus:ring-brand-red outline-none text-foreground placeholder:text-foreground-subtle"
            disabled={isLoading}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !topic.trim()}
            className="flex-1 bg-accent text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Brief...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {briefText ? "Regenerate Brief" : "Generate Brief"}
              </>
            )}
          </button>

          {isLoading && (
            <button
              onClick={stopGeneration}
              className="px-4 py-3.5 border-2 border-border-strong hover:border-red-300 rounded-xl text-foreground-muted hover:text-accent transition-colors font-bold text-sm flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Streaming / completed output */}
      {(briefText || isLoading) && (
        <div className="bg-surface border-4 border-border rounded-2xl overflow-hidden">
          {/* Output header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg">
            <div className="flex items-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span className="text-xs font-black uppercase tracking-widest text-foreground-muted">
                    Writing Brief...
                  </span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-foreground-muted">
                    Brief Ready
                  </span>
                </>
              )}
            </div>
            {briefText && !isLoading && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleVerifyAnchors}
                  disabled={isVerifyingAnchors}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-border text-foreground rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {isVerifyingAnchors ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</>
                  ) : (
                    <><Link2 className="w-4 h-4" />Verify Anchors</>
                  )}
                </button>
                <button
                  onClick={handleCopyBrief}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-strong text-accent-foreground rounded-lg text-sm font-bold transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy All
                </button>
              </div>
            )}
          </div>

          <div
            className="px-8 py-8 lg:px-12
              prose prose-slate dark:prose-invert max-w-none
              prose-headings:font-black prose-headings:tracking-tight prose-headings:text-foreground
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
              prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
              prose-p:text-foreground prose-p:leading-relaxed
              prose-li:text-foreground prose-li:leading-relaxed
              prose-strong:text-foreground
              prose-a:text-accent prose-a:no-underline hover:prose-a:underline
              prose-code:bg-surface-2 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:text-foreground"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {briefText}
            </ReactMarkdown>
          </div>

          {/* Anchor verification results */}
          {anchorResults && (
            <div className="mx-6 mb-4 border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center gap-2">
                <Link2 className="w-4 h-4 text-foreground-muted" />
                <span className="text-xs font-black uppercase tracking-widest text-foreground">
                  Research Anchor Verification ({anchorResults.length})
                </span>
                {anchorResults.some(r => r.status === "dead") && (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-800 ml-auto">
                    {anchorResults.filter(r => r.status === "dead").length} dead
                  </span>
                )}
              </div>
              <div className="divide-y divide-border">
                {anchorResults.map((result, i) => (
                  <div key={i} className={`px-4 py-2.5 flex items-start gap-3 text-xs ${result.status === "dead" ? "bg-red-50" : "bg-bg"}`}>
                    <span className={`font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${
                      result.status === "resolved" ? "bg-green-100 text-green-800" :
                      result.status === "redirected" ? "bg-blue-100 text-blue-800" :
                      result.status === "paywalled" ? "bg-amber-100 text-amber-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {result.status}
                    </span>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`break-all hover:underline flex-1 ${result.status === "dead" ? "text-red-700 line-through" : "text-accent"}`}
                    >
                      {result.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer copy button (repeated for convenience on long briefs) */}
          {briefText && !isLoading && (
            <div className="px-6 pb-6 flex justify-end">
              <button
                onClick={handleCopyBrief}
                          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-strong text-accent-foreground rounded-lg text-sm font-bold transition-colors"
                        >
                {copiedBrief ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Brief
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!briefText && !isLoading && (
        <div className="text-center py-20 text-foreground-subtle">
          <div className="relative inline-block mb-6">
            <FileText className="w-14 h-14 opacity-20" />
            <Globe className="w-5 h-5 text-green-500 absolute -bottom-1 -right-1" />
          </div>
          <p className="font-bold text-foreground-muted text-lg">Enter your topic above</p>
          <p className="text-sm mt-2 max-w-sm mx-auto">
            The agent searches the web in real time and returns a structured brief with Audience, Outcome, Key Arguments, Suggested Structure, and Research Anchors.
          </p>
        </div>
      )}
    </div>
  );
}

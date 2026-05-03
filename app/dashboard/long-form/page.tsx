"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Sidebar from "@/components/dashboard/Sidebar";
import { useSession } from "@/components/hooks/useSession";
import { usePlanStatus } from "@/components/hooks/usePlanStatus";
import { usePersonas } from "@/components/hooks/usePersonas";
import { CopilotKit, useCopilotChatInternal, useCopilotReadable, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";

interface LongFormSection {
  heading: string;
  content: string;
  wordCount: number;
}

interface LongFormArticle {
  title: string;
  subtitle?: string;
  sections: LongFormSection[];
  totalWordCount: number;
  metadata: {
    tone: string;
    structure: string;
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

// Gold-standard example injected as additional instructions for the brief agent
const BRIEF_GOLD_STANDARD = `Here is your GOLD STANDARD example of the exact tone, depth, and structure you must follow:

--- START GOLD STANDARD ---
## Audience

Senior SDETs, staff engineers, and QA leads running Playwright at scale within CI/CD pipelines. They've shipped feature-flagged code before and rely on LaunchDarkly, Split/Harness, Flagsmith, or a homegrown toggle system. Their pain points: tests that break when flags change in shared environments, parallel workers colliding on flag state, and flag-dependent tests either too tightly coupled to a live SDK or too loosely defined to be trusted. They want architectural patterns, not a beginner introduction to feature flags.

## Outcome

By the end, readers will understand why feature flags break Playwright's isolation model, know the exact mechanisms (route mocking, fixture-level injection, per-worker scoping, globalSetup seeding) to achieve deterministic per-test flag state, and be able to audit their own suites for flag-induced flakiness.

## Key Arguments

1. Playwright isolates browser context, not external flag state — treating them as equivalent is the root cause of flag-induced flakiness.
2. API-level flag mutation under parallelism is an anti-pattern; fixture-level injection is the correct primitive.
3. Flag state must be declared like auth state — deterministic and scoped — not read reactively from the environment.
4. Worker-scoped fixtures are faster but require all co-located tests to share identical flag configurations.
5. Cross-run observability (not just test isolation) is required to diagnose flag-induced regressions reliably.

## Suggested Structure

### Introduction
- Open with the core tension: feature flags and Playwright's isolation guarantees operate at different layers.
- Playwright isolates browser contexts (cookies, localStorage, sessions), but feature flags are evaluated outside that boundary — often via backend services or SDKs. This creates hidden shared state across tests.
- Example: a beforeAll mutating a flag via an API in Worker 1 can affect what Worker 3 sees mid-test.
- Acknowledge the common initial response: hardcoding flag state in environments, conditional test logic. Explain why these break under parallelism.
- [Internal link: Playwright adoption guide]

## H2: Why Feature Flags Break Playwright's Isolation Model
- Clarify that Playwright isolation is not broken, but limited to browser context. Feature flags introduce state outside that boundary.
- Flag evaluation paths: server-side evaluation based on user identity; client-side SDK fetching remote config; cookie or header overrides.

### H3: The Shared Environment Problem
- In shared environments, flag state is effectively global unless scoped per user. Parallel workers operate as the same user, hit the same endpoints, and share flag state.
- [Code example: beforeAll API mutation creating cross-worker race condition]
- [Internal link: Debugging Playwright timeouts]
- [External link: https://currents.dev/posts/debugging-playwright-timeouts]

### H3: Conditional Test Logic as a Code Smell
- Critique: if (featureEnabled) { … } else { test.skip() }
- Principle: Flag state should be declared like auth state, not read reactively.
- [Internal link: Building reliable Playwright tests]

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

## H2: Research Anchors

[Playwright Fixtures Docs] — https://playwright.dev/docs/test-fixtures — Official guide to fixture scoping; essential for understanding worker vs test scope
[LaunchDarkly Playwright Integration] — https://docs.launchdarkly.com — SDK evaluation model and override patterns
[Currents.dev Playwright Blog] — https://currents.dev/posts — Observability patterns for parallel Playwright runs
--- END GOLD STANDARD ---

Always output all five sections: Audience, Outcome, Key Arguments, Suggested Structure, Research Anchors. Match this level of specificity and depth.`;

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
  const { planStatus, stats, isLoading: planLoading } = usePlanStatus(session);
  const { personas } = usePersonas(session?.user?.id);

  // Form state
  const [context, setContext] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState("default");
  const [tone, setTone] = useState("professional");
  const [structure, setStructure] = useState("narrative");
  const [targetLength, setTargetLength] = useState(1500);
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [article, setArticle] = useState<LongFormArticle | null>(null);
  const [copiedSection, setCopiedSection] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"input" | "output" | "history" | "brief">("input");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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
      subtitle: historyArticle.metadata?.subtitle,
      totalWordCount: historyArticle.totalWordCount,
      sections: historyArticle.sections || [],
      metadata: {
        tone: historyArticle.tone,
        structure: historyArticle.structure,
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
          additionalInstructions: additionalInstructions.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate article");

      setArticle(data.article);
      setActiveTab("output");
      toast.success("Article generated successfully!");
      fetchHistory();
    } catch (error: any) {
      console.error("[LongForm] Error:", error);
      toast.error(error.message || "Failed to generate article");
    } finally {
      setIsGenerating(false);
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
    const fullText = [
      `# ${article.title}`,
      article.subtitle ? `*${article.subtitle}*` : '',
      '',
      ...article.sections.map(s => `## ${s.heading}\n\n${s.content}`),
    ].filter(Boolean).join('\n\n');
    await navigator.clipboard.writeText(fullText);
    toast.success("Full article copied to clipboard");
  };

  if (sessionLoading || planLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
      </div>
    );
  }

  if (!session) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        session={session}
        onOpenSettings={() => {}}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <div className="flex flex-1 relative">
        <Sidebar
          navItems={[]}
          stats={stats || { campaignsGenerated: 0, scheduledCount: 0, personasSaved: 0 }}
          planStatus={planStatus}
          isLoadingStats={planLoading}
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
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-8 h-8 text-brand-red" />
              <h1 className="text-3xl font-black uppercase tracking-tighter">
                Long-Form Content
              </h1>
            </div>
            <p className="text-slate-500">Generate articles and structured technical briefs for your audience</p>
          </div>

          {!hasAccess ? (
            <div className="bg-white border-4 border-slate-200 rounded-2xl p-8 text-center">
              <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Upgrade to Access Long-Form Generation
              </h2>
              <p className="text-slate-500 mb-6">
                Blog post and brief generation are available on Organization and Enterprise plans.
              </p>
              <button
                onClick={() => router.push("/pricing")}
                className="bg-brand-navy text-white px-6 py-3 rounded-lg font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors"
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
                        ? "bg-brand-navy text-white"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
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

              {/* Input Tab */}
              {activeTab === "input" && (
                <div className="bg-white border-4 border-slate-200 rounded-2xl p-6 space-y-6">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Source Context *
                    </label>
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="Paste your source material here: articles, notes, research, URLs content, etc. The more context you provide, the better the output."
                      className="w-full h-48 p-4 border border-slate-200 rounded-xl text-sm resize-none focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none text-brand-slate placeholder:text-slate-400"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      {context.length} characters ({context.length < 50 ? "min 50 required" : "ready"})
                    </p>
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold text-amber-900 mb-1">💡 Pro Tip:</p>
                      <p className="text-xs text-amber-700">Avoid overly verbose or repetitive context/briefs as they can confuse the model and break the generation cycle. Keep your input concise and focused.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                        Voice/Persona
                      </label>
                      <select
                        value={selectedPersonaId}
                        onChange={(e) => setSelectedPersonaId(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-brand-red outline-none appearance-none bg-white text-brand-slate"
                      >
                        <option value="default">Default (no specific voice)</option>
                        {personas?.map((p) => (
                          <option key={p.uuid} value={p.uuid}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                        Tone
                      </label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-brand-red outline-none appearance-none bg-white text-brand-slate"
                      >
                        {TONE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label} - {t.desc}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                        Structure
                      </label>
                      <select
                        value={structure}
                        onChange={(e) => setStructure(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-brand-red outline-none appearance-none bg-white text-brand-slate"
                      >
                        {STRUCTURE_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label} - {s.desc}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                        Target Length
                      </label>
                      <select
                        value={targetLength}
                        onChange={(e) => setTargetLength(Number(e.target.value))}
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-brand-red outline-none appearance-none bg-white text-brand-slate"
                      >
                        {LENGTH_OPTIONS.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Additional Instructions (Optional)
                    </label>
                    <textarea
                      value={additionalInstructions}
                      onChange={(e) => setAdditionalInstructions(e.target.value)}
                      placeholder="Any specific requirements, focus areas, or constraints..."
                      className="w-full h-24 p-4 border border-slate-200 rounded-xl text-sm resize-none focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none text-brand-slate placeholder:text-slate-400"
                    />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || context.length < 50}
                    className="w-full bg-brand-red text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating Article...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Blog Post
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Output Tab */}
              {activeTab === "output" && article && (
                <div className="space-y-6">
                  <div className="bg-white border-4 border-slate-200 rounded-2xl p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 mb-1">{article.title}</h2>
                        {article.subtitle && (
                          <p className="text-slate-500">{article.subtitle}</p>
                        )}
                      </div>
                      <button
                        onClick={handleCopyAll}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-brand-slate hover:text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        Copy All
                      </button>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>{article.totalWordCount} words</span>
                      <span>|</span>
                      <span className="capitalize">{article.metadata.tone} tone</span>
                      <span>|</span>
                      <span className="capitalize">{article.metadata.structure} structure</span>
                    </div>
                  </div>

                  {article.sections.map((section, index) => (
                    <div key={index} className="bg-white border border-slate-200 rounded-xl p-6 group">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h3 className="text-lg font-bold text-slate-900">{section.heading}</h3>
                        <button
                          onClick={() => handleCopySection(index, `## ${section.heading}\n\n${section.content}`)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-brand-slate hover:text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          {copiedSection === index ? (
                            <>
                              <Check className="w-3 h-3 text-green-400" />
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
                      <div className="prose prose-slate prose-sm max-w-none">
                        <p className="whitespace-pre-wrap text-brand-slate leading-relaxed">
                          {section.content}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 mt-4">{section.wordCount} words</p>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      setArticle(null);
                      setActiveTab("input");
                    }}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-brand-red hover:text-brand-red transition-colors font-medium"
                  >
                    Generate Another Article
                  </button>
                </div>
              )}

              {/* History Tab */}
              {activeTab === "history" && (
                <div className="bg-white border-4 border-slate-200 rounded-2xl p-6">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">No articles generated yet</p>
                      <p className="text-slate-400 text-sm mt-1">Generate your first article to see it here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-900 mb-4">Generated Articles</h3>
                      {history.map((historyArticle, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleLoadFromHistory(historyArticle)}
                          className="p-4 border border-slate-200 rounded-xl hover:border-brand-red hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                          <h4 className="font-bold text-slate-900 group-hover:text-brand-red transition-colors">
                            {historyArticle.title}
                          </h4>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>{historyArticle.totalWordCount} words</span>
                            <span className="capitalize">{historyArticle.structure}</span>
                            <span className="capitalize">{historyArticle.tone}</span>
                            <span>{new Date(historyArticle.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Technical Brief Tab */}
              {activeTab === "brief" && (
                <BriefTab />
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
// Technical Brief Tab — powered by CopilotKit agent with Google Search
// ---------------------------------------------------------------------------
function BriefTab() {
  const [topic, setTopic] = useState("");
  const [copiedBrief, setCopiedBrief] = useState(false);

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

  // Inject the gold-standard example so the agent knows the exact output format
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

  return (
    <div className="space-y-6">
      {/* Input card */}
      <div className="bg-white border-4 border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest text-slate-900">
              Technical Brief Generator
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-green-500" />
              AI agent with real-time web search · Audience · Outcome · Structure · Research Anchors
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
            Topic / Notes *
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Describe your topic, paste rough notes, or outline your target audience and their pain points. The more context you give, the more detailed the brief."
            className="w-full h-44 p-4 border border-slate-200 rounded-xl text-sm resize-none focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none text-brand-slate placeholder:text-slate-400"
            disabled={isLoading}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !topic.trim()}
            className="flex-1 bg-brand-red text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              className="px-4 py-3.5 border-2 border-slate-300 hover:border-red-300 rounded-xl text-slate-600 hover:text-brand-red transition-colors font-bold text-sm flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Streaming / completed output */}
      {(briefText || isLoading) && (
        <div className="bg-white border-4 border-slate-200 rounded-2xl overflow-hidden">
          {/* Output header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-brand-red" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Writing Brief...
                  </span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Brief Ready
                  </span>
                </>
              )}
            </div>
            {briefText && !isLoading && (
              <button
                onClick={handleCopyBrief}
                className="flex items-center gap-2 px-4 py-2 bg-brand-navy hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition-colors"
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
            )}
          </div>

          {/* Rendered markdown output */}
          <div className="p-6 md:p-8">
            <div className="prose prose-slate prose-sm md:prose-base max-w-none
              prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-900
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-100
              prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
              prose-p:text-slate-700 prose-p:leading-relaxed
              prose-li:text-slate-700 prose-li:leading-relaxed
              prose-strong:text-slate-900
              prose-a:text-brand-red prose-a:no-underline hover:prose-a:underline
              prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:text-slate-800
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {briefText}
              </ReactMarkdown>
            </div>
          </div>

          {/* Footer copy button (repeated for convenience on long briefs) */}
          {briefText && !isLoading && (
            <div className="px-6 pb-6 flex justify-end">
              <button
                onClick={handleCopyBrief}
                className="flex items-center gap-2 px-4 py-2 bg-brand-navy hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition-colors"
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
        <div className="text-center py-20 text-slate-400">
          <div className="relative inline-block mb-6">
            <FileText className="w-14 h-14 opacity-20" />
            <Globe className="w-5 h-5 text-green-500 absolute -bottom-1 -right-1" />
          </div>
          <p className="font-bold text-slate-500 text-lg">Enter your topic above</p>
          <p className="text-sm mt-2 max-w-sm mx-auto">
            The agent searches the web in real time and returns a structured brief with Audience, Outcome, Key Arguments, Suggested Structure, and Research Anchors.
          </p>
        </div>
      )}
    </div>
  );
}

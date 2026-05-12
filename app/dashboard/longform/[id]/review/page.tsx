"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  Link2,
  ExternalLink,
  Code2,
  User,
  FileText,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Globe,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import Header from "@/components/Header";
import Sidebar from "@/components/dashboard/Sidebar";
import { useSession } from "@/components/hooks/useSession";
import { usePlanStatus } from "@/components/hooks/usePlanStatus";
import { useStats } from "@/components/hooks/useStats";
import type { AuditFlag, AuditReport, SourceBudgetEntry, LongformPlan } from "@/lib/types/longform";

interface ReviewData {
  post: {
    id: string;
    title: string;
    content: string;
    sections: any[];
    references?: any[];
    metadata: any;
  };
  plan: LongformPlan | null;
  audit: AuditReport | null;
}

// ---------------------------------------------------------------------------
// Severity colours
// ---------------------------------------------------------------------------
function severityClass(severity: AuditFlag["severity"]) {
  if (severity === "error") return "bg-red-50 border-red-200 text-red-800";
  if (severity === "warning") return "bg-amber-50 border-amber-200 text-amber-800";
  return "bg-blue-50 border-blue-200 text-blue-800";
}

function severityIcon(severity: AuditFlag["severity"]) {
  if (severity === "error") return <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />;
  return <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />;
}

function statusBadge(status: SourceBudgetEntry["status"]) {
  if (!status) return null;
  const map: Record<string, string> = {
    resolved: "bg-green-100 text-green-800",
    redirected: "bg-blue-100 text-blue-800",
    dead: "bg-red-100 text-red-800",
    paywalled: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${map[status] || "bg-surface-2 text-foreground-muted"}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Annotated content renderer — highlights flagged spans
// ---------------------------------------------------------------------------
const DIAGRAM_LANGS = new Set(["diagram", "text", "ascii", "txt", "plain", ""]);

function ReviewMarkdown({ content }: { content: string }) {
  return (
    <div
      className="prose prose-slate dark:prose-invert prose-sm md:prose-base max-w-none
        prose-headings:font-black prose-headings:tracking-tight prose-headings:text-foreground
        prose-p:text-foreground prose-p:leading-relaxed
        prose-li:text-foreground prose-li:leading-relaxed
        prose-strong:text-foreground prose-strong:font-bold
        prose-a:text-accent prose-a:font-medium prose-a:no-underline hover:prose-a:underline
        prose-code:bg-surface-2 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em] prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const lang = (match?.[1] || "").toLowerCase();
            const codeStr = String(children).replace(/\n$/, "");

            if (!match) {
              return <code className={className} {...props}>{children}</code>;
            }

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

            const hasPlaceholder = codeStr.includes("<COMPUTED_AT_VALIDATION>");
            return (
              <div className={`my-4 rounded-lg overflow-hidden border ${hasPlaceholder ? "border-amber-400" : "border-slate-800"}`}>
                <div className={`px-3 py-1.5 border-b flex items-center justify-between ${hasPlaceholder ? "bg-amber-50 border-amber-300" : "bg-slate-900 border-slate-800"}`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${hasPlaceholder ? "text-amber-700" : "text-foreground-subtle"}`}>
                    {lang || "code"}
                  </span>
                  {hasPlaceholder && (
                    <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Placeholder — needs real value
                    </span>
                  )}
                </div>
                <SyntaxHighlighter
                  language={lang || "text"}
                  style={oneDark as any}
                  customStyle={{ margin: 0, padding: "1rem", fontSize: "0.8rem", lineHeight: 1.55, background: "#0f172a" }}
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
// Collapsible panel
// ---------------------------------------------------------------------------
function Panel({ title, icon, count, countColor, children }: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  countColor?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-black text-sm uppercase tracking-widest text-foreground">{title}</span>
          {count !== undefined && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${countColor || "bg-surface-3 text-foreground-muted"}`}>
              {count}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-foreground-muted" /> : <ChevronRight className="w-4 h-4 text-foreground-muted" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ReviewPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params?.id as string;
  const { session, sessionLoading } = useSession();
  const { planStatus, loading: planLoading } = usePlanStatus();
  const { stats, isLoadingStats } = useStats(session?.user?.id);

  const [data, setData] = useState<ReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session || !postId) return;
    loadReview();
  }, [session, postId]);

  const loadReview = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/longform/${postId}/review`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Failed to load review data");
      }
      const json = await resp.json();
      setData(json);
    } catch (e: any) {
      toast.error(e.message || "Failed to load article review");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAll = useCallback(async () => {
    if (!data?.post.content) return;
    await navigator.clipboard.writeText(data.post.content);
    setCopied(true);
    toast.success("Article copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

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

  const audit = data?.audit;
  const sourceBudget: SourceBudgetEntry[] = data?.plan?.source_budget ?? [];
  const allFlags = audit?.flags ?? [];
  const errorFlags = allFlags.filter((f) => f.severity === "error");
  const warnFlags = allFlags.filter((f) => f.severity === "warning");
  const namedPersonFlags = allFlags.filter((f) => f.type === "fabricated-authority");
  const codeFlags = allFlags.filter((f) => f.type === "suspicious-hash" || f.type === "placeholder" || f.type === "lint-error");
  const proseFlags = allFlags.filter((f) => f.type.startsWith("prose-"));
  const linkFlags = allFlags.filter((f) => f.type === "dead-link" || f.type === "out-of-budget-url");

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

        <main className={`flex-1 p-4 md:p-8 transition-all duration-300 ${isSidebarCollapsed ? "md:ml-16" : "md:ml-64"}`}>
          <button
            onClick={() => router.push("/dashboard/long-form")}
            className="flex items-center gap-2 text-foreground-muted hover:text-foreground mb-6 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Long-Form
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : !data ? (
            <div className="text-center py-24 text-foreground-muted">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-bold">Article not found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left: article content */}
              <div className="xl:col-span-2 space-y-4">
                {/* Header */}
                <div className="bg-surface border-4 border-border rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h1 className="text-2xl font-black text-foreground">{data.post.title}</h1>
                      {data.post.metadata?.subtitle && (
                        <p className="text-foreground-muted mt-1">{data.post.metadata.subtitle}</p>
                      )}
                    </div>
                    <button
                      onClick={handleCopyAll}
                      className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-strong text-accent-foreground rounded-lg text-sm font-bold transition-colors flex-shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      Copy All
                    </button>
                  </div>

                  {/* Audit summary bar */}
                  {audit && (
                    <div className="flex flex-wrap gap-2 text-xs mt-2">
                      {errorFlags.length > 0 && (
                        <span className="px-2 py-1 rounded-md bg-red-100 text-red-800 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errorFlags.length} error{errorFlags.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {warnFlags.length > 0 && (
                        <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {warnFlags.length} warning{warnFlags.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {errorFlags.length === 0 && warnFlags.length === 0 && (
                        <span className="px-2 py-1 rounded-md bg-green-100 text-green-800 font-bold">
                          No flags
                        </span>
                      )}
                      <span className="px-2 py-1 rounded-md bg-surface-2 text-foreground font-medium">
                        Dead link rate: {(audit.dead_link_rate * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Article sections */}
                {data.post.sections
                  .filter((s: any) => !s.__meta)
                  .map((section: any, i: number) => (
                    <div key={i} className="bg-surface border border-border rounded-xl p-6">
                      <h2 className="text-lg font-bold text-foreground mb-4">{section.heading}</h2>
                      <ReviewMarkdown content={section.content} />
                    </div>
                  ))}
              </div>

              {/* Right: audit panels */}
              <div className="space-y-4">
                {/* Source Budget Panel */}
                {sourceBudget.length > 0 && (
                  <Panel
                    title="Source Budget"
                    icon={<Link2 className="w-4 h-4 text-accent" />}
                    count={sourceBudget.length}
                    countColor="bg-blue-100 text-blue-800"
                  >
                    <div className="space-y-3 mt-2">
                      {sourceBudget.map((entry, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border text-xs ${
                            entry.status === "dead"
                              ? "border-red-200 bg-red-50 line-through opacity-60"
                              : "border-border bg-bg"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:underline break-all font-medium flex items-start gap-1"
                            >
                              <span className="break-all">{entry.url}</span>
                              <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            </a>
                            {statusBadge(entry.status)}
                          </div>
                          <p className="text-foreground-muted leading-relaxed">{entry.justification}</p>
                          {entry.claim_support && (
                            <p className={`mt-1 font-bold ${
                              entry.claim_support === "YES" ? "text-green-700" :
                              entry.claim_support === "NO" ? "text-red-700" : "text-amber-700"
                            }`}>
                              Claim support: {entry.claim_support}
                              {entry.claim_support_reason && ` — ${entry.claim_support_reason}`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {/* Link & Citation Flags */}
                {linkFlags.length > 0 && (
                  <Panel
                    title="Link Issues"
                    icon={<Globe className="w-4 h-4 text-red-500" />}
                    count={linkFlags.length}
                    countColor="bg-red-100 text-red-800"
                  >
                    <div className="space-y-2 mt-2">
                      {linkFlags.map((flag, i) => (
                        <div key={i} className={`p-3 rounded-lg border text-xs flex gap-2 ${severityClass(flag.severity)}`}>
                          {severityIcon(flag.severity)}
                          <div className="min-w-0">
                            <p className="font-medium leading-relaxed">{flag.message}</p>
                            {flag.url && (
                              <a href={flag.url} target="_blank" rel="noopener noreferrer" className="underline break-all mt-0.5 block opacity-75">
                                {flag.url}
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {/* Authority Panel */}
                {namedPersonFlags.length > 0 && (
                  <Panel
                    title="Authority Check"
                    icon={<User className="w-4 h-4 text-red-500" />}
                    count={namedPersonFlags.length}
                    countColor="bg-red-100 text-red-800"
                  >
                    <div className="space-y-2 mt-2">
                      {namedPersonFlags.map((flag, i) => (
                        <div key={i} className={`p-3 rounded-lg border text-xs flex gap-2 ${severityClass(flag.severity)}`}>
                          {severityIcon(flag.severity)}
                          <div className="min-w-0">
                            <p className="font-medium leading-relaxed">{flag.message}</p>
                            {flag.span_text && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <a
                                  href={`https://en.wikipedia.org/wiki/${encodeURIComponent(flag.span_text)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline opacity-75 flex items-center gap-1"
                                >
                                  Wikipedia <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                                <a
                                  href={`https://www.google.com/search?q=${encodeURIComponent(flag.span_text)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline opacity-75 flex items-center gap-1"
                                >
                                  Google <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {/* Code Block Panel */}
                {codeFlags.length > 0 && (
                  <Panel
                    title="Code Issues"
                    icon={<Code2 className="w-4 h-4 text-amber-600" />}
                    count={codeFlags.length}
                    countColor="bg-amber-100 text-amber-800"
                  >
                    <div className="space-y-2 mt-2">
                      {codeFlags.map((flag, i) => (
                        <div key={i} className={`p-3 rounded-lg border text-xs flex gap-2 ${severityClass(flag.severity)}`}>
                          {severityIcon(flag.severity)}
                          <div className="min-w-0">
                            <p className="font-medium leading-relaxed">{flag.message}</p>
                            {flag.details && (
                              <p className="mt-1 opacity-75 break-all">{flag.details}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {/* Prose Pattern Report */}
                {audit?.prose_audit_score && (
                  <Panel
                    title="Prose Patterns"
                    icon={<FileText className="w-4 h-4 text-amber-600" />}
                    count={proseFlags.length}
                    countColor={proseFlags.length > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}
                  >
                    <div className="mt-2 space-y-2 text-xs text-foreground-muted">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-surface-2">
                          <p className="font-bold text-foreground">List-of-threes</p>
                          <p className={audit.prose_audit_score.list_of_three_count > 4 ? "text-amber-700 font-bold" : ""}>
                            {audit.prose_audit_score.list_of_three_count}
                          </p>
                        </div>
                        <div className="p-2 rounded bg-surface-2">
                          <p className="font-bold text-foreground">"Not X, but Y"</p>
                          <p className={audit.prose_audit_score.not_x_but_y_count > 1 ? "text-amber-700 font-bold" : ""}>
                            {audit.prose_audit_score.not_x_but_y_count}
                          </p>
                        </div>
                        <div className="p-2 rounded bg-surface-2">
                          <p className="font-bold text-foreground">Para length CV</p>
                          <p className={audit.prose_audit_score.paragraph_length_cv < 0.3 ? "text-amber-700 font-bold" : ""}>
                            {audit.prose_audit_score.paragraph_length_cv.toFixed(2)}
                          </p>
                        </div>
                        <div className="p-2 rounded bg-surface-2">
                          <p className="font-bold text-foreground">Section closers</p>
                          <p className={audit.prose_audit_score.section_closer_count > 0 ? "text-amber-700 font-bold" : ""}>
                            {audit.prose_audit_score.section_closer_count}
                          </p>
                        </div>
                      </div>
                      {proseFlags.map((flag, i) => (
                        <div key={i} className={`p-3 rounded-lg border flex gap-2 ${severityClass(flag.severity)}`}>
                          {severityIcon(flag.severity)}
                          <p className="font-medium leading-relaxed">{flag.message}</p>
                        </div>
                      ))}
                      {proseFlags.length === 0 && (
                        <p className="text-green-700 font-medium">No prose pattern issues detected.</p>
                      )}
                    </div>
                  </Panel>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

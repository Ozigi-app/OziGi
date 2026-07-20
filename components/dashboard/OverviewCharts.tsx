"use client";

// Lightweight, dependency-free dashboard charts built from the overview
// aggregates. Single-series magnitude data → one sequential hue (brand accent
// via CSS tokens, so it themes light/dark automatically). Text stays in ink
// tokens; every mark is directly labelled so identity is never colour-alone.

type OverviewStats = {
  content: {
    socialCampaigns: number; newslettersGenerated: number; blogPostsWritten: number;
    postsScheduled: number; personasSaved: number; newsletterSubscribers: number;
  };
  outbound: {
    emailsSent: number; emailReplies?: number; replyRate: string; liConnections: number;
    liMessages: number; totalLeads: number; emailsScraped: number;
  };
};

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-foreground-subtle mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Horizontal magnitude bars, widths scaled to the largest value. */
function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} title={`${r.label}: ${r.value.toLocaleString()}`}>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs text-foreground-muted">{r.label}</span>
            <span className="text-xs font-bold text-foreground tabular-nums">{r.value.toLocaleString()}</span>
          </div>
          <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(r.value > 0 ? 6 : 0, (r.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Descending funnel bars with stage-to-stage conversion. */
function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  const top = Math.max(1, stages[0]?.value ?? 1);
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const prev = i === 0 ? null : stages[i - 1].value;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={s.label} title={conv != null ? `${conv}% of ${stages[i - 1].label}` : "Top of funnel"}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-foreground-muted">{s.label}</span>
              <span className="text-xs font-bold text-foreground tabular-nums">
                {s.value.toLocaleString()}
                {conv != null && <span className="text-foreground-subtle font-medium ml-1.5">{conv}%</span>}
              </span>
            </div>
            <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(s.value > 0 ? 6 : 0, (s.value / top) * 100)}%`, opacity: 1 - i * 0.15 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Reply-rate ring gauge — a single headline number. */
function Ring({ percent }: { percent: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * c;
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="-mt-[74px] mb-[36px] text-center">
        <div className="text-2xl font-black text-foreground tabular-nums">{clamped.toFixed(1)}%</div>
        <div className="text-[10px] text-foreground-subtle uppercase tracking-widest font-semibold">Reply rate</div>
      </div>
    </div>
  );
}

export default function OverviewCharts({ stats }: { stats: OverviewStats }) {
  const c = stats.content;
  const o = stats.outbound;

  const contentRows = [
    { label: "Social campaigns", value: c.socialCampaigns },
    { label: "Newsletters", value: c.newslettersGenerated },
    { label: "Blog posts", value: c.blogPostsWritten },
    { label: "Scheduled posts", value: c.postsScheduled },
  ];
  const hasContent = contentRows.some((r) => r.value > 0);

  const replies = o.emailReplies ?? Math.round((o.emailsSent * (parseFloat(o.replyRate) || 0)) / 100);
  const funnelStages = [
    { label: "Leads sourced", value: o.totalLeads },
    { label: "Emails found", value: o.emailsScraped },
    { label: "Emails sent", value: o.emailsSent },
    { label: "Replies", value: replies },
  ];
  const hasOutbound = funnelStages.some((s) => s.value > 0);
  const replyPct = parseFloat(o.replyRate) || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Content output" subtitle="What you've created on Ozigi">
        {hasContent ? (
          <BarList rows={contentRows} />
        ) : (
          <p className="text-xs text-foreground-subtle py-6 text-center">
            No content generated yet — create your first campaign to see it here.
          </p>
        )}
      </Card>

      <Card title="Outbound funnel" subtitle="From sourced lead to reply">
        {hasOutbound ? (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
            <Funnel stages={funnelStages} />
            <div className="hidden sm:block w-px self-stretch bg-border" />
            <div className="sm:w-[120px]">
              <Ring percent={replyPct} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-foreground-subtle py-6 text-center">
            No outbound activity yet — start an outreach campaign to fill your pipeline.
          </p>
        )}
      </Card>
    </div>
  );
}

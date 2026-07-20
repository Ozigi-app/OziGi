"use client";
import { useEffect, useState, useCallback } from "react";

interface Campaign {
  id: string;
  subject: string;
  template: string | null;
  scheduled_for: string;
  status: "pending" | "processing" | "sent" | "cancelled";
  sent_at: string | null;
  sent_count: number | null;
  failed_count: number | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  cancelled: "bg-surface-2 text-foreground-subtle",
};

export default function PromoQueueAdminPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [audience, setAudience] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"seed" | "send" | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/promo-queue")
      .then(async (r) => {
        if (r.status === 403) throw new Error("This page is admin-only.");
        if (r.status === 401) throw new Error("Please sign in.");
        if (!r.ok) throw new Error("Failed to load queue.");
        return r.json();
      })
      .then((d) => {
        setCampaigns(d.campaigns ?? []);
        setAudience(d.audience ?? null);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function seed() {
    setBusy("seed");
    setNotice("");
    try {
      const res = await fetch("/api/admin/promo-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Seed failed");
      setNotice(
        d.mode === "seed"
          ? `Staged ${d.inserted?.length ?? 0} campaigns — first one is scheduled for today.`
          : `Queue topped up (${d.added ?? 0} added).`
      );
      load();
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function sendNow() {
    if (!confirm(
      `Send the next due campaign to all ${audience?.toLocaleString() ?? ""} subscribed users right now? This cannot be undone.`
    )) return;
    setBusy("send");
    setNotice("");
    try {
      const res = await fetch("/api/admin/promo-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-now" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Send failed");
      const r = d.result ?? {};
      setNotice(
        r.results
          ? `Sent: ${r.results.sent}, failed: ${r.results.failed}, skipped: ${r.results.skipped}.`
          : r.message ?? "No campaign was due to send."
      );
      load();
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this campaign? It will never send.")) return;
    const res = await fetch("/api/admin/promo-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) load();
    else alert("Failed to cancel.");
  }

  const now = Date.now();
  const pending = campaigns.filter((c) => c.status === "pending");
  const nextUp = pending
    .filter((c) => new Date(c.scheduled_for).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())[0];

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      weekday: "short", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short",
    });

  return (
    <div className="min-h-screen bg-bg text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Promotional Queue</h1>
            <p className="text-foreground-subtle text-sm mt-0.5">
              Scheduled and sent promo emails.
              {audience != null && <> Current audience: <strong className="text-foreground">{audience.toLocaleString()}</strong> subscribed users.</>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={seed} disabled={busy !== null} className="px-3 py-1.5 border border-border rounded-lg bg-surface text-sm text-foreground-muted hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-50">
              {busy === "seed" ? "Seeding…" : "Seed / top up"}
            </button>
            <button onClick={sendNow} disabled={busy !== null} className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-bold transition-colors disabled:opacity-50">
              {busy === "send" ? "Sending…" : "Send next now"}
            </button>
            <button onClick={load} disabled={busy !== null} className="px-3 py-1.5 border border-border rounded-lg bg-surface text-sm text-foreground-muted hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-50">
              Refresh
            </button>
          </div>
        </div>

        {notice && (
          <div className="bg-surface-2 border border-border rounded-lg px-4 py-3 mb-4 text-sm text-foreground">{notice}</div>
        )}

        {nextUp && (
          <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 mb-6 text-sm">
            <span className="text-foreground-subtle">Next send:</span>{" "}
            <strong className="text-foreground">{nextUp.subject}</strong>{" "}
            <span className="text-foreground-subtle">— {fmt(nextUp.scheduled_for)}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
        )}

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="px-5 py-12 text-center text-foreground-subtle text-sm">Loading…</div>
          ) : campaigns.length === 0 ? (
            <div className="px-5 py-16 text-center text-foreground-subtle text-sm">
              No campaigns queued yet. Seed the broadcast to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Subject", "Scheduled", "Status", "Sent / Failed", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-foreground-subtle text-xs font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{c.subject}</div>
                        {c.template && <div className="text-[11px] text-foreground-subtle mt-0.5">{c.template}</div>}
                      </td>
                      <td className="px-4 py-3 text-foreground-muted text-xs whitespace-nowrap">{fmt(c.scheduled_for)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[c.status] ?? "bg-surface-2 text-foreground-muted"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground-muted text-xs tabular-nums">
                        {c.status === "sent" ? `${c.sent_count ?? 0} sent${c.failed_count ? ` · ${c.failed_count} failed` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.status === "pending" && (
                          <button onClick={() => cancel(c.id)} className="px-2.5 py-1 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold bg-surface transition-colors">
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

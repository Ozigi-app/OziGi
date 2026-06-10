"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────
   GTM DASHBOARD DEMO
   Three chapters auto-play in a loop:
     1. Overview   — stat cards (Content Studio + Outbound Growth)
     2. Outbound   — campaign detail: leads table + email sends
     3. Content    — Distillery: social posts being generated
───────────────────────────────────────────────────────────────────── */

const C = {
  bg:           "#F8FAFC",
  sidebar:      "#FFFFFF",
  panel:        "#FFFFFF",
  inner:        "#F1F5F9",
  border:       "#E2E8F0",
  borderStrong: "#CBD5E1",
  text:         "#0A1628",
  muted:        "#334155",
  dim:          "#64748B",
  red:          "#E8320A",
  redDeep:      "#C4290A",
  cardWhite:    "#F1F5F9",
  ink:          "#0A1628",
};

/* ── Timeline ──────────────────────────────────────────────────────── */
const TOTAL_MS = 16_000;
type Phase = "overview" | "outbound-in" | "outbound" | "content";

const PHASE_TIMELINE: { phase: Phase; startMs: number; endMs: number }[] = [
  { phase: "overview",    startMs: 0,      endMs: 5_500  },
  { phase: "outbound-in", startMs: 5_500,  endMs: 6_200  },
  { phase: "outbound",    startMs: 6_200,  endMs: 11_500 },
  { phase: "content",     startMs: 11_500, endMs: 16_000 },
];

const CHAPTERS = [
  { label: "1 · Overview",  startMs: 0      },
  { label: "2 · Outbound",  startMs: 6_200  },
  { label: "3 · Content",   startMs: 11_500 },
];

const CALLOUTS: { text: string; showMs: number; hideMs: number; x: string; y: string }[] = [
  { text: "Live stats — all campaigns",    showMs: 600,    hideMs: 2_400,  x: "52%", y: "14%" },
  { text: "Reply rate tracked per campaign", showMs: 3_000, hideMs: 4_800, x: "52%", y: "58%" },
  { text: "Gemini-scored leads",           showMs: 7_000,  hideMs: 9_000,  x: "54%", y: "28%" },
  { text: "Personalised per lead profile", showMs: 12_200, hideMs: 14_200, x: "54%", y: "52%" },
];

const CURSOR_PATH: { x: number; y: number; ms: number }[] = [
  { x: 52, y: 22, ms: 0       },
  { x: 52, y: 22, ms: 1_800   },
  { x: 52, y: 62, ms: 3_200   },
  { x: 52, y: 62, ms: 5_500   },
  { x: 18, y: 60, ms: 6_500   }, // sidebar — Email Outreach
  { x: 50, y: 32, ms: 7_500   }, // leads table row
  { x: 50, y: 46, ms: 9_000   },
  { x: 66, y: 74, ms: 10_200  }, // Run Send button
  { x: 18, y: 38, ms: 11_700  }, // sidebar — Social Posts
  { x: 54, y: 38, ms: 12_600  },
  { x: 54, y: 66, ms: 14_000  }, // generate button
  { x: 54, y: 66, ms: 16_000  },
];

function lerpCursor(elapsed: number): { x: number; y: number } {
  const path = CURSOR_PATH;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    if (elapsed >= a.ms && elapsed <= b.ms) {
      const t = (elapsed - a.ms) / (b.ms - a.ms);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y };
}

/* ── Main component ────────────────────────────────────────────────── */
export default function DashboardPreview() {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setElapsed((e) => (e >= TOTAL_MS ? 0 : e + 16));
    }, 16);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  const phase = useMemo<Phase>(() => {
    for (let i = PHASE_TIMELINE.length - 1; i >= 0; i--) {
      if (elapsed >= PHASE_TIMELINE[i].startMs) return PHASE_TIMELINE[i].phase;
    }
    return "overview";
  }, [elapsed]);

  const visiblePhase = useMemo<"overview" | "outbound" | "content">(() => {
    if (phase === "overview" || phase === "outbound-in") return "overview";
    if (phase === "outbound") return "outbound";
    return "content";
  }, [phase]);

  const cursorPos = useMemo(() => lerpCursor(elapsed), [elapsed]);
  const activeCallout = useMemo(
    () => CALLOUTS.find((c) => elapsed >= c.showMs && elapsed < c.hideMs) ?? null,
    [elapsed]
  );

  // Stat counter animation — counts up during overview phase
  const overviewProgress = useMemo(() => {
    if (elapsed > 4_500) return 1;
    return Math.min(elapsed / 2_500, 1);
  }, [elapsed]);

  // Outbound leads stagger
  const outboundElapsed = phase === "outbound" ? elapsed - 6_200 : 0;

  // Content typewriter
  const CONTENT_INPUT = "https://ozigi.app/changelog/v3-gtm-launch";
  const typedContent = useMemo(() => {
    if (visiblePhase !== "content") return "";
    const start = 11_800, end = 13_600;
    if (elapsed < start) return "";
    const t = Math.min((elapsed - start) / (end - start), 1);
    return CONTENT_INPUT.slice(0, Math.floor(t * CONTENT_INPUT.length));
  }, [elapsed, visiblePhase]);

  const buttonPulsing = visiblePhase === "content" && elapsed >= 13_800;

  const handleSeek = (ms: number) => setElapsed(Math.max(0, Math.min(TOTAL_MS, ms)));

  return (
    <div className="relative w-full select-none">
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          boxShadow: "0 30px 80px -20px rgba(10,22,40,0.18), 0 0 0 1px rgba(10,22,40,0.04)",
        }}
      >
        {/* Mac chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b" style={{ borderColor: C.border, background: C.sidebar }}>
          <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#ffbd2e" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
          <div className="ml-3 flex-1 max-w-md mx-auto rounded-md px-3 py-1 text-[10px] md:text-[11px] font-medium text-center"
            style={{ background: C.inner, color: C.muted, border: `1px solid ${C.border}` }}>
            ozigi.app/dashboard
          </div>
          <div className="hidden md:block w-[60px]" />
        </div>

        {/* Phase content */}
        <div className="relative overflow-hidden" style={{ height: 480 }}>
          <AnimatePresence mode="wait" initial={false}>
            {visiblePhase === "overview" && (
              <motion.div key="overview"
                initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                <OverviewPhase progress={overviewProgress} />
              </motion.div>
            )}
            {visiblePhase === "outbound" && (
              <motion.div key="outbound"
                initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
                <OutboundPhase outboundElapsed={outboundElapsed} />
              </motion.div>
            )}
            {visiblePhase === "content" && (
              <motion.div key="content"
                initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                <ContentPhase typedInput={typedContent} buttonPulsing={buttonPulsing} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scene transition overlays */}
          <AnimatePresence>
            {(elapsed >= 5_300 && elapsed < 6_400) && (
              <SceneTitleCard key="scene2" title="Outbound Campaign" subtitle="Leads sourced · sequences running" />
            )}
            {(elapsed >= 11_200 && elapsed < 12_000) && (
              <SceneTitleCard key="scene3" title="Content Engine" subtitle="Social posts · newsletter · blog" />
            )}
          </AnimatePresence>

          {/* Callout */}
          <AnimatePresence>
            {activeCallout && (
              <motion.div key={activeCallout.text}
                initial={{ opacity: 0, scale: 0.88, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: 6 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="absolute z-30 pointer-events-none"
                style={{ left: activeCallout.x, top: activeCallout.y }}>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg"
                  style={{ background: C.ink, color: "#fff", boxShadow: "0 4px 20px rgba(10,22,40,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: C.red }} />
                  {activeCallout.text}
                </div>
                <div className="absolute -bottom-1.5 left-5 w-3 h-3 rotate-45" style={{ background: C.ink }} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cursor */}
          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
            <motion.div className="absolute"
              animate={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ transform: "translate(-50%, -50%)" }}>
              <CursorDot clicking={buttonPulsing && elapsed >= 14_200 && elapsed < 14_600} />
            </motion.div>
          </div>
        </div>

        <VideoControls elapsed={elapsed} total={TOTAL_MS} playing={playing}
          chapters={CHAPTERS} onPlayPause={() => setPlaying((p) => !p)} onSeek={handleSeek} />
      </div>
    </div>
  );
}

/* ── Phase 1: Overview ─────────────────────────────────────────────── */
function OverviewPhase({ progress }: { progress: number }) {
  const count = (n: number) => Math.floor(n * progress);

  const contentStats = [
    { label: "Social Campaigns", value: count(38), color: C.ink },
    { label: "Newsletters",      value: count(12), color: C.ink },
    { label: "Blog Posts",       value: count(7),  color: C.ink },
    { label: "Posts Scheduled",  value: count(5),  color: C.ink },
    { label: "Subscribers",      value: count(284),color: C.ink },
    { label: "Personas Saved",   value: count(4),  color: C.ink },
  ];
  const outboundStats = [
    { label: "Emails Sent",       value: count(1_240), color: C.ink },
    { label: "Emails Scraped",    value: count(3_870), color: C.ink },
    { label: "LI Connections",    value: count(189),   color: C.ink },
    { label: "LI Messages",       value: count(94),    color: C.ink },
    { label: "Total Leads",       value: count(512),   color: C.ink },
    { label: "Reply Rate",        value: `${(8.4 * progress).toFixed(1)}%`, color: "#16a34a" },
  ];

  return (
    <div className="flex" style={{ background: C.bg, height: 480, overflow: "hidden" }}>
      <DemoSidebar active="Overview" />
      <div className="flex-1 p-3 sm:p-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm sm:text-base font-black italic uppercase tracking-tight" style={{ color: C.text }}>Overview</h3>
            <p className="text-[9px] sm:text-[10px]" style={{ color: C.dim }}>Leads, outreach & content at a glance</p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
            style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.25)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#16a34a" }} />
            Live
          </div>
        </div>

        {/* Content Studio */}
        <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1.5" style={{ color: C.dim }}>Content Studio</p>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
          {contentStats.map((s) => (
            <div key={s.label} className="rounded-lg p-2" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <div className="text-base sm:text-lg font-black tabular-nums leading-none" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[8px] sm:text-[9px] font-medium mt-0.5 leading-snug" style={{ color: C.dim }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Outbound Growth */}
        <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1.5" style={{ color: C.dim }}>Outbound Growth</p>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {outboundStats.map((s) => (
            <div key={s.label} className="rounded-lg p-2" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <div className="text-base sm:text-lg font-black tabular-nums leading-none" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[8px] sm:text-[9px] font-medium mt-0.5 leading-snug" style={{ color: C.dim }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Phase 2: Outbound Campaign ────────────────────────────────────── */
const LEADS = [
  { name: "Tunde Okonkwo",    company: "Paystack",     score: "94%", status: "contacted", email: "t.okonkwo@paystack.com" },
  { name: "Amara Nwosu",      company: "Flutterwave",  score: "88%", status: "replied",   email: "amara@flutterwave.com" },
  { name: "Ike Chukwu",       company: "Risevest",     score: "81%", status: "new",       email: "ike@risevest.com" },
  { name: "Chidi Okeke",      company: "Kuda Bank",    score: "76%", status: "new",       email: "chidi@kuda.com" },
  { name: "Ngozi Adeyemi",    company: "PiggyVest",    score: "72%", status: "new",       email: "ngozi@piggyvest.com" },
];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  new:       { bg: "#F1F5F9", color: "#64748B" },
  contacted: { bg: "#EFF6FF", color: "#2563EB" },
  replied:   { bg: "#F0FDF4", color: "#16A34A" },
};

function OutboundPhase({ outboundElapsed }: { outboundElapsed: number }) {
  const emailSends = [
    { step: "Step 1 · Cold intro",  sent: Math.min(Math.floor((outboundElapsed / 1_200) * 3), 3), total: 5 },
    { step: "Step 2 · Follow-up",   sent: Math.min(Math.floor((outboundElapsed / 2_200) * 2), 2), total: 5 },
    { step: "Step 3 · Breakup",     sent: 0, total: 5 },
  ];

  return (
    <div className="flex" style={{ background: C.bg, height: 480, overflow: "hidden" }}>
      <DemoSidebar active="Email Outreach" />
      <div className="flex-1 p-3 sm:p-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black italic uppercase tracking-tight truncate" style={{ color: C.text }}>
              Ozigi Outreach — Dev Founders
            </h3>
            <p className="text-[9px] sm:text-[10px]" style={{ color: C.dim }}>GitHub + Dev.to · 5 leads · email + LinkedIn</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button className="text-[9px] font-black uppercase tracking-widest px-2 py-1.5 rounded-md"
              style={{ background: C.inner, color: C.muted, border: `1px solid ${C.border}` }}>Scrape</button>
            <button className="text-[9px] font-black uppercase tracking-widest px-2 py-1.5 rounded-md text-white"
              style={{ background: C.red }}>Send</button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-2.5">
          {[
            { label: "Leads",   value: "5" },
            { label: "Sent",    value: String(Math.min(Math.floor(outboundElapsed / 600), 5)) },
            { label: "Replies", value: "1" },
            { label: "Rate",    value: outboundElapsed > 1200 ? "20%" : "0%" },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-1.5 sm:p-2 text-center" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <div className="text-sm sm:text-base font-black tabular-nums" style={{ color: C.ink }}>{s.value}</div>
              <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest mt-0.5" style={{ color: C.dim }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-2.5 border-b pb-1.5" style={{ borderColor: C.border }}>
          {["Leads (5)", "Email Sends", "LinkedIn"].map((t, i) => (
            <span key={t} className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
              style={{ background: i === 0 ? "rgba(232,50,10,0.10)" : "transparent", color: i === 0 ? C.red : C.muted,
                border: `1px solid ${i === 0 ? "rgba(232,50,10,0.3)" : "transparent"}` }}>
              {t}
            </span>
          ))}
        </div>

        {/* Leads table */}
        <table className="w-full text-[9px] sm:text-[10px]">
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th className="text-left pb-1.5 font-black uppercase tracking-widest" style={{ color: C.dim }}>Name</th>
              <th className="text-left pb-1.5 font-black uppercase tracking-widest" style={{ color: C.dim }}>Company</th>
              <th className="text-left pb-1.5 font-black uppercase tracking-widest" style={{ color: C.dim }}>Score</th>
              <th className="text-left pb-1.5 font-black uppercase tracking-widest" style={{ color: C.dim }}>Status</th>
              <th className="hidden sm:table-cell text-left pb-1.5 font-black uppercase tracking-widest" style={{ color: C.dim }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {LEADS.map((l, i) => {
              const visible = outboundElapsed > i * 320;
              return (
                <motion.tr key={l.name}
                  initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td className="py-1.5 font-semibold truncate max-w-[80px] sm:max-w-none" style={{ color: C.ink }}>{l.name}</td>
                  <td className="py-1.5" style={{ color: C.muted }}>{l.company}</td>
                  <td className="py-1.5 font-black" style={{ color: "#16a34a" }}>{l.score}</td>
                  <td className="py-1.5">
                    <span className="px-1.5 py-0.5 rounded font-black uppercase tracking-widest text-[8px]"
                      style={{ background: STATUS_COLORS[l.status].bg, color: STATUS_COLORS[l.status].color }}>
                      {l.status}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell py-1.5" style={{ color: C.dim }}>{l.email}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>

        {/* Email send progress */}
        <div className="mt-2.5 flex flex-col gap-1.5">
          {emailSends.map((s) => (
            <div key={s.step} className="flex items-center gap-2">
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest w-20 sm:w-28 shrink-0 truncate" style={{ color: C.muted }}>{s.step}</span>
              <div className="flex-1 rounded-full h-1.5" style={{ background: C.inner }}>
                <motion.div className="h-full rounded-full" style={{ background: C.red }}
                  animate={{ width: `${(s.sent / s.total) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }} />
              </div>
              <span className="text-[8px] sm:text-[9px] font-black w-7 text-right tabular-nums" style={{ color: C.dim }}>
                {s.sent}/{s.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Phase 3: Content Engine ───────────────────────────────────────── */
const SAMPLE_URL = "https://ozigi.app/changelog/v3-gtm-launch";

function ContentPhase({ typedInput, buttonPulsing }: { typedInput: string; buttonPulsing: boolean }) {
  return (
    <div className="flex" style={{ background: C.bg, height: 480, overflow: "hidden" }}>
      <DemoSidebar active="Social Posts" />
      <div className="flex-1 p-3 sm:p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "rgba(232,50,10,0.12)" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={C.red} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6 6l.88-.88a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </span>
          <div>
            <h3 className="text-base font-black italic uppercase tracking-tight" style={{ color: C.text }}>Social Posts</h3>
            <p className="text-[10px]" style={{ color: C.dim }}>Generate for LinkedIn, X, Discord, Email</p>
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-2" style={{ color: C.muted }}>
            Paste url, notes, or raw context
          </p>

          <div className="rounded-lg p-3 text-sm leading-relaxed min-h-[56px]"
            style={{ background: C.inner, border: `1px solid ${C.border}`, color: C.text, fontFamily: "monospace" }}>
            {typedInput || (
              <span style={{ color: C.dim }}>Paste a URL, product update, or any text context…</span>
            )}
            {typedInput && typedInput.length < SAMPLE_URL.length && (
              <span className="inline-block w-[7px] h-[14px] -mb-[2px] ml-[2px] animate-pulse" style={{ background: C.red }} />
            )}
          </div>

          {/* Platform chips */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Platforms</span>
            {[
              { label: "X",  on: true },
              { label: "LI", on: true },
              { label: "DC", on: true },
              { label: "EM", on: true },
            ].map((p) => (
              <span key={p.label}
                className="w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center"
                style={{ background: p.on ? C.ink : "transparent", color: p.on ? "#FFFFFF" : C.muted, border: `1px solid ${p.on ? C.ink : C.border}` }}>
                {p.label}
              </span>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Persona</span>
              <span className="px-2 py-1 rounded-md text-[10px] font-semibold" style={{ background: C.inner, color: C.text, border: `1px solid ${C.border}` }}>
                Founder ▾
              </span>
            </div>
          </div>

          <motion.button
            animate={buttonPulsing ? { boxShadow: ["0 8px 24px rgba(232,50,10,0.35)", "0 12px 36px rgba(232,50,10,0.6)", "0 8px 24px rgba(232,50,10,0.35)"] } : {}}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
            className="mt-4 w-full py-3 text-white text-xs font-black uppercase tracking-widest rounded-lg"
            style={{ background: `linear-gradient(135deg, ${C.red} 0%, ${C.redDeep} 100%)` }}>
            Generate social posts ⚡
          </motion.button>
        </div>

        {/* Mini history preview */}
        <div className="mt-3">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-2" style={{ color: C.dim }}>Recent — Social Posts</p>
          <div className="flex flex-col gap-1.5">
            {[
              { name: "Product launch announcement", date: "Today" },
              { name: "Lead scraping deep-dive thread", date: "Yesterday" },
              { name: "Newsletter: Outbound OS #12", date: "3 days ago" },
            ].map((h) => (
              <div key={h.name} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <span className="text-[10px] font-semibold truncate" style={{ color: C.muted }}>{h.name}</span>
                <span className="text-[9px] font-black uppercase tracking-widest ml-3 shrink-0" style={{ color: C.dim }}>{h.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar ───────────────────────────────────────────────────────── */
const NAV_SECTIONS = [
  { section: "Workspace",       items: [{ label: "Overview" }] },
  { section: "Content Engine",  items: [{ label: "Social Posts" }, { label: "Newsletter" }, { label: "Blog Post" }] },
  { section: "Audience",        items: [{ label: "Subscribers" }, { label: "Personas" }] },
  { section: "Outbound Growth", items: [{ label: "Email Outreach" }, { label: "LinkedIn Outreach" }, { label: "Outreach Settings" }] },
  { section: "Settings",        items: [{ label: "Settings & Integrations" }] },
];

function DemoSidebar({ active }: { active: string }) {
  return (
    <aside className="hidden md:flex flex-col w-[180px] lg:w-[190px] shrink-0 py-3 px-2"
      style={{ background: C.sidebar, borderRight: `1px solid ${C.border}` }}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-2 mb-3 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md" style={{ background: "rgba(232,50,10,0.14)" }}>
          <span className="text-[11px] font-black italic" style={{ color: C.red }}>O</span>
        </span>
        <span className="text-sm font-black italic uppercase tracking-tight" style={{ color: C.text }}>Ozigi</span>
      </div>

      <nav className="flex flex-col gap-0 flex-1 overflow-hidden">
        {NAV_SECTIONS.map((section) => (
          <div key={section.section}>
            <div className="flex items-center gap-1 px-2 pt-2 pb-0.5">
              <div className="h-px flex-1" style={{ background: C.border }} />
              <span className="text-[7px] font-black uppercase tracking-widest px-1" style={{ color: C.dim }}>{section.section}</span>
              <div className="h-px flex-1" style={{ background: C.border }} />
            </div>
            {section.items.map((item) => {
              const isActive = item.label === active;
              return (
                <div key={item.label}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-semibold mx-0.5"
                  style={{
                    background: isActive ? "rgba(232,50,10,0.10)" : "transparent",
                    color: isActive ? C.red : C.muted,
                    border: `1px solid ${isActive ? "rgba(232,50,10,0.3)" : "transparent"}`,
                  }}>
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom stats */}
      <div className="pt-2 mt-2" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="grid grid-cols-2 gap-1">
          <div className="rounded-md p-1.5 text-center" style={{ background: C.cardWhite }}>
            <p className="text-sm font-black leading-none" style={{ color: C.ink }}>38</p>
            <p className="text-[7px] font-black uppercase tracking-widest mt-0.5" style={{ color: C.dim }}>Posts</p>
          </div>
          <div className="rounded-md p-1.5 text-center" style={{ background: C.cardWhite }}>
            <p className="text-sm font-black leading-none" style={{ color: C.ink }}>512</p>
            <p className="text-[7px] font-black uppercase tracking-widest mt-0.5" style={{ color: C.dim }}>Leads</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── Shared sub-components ─────────────────────────────────────────── */
function SceneTitleCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 flex items-center justify-center z-40"
      style={{ background: "rgba(10,22,40,0.78)", backdropFilter: "blur(6px)" }}>
      <motion.div initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 16 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="text-center px-8">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-2" style={{ color: C.red }}>Next</p>
        <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tight text-white">{title}</h3>
        <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>{subtitle}</p>
      </motion.div>
    </motion.div>
  );
}

function CursorDot({ clicking }: { clicking: boolean }) {
  return (
    <div className="relative">
      <AnimatePresence>
        {clicking && (
          <motion.div key="ring" initial={{ scale: 0.5, opacity: 0.8 }} animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute rounded-full"
            style={{ width: 16, height: 16, top: -8, left: -8, border: `1.5px solid ${C.red}` }} />
        )}
      </AnimatePresence>
      <svg viewBox="0 0 24 24" width={clicking ? 18 : 16} height={clicking ? 18 : 16}
        style={{ filter: "drop-shadow(0 1px 4px rgba(10,22,40,0.4))", transition: "width 0.1s, height 0.1s" }}>
        <polygon points="4,2 4,18 8,14 12,22 14,21 10,13 16,13" fill="#0A1628" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function VideoControls({ elapsed, total, playing, chapters, onPlayPause, onSeek }:
  { elapsed: number; total: number; playing: boolean; chapters: typeof CHAPTERS; onPlayPause: () => void; onSeek: (ms: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const progress = elapsed / total;
  const chapterIdx = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < chapters.length; i++) { if (elapsed >= chapters[i].startMs) idx = i; }
    return idx;
  }, [elapsed, chapters]);

  return (
    <div className="px-4 pt-3 pb-4" style={{ background: C.ink, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center mb-2 relative" style={{ paddingLeft: 28 }}>
        {chapters.map((ch, i) => {
          const pct = (ch.startMs / total) * 100;
          const isActive = i === chapterIdx;
          return (
            <button key={ch.label} onClick={() => onSeek(ch.startMs)}
              className="absolute text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-colors duration-200 whitespace-nowrap"
              style={{ left: i === 0 ? 0 : `calc(${pct}% + 28px)`, color: isActive ? "#fff" : "rgba(255,255,255,0.35)", transform: i === 0 ? "none" : "translateX(-50%)" }}>
              {ch.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onPlayPause}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
          style={{ color: "#fff" }} aria-label={playing ? "Pause" : "Play"}>
          {playing
            ? <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            : <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          }
        </button>
        <div ref={trackRef} onClick={(e) => {
          if (!trackRef.current) return;
          const rect = trackRef.current.getBoundingClientRect();
          onSeek(((e.clientX - rect.left) / rect.width) * total);
        }} className="flex-1 relative h-1.5 rounded-full cursor-pointer group" style={{ background: "rgba(255,255,255,0.12)" }}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress * 100}%`, background: C.red }} />
          {chapters.slice(1).map((ch) => (
            <div key={ch.label} className="absolute top-1/2 w-px -translate-y-1/2"
              style={{ left: `${(ch.startMs / total) * 100}%`, height: "150%", background: "rgba(255,255,255,0.4)" }} />
          ))}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress * 100}%`, background: "#fff", boxShadow: "0 0 0 2px rgba(10,22,40,0.5)" }} />
        </div>
        <button onClick={() => onSeek(0)} className="flex-shrink-0 transition-opacity hover:opacity-80"
          style={{ color: "rgba(255,255,255,0.4)" }} aria-label="Restart">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

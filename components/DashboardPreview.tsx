"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   DashboardPreview
   Faithful, scaled-down recreation of the real Ozigi content engine.
   Auto-cycles between BEFORE (input form) and AFTER (3-day campaign grid).
   Modeled directly from the actual app screens — no invented UI.
───────────────────────────────────────────────────────────────────────────── */

const C = {
  navyDeep: "#070d20",
  navy: "#0a1530",
  panel: "#0d1a36",
  panelSoft: "#11203f",
  border: "rgba(255,255,255,0.08)",
  red: "#E8320A",
  peach: "#F5B5A8",
  white: "#ffffff",
  ink: "#0a1530",
  muted: "rgba(255,255,255,0.55)",
  dim: "rgba(255,255,255,0.32)",
};

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

const NAV = [
  { label: "Generation History", icon: "clock" },
  { label: "Scheduled Posts", icon: "calendar" },
  { label: "Subscribers", icon: "mail" },
  { label: "Personas", icon: "user" },
  { label: "Persona Marketplace", icon: "store" },
  { label: "Blog Post", icon: "doc" },
  { label: "Settings & Integrations", icon: "gear" },
  { label: "Copilot Settings", icon: "sparkle" },
] as const;

function NavIcon({ name }: { name: string }) {
  const cls = "w-3.5 h-3.5";
  switch (name) {
    case "clock":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
        </svg>
      );
    case "mail":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "user":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </svg>
      );
    case "store":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M3 9l1 11h16l1-11M3 9h18" />
        </svg>
      );
    case "doc":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6M9 13h6M9 17h4" strokeLinecap="round" />
        </svg>
      );
    case "gear":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case "sparkle":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path
            d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

function Sidebar({ active }: { active: string }) {
  return (
    <aside
      className="hidden md:flex flex-col gap-0.5 py-3 px-2.5 border-r"
      style={{ background: C.navy, borderColor: C.border }}
    >
      <div className="flex items-center justify-between px-2 mb-4">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: C.red }}
          >
            <span className="text-[9px] font-black" style={{ color: C.white }}>
              O
            </span>
          </div>
          <span className="text-xs font-black tracking-tight" style={{ color: C.white }}>
            Ozigi
          </span>
        </div>
        <span className="text-[10px]" style={{ color: C.dim }}>
          ←
        </span>
      </div>

      {NAV.map((item) => {
        const isActive = item.label === active;
        return (
          <div
            key={item.label}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md"
            style={{
              background: isActive ? "rgba(232,50,10,0.12)" : "transparent",
              color: isActive ? C.red : C.muted,
            }}
          >
            <NavIcon name={item.icon} />
            <span className="text-[10px] font-semibold whitespace-nowrap">{item.label}</span>
          </div>
        );
      })}
    </aside>
  );
}

/* ── BEFORE pane: input form (mirrors screenshot 1) ──────────────────────── */

function BeforePane({ typedText }: { typedText: string }) {
  return (
    <motion.div
      key="before"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6"
      style={{ background: C.navyDeep }}
    >
      <div
        className="rounded-xl p-4 md:p-5 border"
        style={{ background: C.panel, borderColor: C.border }}
      >
        <p
          className="text-[9px] font-black uppercase tracking-[0.2em] mb-2"
          style={{ color: C.muted }}
        >
          Paste URL, notes, or raw context
        </p>

        {/* White textarea card */}
        <div
          className="rounded-lg px-3.5 py-3 min-h-[90px] md:min-h-[110px]"
          style={{ background: C.white }}
        >
          <p className="text-xs md:text-sm leading-relaxed" style={{ color: C.ink }}>
            {typedText.length === 0 ? (
              <span style={{ color: "rgba(10,21,48,0.4)" }}>
                Paste a URL, meeting notes, or any text context here…
              </span>
            ) : (
              typedText
            )}
            <span
              className="inline-block w-[2px] h-3.5 ml-0.5 align-middle animate-pulse"
              style={{ background: C.red }}
            />
          </p>
        </div>

        <p className="text-[10px] mt-3 mb-4 flex items-center gap-1.5" style={{ color: C.dim }}>
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 5L6.5 9.5a2 2 0 002.8 2.8l5-5a3.5 3.5 0 00-5-5l-5 5a5 5 0 007 7l4.5-4.5" strokeLinecap="round" />
          </svg>
          Attach a file (PDF, image, video, audio)
        </p>

        {/* Persona + Platforms row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[8px] font-black uppercase tracking-widest"
              style={{ color: C.muted }}
            >
              Persona
            </span>
            <span className="text-[10px] font-bold" style={{ color: C.white }}>
              Default ▾
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span
              className="text-[8px] font-black uppercase tracking-widest mr-1"
              style={{ color: C.muted }}
            >
              Platforms
            </span>
            {[
              { p: "X", on: true },
              { p: "LI", on: true },
              { p: "DC", on: true },
              { p: "SL", on: false },
              { p: "EM", on: true },
            ].map(({ p, on }) => (
              <span
                key={p}
                className="text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: on ? C.navyDeep : "transparent",
                  color: on ? C.white : C.muted,
                  border: on ? "none" : `1px solid ${C.border}`,
                }}
              >
                {p}
              </span>
            ))}
          </div>

          <span className="text-[9px] font-bold ml-auto" style={{ color: C.muted }}>
            X · Single tweet ⇄
          </span>
        </div>

        {/* Generate button — peach, like real UI */}
        <button
          className="w-full py-3 rounded-lg text-[11px] font-black uppercase tracking-[0.22em]"
          style={{ background: C.peach, color: "#7a2410" }}
        >
          Generate content
        </button>

        <p
          className="text-[9px] font-bold uppercase tracking-widest text-center mt-3"
          style={{ color: C.dim }}
        >
          ⊕ Advanced directives ▾
        </p>
      </div>
    </motion.div>
  );
}

/* ── AFTER pane: 3-day strategy grid (mirrors screenshot 2) ──────────────── */

type Strategy = {
  label: string;
  icon: "x" | "linkedin" | "discord";
  cta: string;
  ctaBg: string;
  ctaColor: string;
  posts: string[];
  footer?: string[];
};

const STRATEGIES: Strategy[] = [
  {
    label: "X Strategy",
    icon: "x",
    cta: "Post to X",
    ctaBg: "#0a1530",
    ctaColor: "#ffffff",
    posts: [
      "I hard-coded a blocklist into Ozigi to kill words like 'delve' and 'robust' before they hit your screen. Technical credibility dies when you sound like a corporate chatbot. Your content should sound like you've actually shipped code, not like you're …",
      "Stop summarizing your own work just to talk about it. Ozigi takes raw URLs, PDFs, or GitHub READMEs and finds the technical wins for you. Drop the context, get the campaign, and get back to building. Multimodal input is the only way to scale without …",
      "Ozigi handles 90% of the distribution work. One raw note becomes a 3-day campaign for X, LinkedIn, and Discord, plus a full MDX newsletter. You own the final 10% of the polish. That's the human-in-the-loop rule we live by.",
    ],
  },
  {
    label: "LinkedIn Strategy",
    icon: "linkedin",
    cta: "Post to LinkedIn",
    ctaBg: "#0a66c2",
    ctaColor: "#ffffff",
    posts: [
      "Generic AI drafts are a liability for technical founders. I spent years fixing 'seamless' and 'vibrant' in every post before realizing the engine itself needed structural constraints.\n\nWe built Ozigi with a hard-coded blocklist that removes AI fille…",
      "Context-switching is the hidden killer of dev productivity. I watched our team struggle to summarize their own release notes just to feed a prompt into an LLM. It was a massive waste of time.\n\nWe built multimodal input so you can drop a GitHub URL o…",
      "Content distribution shouldn't feel like a second job. Most founders I know have great ideas trapped in their heads because the mechanical work of formatting for four different platforms is too heavy.\n\nOzigi turns one raw note into a 3-day campaign …",
    ],
    footer: ["Add carousel", "LinkedIn tips"],
  },
  {
    label: "Discord Strategy",
    icon: "discord",
    cta: "Send to Discord",
    ctaBg: "#5865f2",
    ctaColor: "#ffffff",
    posts: [
      "Just dropped a fix for the content engine. We've hard-coded a blocklist to keep the output from sounding like generic corporate fluff. No more 'delve' or 'unlock' in your drafts.\n\nPick a persona from the marketplace and let me know if the tone hits …",
      "You can now drop raw PDFs and GitHub URLs directly into the Ozigi dashboard. The engine handles the extraction so you don't have to summarize your docs manually.\n\nTry it with your latest release notes and see how the 3-day campaign looks.",
      "The publishing pipeline is fully open now. You can push to LinkedIn via OAuth and X via Web Intents directly from the Ozigi dashboard.\n\nWe also added MDX support for long-form tutorials. Check the 'Long-Form' tab to see how it structures your techni…",
    ],
  },
];

function StrategyIcon({ kind }: { kind: Strategy["icon"] }) {
  const cls = "w-3 h-3";
  if (kind === "x")
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="currentColor">
        <path d="M11.6 2.5h2.1l-4.6 5.3 5.4 7.7h-4.2l-3.3-4.7L3.3 15.5H1.2l4.9-5.6L1 2.5h4.3l3 4.3 3.3-4.3z" />
      </svg>
    );
  if (kind === "linkedin")
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="currentColor">
        <rect x="2" y="6" width="2.4" height="8" />
        <circle cx="3.2" cy="3.6" r="1.4" />
        <path d="M6.5 6h2.3v1.2c.4-.7 1.2-1.4 2.5-1.4 2 0 2.5 1.2 2.5 3.3V14h-2.4v-3.5c0-1-.4-1.7-1.3-1.7s-1.4.7-1.4 1.7V14H6.5V6z" />
      </svg>
    );
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.5 4.6A19 19 0 0 0 14.7 3l-.2.4a17 17 0 0 1 4.3 1.5 14 14 0 0 0-13.6 0A17 17 0 0 1 9.5 3.4L9.3 3a19 19 0 0 0-4.8 1.6A20 20 0 0 0 .9 18.5a19 19 0 0 0 5.8 3l.4-.6a13 13 0 0 1-2-1c.2-.1.4-.3.5-.4a13 13 0 0 0 12.8 0l.5.4a13 13 0 0 1-2 1l.3.6a19 19 0 0 0 5.8-3 20 20 0 0 0-3.5-13.9zM8 15.5c-1.1 0-2-1-2-2.4S6.9 10.7 8 10.7s2 1 2 2.4S9.1 15.5 8 15.5zm8 0c-1.1 0-2-1-2-2.4s.9-2.4 2-2.4 2 1 2 2.4-.9 2.4-2 2.4z" />
    </svg>
  );
}

function PostCard({
  day,
  body,
  cta,
  ctaBg,
  ctaColor,
  footer,
}: {
  day: number;
  body: string;
  cta: string;
  ctaBg: string;
  ctaColor: string;
  footer?: string[];
}) {
  return (
    <div
      className="rounded-md p-2 flex flex-col gap-1.5 border"
      style={{ background: C.white, borderColor: "rgba(10,21,48,0.08)" }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[7px] font-black uppercase tracking-widest"
          style={{ color: C.ink }}
        >
          Day {day}
        </span>
        <div className="flex items-center gap-0.5">
          {["Edit", "Copy", "Schedule"].map((b) => (
            <span
              key={b}
              className="text-[6px] font-black uppercase tracking-widest px-1 py-0.5 rounded border"
              style={{ color: "#475569", borderColor: "rgba(10,21,48,0.12)" }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Image copy field */}
      <div
        className="rounded text-[7px] px-1.5 py-1"
        style={{ background: "#f1f5f9", color: "#94a3b8" }}
      >
        Image Copy (Optional)
      </div>

      <div className="flex items-center gap-1">
        <span
          className="text-[6px] font-black uppercase tracking-widest px-1 py-0.5 rounded border flex-1 text-center"
          style={{ color: "#475569", borderColor: "rgba(10,21,48,0.12)" }}
        >
          ⬆ Upload
        </span>
        <span
          className="text-[6px] font-black uppercase tracking-widest px-1 py-0.5 rounded border flex-1 text-center"
          style={{ color: "#475569", borderColor: "rgba(10,21,48,0.12)" }}
        >
          Generate Graphic
        </span>
      </div>

      <p
        className="text-[8px] leading-snug whitespace-pre-line line-clamp-[8]"
        style={{ color: "#334155" }}
      >
        {body}
      </p>

      <span className="text-[7px] font-black uppercase tracking-widest" style={{ color: C.red }}>
        Read more
      </span>

      <button
        className="mt-auto py-1.5 rounded text-[7px] font-black uppercase tracking-widest"
        style={{ background: ctaBg, color: ctaColor }}
      >
        {cta}
      </button>

      {footer && (
        <div
          className="flex items-center justify-between pt-1 mt-0.5 border-t"
          style={{ borderColor: "rgba(10,21,48,0.08)" }}
        >
          {footer.map((f) => (
            <span
              key={f}
              className="text-[6px] font-black uppercase tracking-widest"
              style={{ color: "#94a3b8" }}
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AfterPane() {
  return (
    <motion.div
      key="after"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="p-3 md:p-5 overflow-hidden"
      style={{ background: C.navyDeep }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span
          className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border"
          style={{ color: C.muted, borderColor: C.border }}
        >
          ← Architect new campaign
        </span>
        <span
          className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
          style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
          Generated · 3-day campaign · 18s
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {STRATEGIES.map((s) => (
          <div key={s.label}>
            <div className="flex items-center gap-1.5 mb-1.5" style={{ color: C.white }}>
              <StrategyIcon kind={s.icon} />
              <span className="text-[9px] font-black italic uppercase tracking-widest">
                {s.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {s.posts.map((p, i) => (
                <PostCard
                  key={i}
                  day={i + 1}
                  body={p}
                  cta={s.cta}
                  ctaBg={s.ctaBg}
                  ctaColor={s.ctaColor}
                  footer={s.icon === "linkedin" && i < 2 ? s.footer : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Typewriter for input textarea ───────────────────────────────────────── */

const SAMPLE_INPUT =
  "https://github.com/ozigi/release-notes/v1.4 — shipped a hard-coded blocklist for AI tells, multimodal input (PDFs/URLs/audio), and direct publish to X + LinkedIn from the dashboard.";

function useTypewriter(text: string, active: boolean, speed = 22) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active) {
      setOut("");
      return;
    }
    let i = 0;
    setOut("");
    const id = setInterval(() => {
      i++;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return out;
}

/* ── Main component ──────────────────────────────────────────────────────── */

export default function DashboardPreview() {
  const [phase, setPhase] = useState<"before" | "after">("before");

  useEffect(() => {
    const id = setInterval(
      () => setPhase((p) => (p === "before" ? "after" : "before")),
      7000,
    );
    return () => clearInterval(id);
  }, []);

  const typed = useTypewriter(SAMPLE_INPUT, phase === "before");

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-5xl mx-auto"
    >
      {/* Phase tabs */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {(
          [
            { id: "before", label: "1 · Input" },
            { id: "after", label: "2 · Output" },
          ] as const
        ).map((t) => {
          const isActive = phase === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setPhase(t.id)}
              className="text-[10px] font-black uppercase tracking-[0.22em] px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: isActive ? C.red : "transparent",
                color: isActive ? C.white : C.muted,
                border: isActive ? "none" : `1px solid ${C.border}`,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Browser frame */}
      <div
        className="relative rounded-2xl overflow-hidden border shadow-2xl"
        style={{
          background: C.navyDeep,
          borderColor: C.border,
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.5)",
        }}
      >
        {/* Mac chrome */}
        <div
          className="flex items-center gap-1.5 px-3 py-2 border-b"
          style={{ borderColor: C.border, background: C.navy }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ffbd2e" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
          <div
            className="ml-3 px-3 py-0.5 rounded-md text-[10px] font-mono"
            style={{ background: C.panelSoft, color: C.muted }}
          >
            app.ozigi.io / distillery
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.red }} />
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.red }}>
              Live demo
            </span>
          </span>
        </div>

        {/* App body */}
        <div className="grid" style={{ gridTemplateColumns: "minmax(0,180px) 1fr" }}>
          <Sidebar active={phase === "before" ? "Blog Post" : "Generation History"} />
          <div className="relative min-h-[420px] md:min-h-[520px]">
            <AnimatePresence mode="wait">
              {phase === "before" ? <BeforePane typedText={typed} /> : <AfterPane />}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

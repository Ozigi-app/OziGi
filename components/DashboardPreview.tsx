"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────
   DASHBOARD PREVIEW
   Faithful, scaled-down recreation of the real Ozigi product.
   Three phases auto-cycle (and are clickable):
     1. Input          — the content engine (URL / notes textarea)
     2. Distribution   — grid of platform cards (X, LinkedIn, Discord,
                         Email, Slack) — what a generated campaign
                         looks like, ready to schedule
     3. Long-form      — standalone article view (hero + sections)
   Colors mirror the actual dark dashboard (deep navy + brand red).
───────────────────────────────────────────────────────────────────── */

// Real dashboard tones — light theme (matches /dashboard live colors)
const C = {
  bg: "#F8FAFC",           // slate-50 — outer dashboard bg
  sidebar: "#FFFFFF",      // white sidebar
  panel: "#FFFFFF",        // white card surfaces
  inner: "#F1F5F9",        // slate-100 — nested controls inside cards
  border: "#E2E8F0",       // slate-200
  borderStrong: "#CBD5E1", // slate-300
  text: "#0A1628",         // brand-navy — primary text
  muted: "#334155",        // slate-700 — secondary text
  dim: "#64748B",          // slate-500 — hints
  red: "#E8320A",
  redDeep: "#C4290A",
  cardWhite: "#F1F5F9",    // slate-100 — nested "summary" tiles
  ink: "#0A1628",
};

type Phase = "input" | "distribution" | "longform";

const PHASES: { id: Phase; label: string }[] = [
  { id: "input", label: "1 · Input" },
  { id: "distribution", label: "2 · Distribute" },
  { id: "longform", label: "3 · Long-form" },
];

const SAMPLE_INPUT =
  "https://ozigi.app/changelog/v2.4-distillery-workflow";

export default function DashboardPreview() {
  const [phase, setPhase] = useState<Phase>("input");
  const [typedInput, setTypedInput] = useState("");
  const [paused, setPaused] = useState(false);

  // Auto-advance through phases (input → distribution → longform → loop)
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      setPhase((p) =>
        p === "input" ? "distribution" : p === "distribution" ? "longform" : "input"
      );
    }, phase === "input" ? 5500 : 6500);
    return () => clearTimeout(t);
  }, [phase, paused]);

  // Typewriter for input phase
  useEffect(() => {
    if (phase !== "input") {
      setTypedInput("");
      return;
    }
    let i = 0;
    setTypedInput("");
    const id = setInterval(() => {
      i++;
      setTypedInput(SAMPLE_INPUT.slice(0, i));
      if (i >= SAMPLE_INPUT.length) clearInterval(id);
    }, 45);
    return () => clearInterval(id);
  }, [phase]);

  const phaseIdx = useMemo(
    () => PHASES.findIndex((p) => p.id === phase),
    [phase]
  );

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Phase tabs ────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 mb-5">
        {PHASES.map((p, i) => {
          const active = p.id === phase;
          return (
            <button
              key={p.id}
              onClick={() => setPhase(p.id)}
              className="text-[10px] md:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all duration-200"
              style={{
                background: active ? C.red : "transparent",
                color: active ? "#fff" : C.muted,
                border: `1px solid ${active ? C.red : C.border}`,
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ── Browser frame ─────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          boxShadow:
            "0 30px 80px -20px rgba(10,22,40,0.18), 0 0 0 1px rgba(10,22,40,0.04)",
        }}
      >
        {/* Mac chrome */}
        <div
          className="flex items-center gap-1.5 px-4 py-3 border-b"
          style={{ borderColor: C.border, background: C.sidebar }}
        >
          <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#ffbd2e" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
          <div
            className="ml-3 flex-1 max-w-md mx-auto rounded-md px-3 py-1 text-[10px] md:text-[11px] font-medium text-center"
            style={{
              background: C.inner,
              color: C.muted,
              border: `1px solid ${C.border}`,
            }}
          >
            ozigi.app/{phase === "longform" ? "long-form" : "dashboard"}
          </div>
          <div className="hidden md:block w-[60px]" />
        </div>

        {/* Phase body */}
        <div className="relative overflow-hidden" style={{ minHeight: 560 }}>
          <AnimatePresence mode="wait" initial={false}>
            {phase === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <InputPhase typedInput={typedInput} />
              </motion.div>
            )}
            {phase === "distribution" && (
              <motion.div
                key="distribution"
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <DistributionPhase />
              </motion.div>
            )}
            {phase === "longform" && (
              <motion.div
                key="longform"
                initial={{ opacity: 0, x: 80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <LongFormPhase />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Phase progress ────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 mt-5">
        {PHASES.map((p, i) => (
          <span
            key={p.id}
            className="block h-1 rounded-full transition-all duration-500"
            style={{
              width: i === phaseIdx ? 32 : 12,
              background: i === phaseIdx ? C.red : "rgba(10,22,40,0.16)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   PHASE 1 — INPUT (the content engine before generation)
───────────────────────────────────────────────────────────────────── */

function InputPhase({ typedInput }: { typedInput: string }) {
  return (
    <div className="flex" style={{ background: C.bg, minHeight: 560 }}>
      <Sidebar active="Blog Post" />
      <div className="flex-1 p-5 md:p-7">
        {/* page header */}
        <div className="flex items-center gap-3 mb-5">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-base"
            style={{ background: "rgba(232,50,10,0.12)" }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={C.red} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
          </span>
          <h3
            className="text-lg md:text-xl font-black italic uppercase tracking-tight"
            style={{ color: C.text }}
          >
            Distillery
          </h3>
        </div>

        {/* card panel */}
        <div
          className="rounded-xl p-4 md:p-5"
          style={{ background: C.panel, border: `1px solid ${C.border}` }}
        >
          <p
            className="text-[10px] font-black uppercase tracking-[0.18em] mb-2"
            style={{ color: C.muted }}
          >
            Paste url, notes, or raw context
          </p>

          <div
            className="rounded-lg p-3 text-sm leading-relaxed font-mono min-h-[64px]"
            style={{
              background: C.inner,
              border: `1px solid ${C.border}`,
              color: C.text,
            }}
          >
            {typedInput || (
              <span style={{ color: C.dim }}>
                Paste a URL, meeting notes, or any text context here&hellip;
              </span>
            )}
            {typedInput && (
              <span
                className="inline-block w-[7px] h-[14px] -mb-[2px] ml-[2px] animate-pulse"
                style={{ background: C.red }}
              />
            )}
          </div>

          <p className="text-[10px] mt-2" style={{ color: C.dim }}>
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke={C.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              Attach a file (PDF, image, video, audio)
            </span>
          </p>

          {/* persona + platforms row */}
          <div className="flex flex-wrap items-center gap-3 mt-4 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-black uppercase tracking-widest" style={{ color: C.muted }}>
                Persona
              </span>
              <span
                className="px-2.5 py-1 rounded-md font-semibold"
                style={{ background: C.inner, color: C.text, border: `1px solid ${C.border}` }}
              >
                Default ▾
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-black uppercase tracking-widest mr-1" style={{ color: C.muted }}>
                Platforms
              </span>
              {[
                { label: "X", on: true },
                { label: "LI", on: true },
                { label: "DC", on: true },
                { label: "SL", on: true },
                { label: "EM", on: true },
              ].map((p) => (
                <span
                  key={p.label}
                  className="w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center"
                  style={{
                    background: p.on ? C.ink : "transparent",
                    color: p.on ? "#FFFFFF" : C.muted,
                    border: `1px solid ${p.on ? C.ink : C.border}`,
                  }}
                >
                  {p.label}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className="w-6 h-6 rounded-full text-[9px] font-black flex items-center justify-center"
                style={{ background: C.ink, color: "#FFFFFF" }}
              >
                X
              </span>
              <span style={{ color: C.muted }}>Single tweet</span>
              <span style={{ color: C.dim }}>⇄</span>
            </div>
          </div>

          {/* generate button */}
          <button
            className="mt-4 w-full py-3 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-transform active:scale-[0.99]"
            style={{
              background: `linear-gradient(135deg, ${C.red} 0%, ${C.redDeep} 100%)`,
              boxShadow: "0 8px 24px rgba(232,50,10,0.35)",
            }}
          >
            Generate content ⚡
          </button>

          <p className="text-center text-[10px] mt-2" style={{ color: C.dim }}>
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke={C.dim} strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Advanced directives ▾
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   PHASE 2 — DISTRIBUTION GRID (X, LinkedIn, Discord, Email, Slack)
───────────────────────────────────────────────────────────────────── */

const DISTRIBUTIONS: {
  id: string;
  name: string;
  iconBg: string;
  icon: React.ReactNode;
  body: string;
  ctaLabel: string;
  ctaBg: string;
  ctaIcon?: React.ReactNode;
}[] = [
  {
    id: "x",
    name: "X / Twitter",
    iconBg: "#000000",
    icon: (
      <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    body:
      "We hard-coded a blocklist that strips 'delve', 'tapestry', 'vibrant' before they hit your feed. Generic AI smell is the #1 reason posts flop on X. Ship the diff, not the marketing copy. (1 / 6)",
    ctaLabel: "Schedule tweet",
    ctaBg: "#000000",
  },
  {
    id: "li",
    name: "LinkedIn",
    iconBg: "#0a66c2",
    icon: (
      <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff">
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12M7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0" />
      </svg>
    ),
    body:
      "Generic AI drafts are a liability for technical founders. I spent two weeks fixing 'seamless' and 'vibrant' in every post before realizing the engine itself needed structural constraints. So we built one.",
    ctaLabel: "Post to LinkedIn",
    ctaBg: "#0a66c2",
  },
  {
    id: "dc",
    name: "Discord",
    iconBg: "#5865F2",
    icon: (
      <svg viewBox="0 0 24 24" width="13" height="13" fill="#fff">
        <path d="M19.27 5.33A19.6 19.6 0 0 0 14.4 4l-.24.49a18 18 0 0 0-5.32 0L8.6 4a19.6 19.6 0 0 0-4.86 1.33C.93 9.83 0 14.21 0 18.55a19.7 19.7 0 0 0 6.04 3.06l.6-.84a13.2 13.2 0 0 1-2.04-1c.17-.13.34-.26.5-.4 3.95 1.86 8.22 1.86 12.13 0l.5.4c-.65.39-1.34.72-2.05 1l.6.84a19.7 19.7 0 0 0 6.05-3.06c0-5.06-1.05-9.4-3.06-13.22M8.02 15.33c-1.18 0-2.16-1.1-2.16-2.45 0-1.36.95-2.46 2.16-2.46 1.2 0 2.18 1.1 2.16 2.46 0 1.35-.96 2.45-2.16 2.45m7.96 0c-1.18 0-2.16-1.1-2.16-2.45 0-1.36.95-2.46 2.16-2.46 1.2 0 2.18 1.1 2.16 2.46 0 1.35-.96 2.45-2.16 2.45" />
      </svg>
    ),
    body:
      "Just dropped a fix for the content engine. Hard-coded blocklist removes 'delve' / 'unlock' / 'tapestry' from every draft. No more generic LinkedIn fluff. Pick a persona from the marketplace and let me know if it lands.",
    ctaLabel: "Send to Discord",
    ctaBg: "#5865F2",
  },
  {
    id: "em",
    name: "Email newsletter",
    iconBg: C.red,
    icon: (
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </svg>
    ),
    body:
      "Subject: The IDE wars returned while we were sleeping. The era of tab-to-autocomplete ended without a funeral. If you're still relying on GitHub Copilot to suggest the next line of a function, you're already behind…",
    ctaLabel: "Schedule newsletter",
    ctaBg: C.red,
  },
  {
    id: "sl",
    name: "Slack",
    iconBg: "#4A154B",
    icon: (
      <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff">
        <path d="M5.04 15.16a2.52 2.52 0 1 1-2.52-2.52h2.52zm1.27 0a2.52 2.52 0 0 1 5.04 0v6.32a2.52 2.52 0 0 1-5.04 0zM8.83 5.04a2.52 2.52 0 1 1 2.52-2.52v2.52zm0 1.27a2.52 2.52 0 0 1 0 5.04H2.52a2.52 2.52 0 0 1 0-5.04zM18.96 8.83a2.52 2.52 0 1 1 2.52 2.52h-2.52zm-1.27 0a2.52 2.52 0 0 1-5.04 0V2.52a2.52 2.52 0 0 1 5.04 0zM15.16 18.96a2.52 2.52 0 1 1-2.52 2.52v-2.52zm0-1.27a2.52 2.52 0 0 1 0-5.04h6.32a2.52 2.52 0 0 1 0 5.04z" />
      </svg>
    ),
    body:
      "#engineering — heads up team: shipped the rate-limiting fix to prod. Edge enforcement landed in three prompts via Claude Code. Next: I'll write up the full RAG-for-code post for the blog. Threads welcome.",
    ctaLabel: "Send to Slack",
    ctaBg: "#4A154B",
  },
];

function DistributionPhase() {
  return (
    <div className="flex" style={{ background: C.bg, minHeight: 560 }}>
      <Sidebar active="Generation History" />

      <div className="flex-1 p-5 md:p-7">
        {/* page header */}
        <div className="flex items-center justify-between mb-1">
          <button
            className="text-[10px] md:text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
            style={{ color: C.muted }}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Architect new campaign
          </button>
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
          >
            Generated · 5 platforms
          </span>
        </div>

        <h3
          className="text-lg md:text-xl font-black italic uppercase tracking-tight mt-2 mb-4"
          style={{ color: C.text }}
        >
          Distribution grid
        </h3>

        {/* cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {DISTRIBUTIONS.map((d) => (
            <DistributionCard key={d.id} item={d} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DistributionCard({ item }: { item: typeof DISTRIBUTIONS[number] }) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      {/* header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md"
            style={{ background: item.iconBg }}
          >
            {item.icon}
          </span>
          <p
            className="text-[11px] font-black italic uppercase tracking-tight"
            style={{ color: C.text }}
          >
            {item.name}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ActionPill label="Edit" />
          <ActionPill label="Copy" />
        </div>
      </div>

      {/* body card (white, like the email summary in the screenshot) */}
      <div
        className="flex-1 rounded-lg p-3 mb-2.5"
        style={{ background: C.cardWhite }}
      >
        <p
          className="text-[10px] font-black uppercase tracking-[0.16em] mb-1.5"
          style={{ color: "#475569" }}
        >
          Campaign summary
        </p>
        <p
          className="text-[11.5px] leading-relaxed line-clamp-5"
          style={{ color: C.ink }}
        >
          {item.body}
        </p>
      </div>

      {/* schedule cta */}
      <button
        className="w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white inline-flex items-center justify-center gap-1.5 transition-transform active:scale-[0.99]"
        style={{ background: item.ctaBg }}
      >
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {item.ctaLabel}
      </button>
    </div>
  );
}

function ActionPill({ label }: { label: string }) {
  return (
    <span
      className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
      style={{
        background: C.inner,
        color: C.muted,
        border: `1px solid ${C.border}`,
      }}
    >
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   PHASE 3 — LONG-FORM (standalone article view)
───────────────────────────────────────────────────────────────────── */

function LongFormPhase() {
  return (
    <div className="p-5 md:p-7" style={{ background: C.bg, minHeight: 560 }}>
      {/* breadcrumb */}
      <button
        className="text-[10px] md:text-xs font-bold inline-flex items-center gap-1.5"
        style={{ color: C.muted }}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      <div className="flex items-center gap-3 mt-3 mb-1">
        <span
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: "rgba(232,50,10,0.12)" }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={C.red} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="13" y2="17" />
          </svg>
        </span>
        <h3
          className="text-lg md:text-xl font-black italic uppercase tracking-tight"
          style={{ color: C.text }}
        >
          Long-form content
        </h3>
      </div>
      <p className="text-xs mb-4" style={{ color: C.muted }}>
        Generate articles and structured technical briefs for your audience
      </p>

      {/* tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[
          { label: "Input", active: false },
          { label: "Output", active: true },
          { label: "History (3)", active: false },
          { label: "Technical brief", active: false, icon: true },
        ].map((t) => (
          <span
            key={t.label}
            className="text-[10px] md:text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md inline-flex items-center gap-1.5"
            style={{
              background: t.active ? "rgba(232,50,10,0.12)" : C.panel,
              color: t.active ? C.red : C.muted,
              border: `1px solid ${t.active ? "rgba(232,50,10,0.35)" : C.border}`,
            }}
          >
            {t.icon && (
              <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                <path d="M12 0l2.5 7.5L22 10l-7.5 2.5L12 20l-2.5-7.5L2 10l7.5-2.5z" />
              </svg>
            )}
            {t.label}
          </span>
        ))}
      </div>

      {/* hero card */}
      <div
        className="rounded-xl p-4 md:p-5 mb-3"
        style={{ background: C.panel, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4
              className="text-base md:text-lg font-black leading-snug"
              style={{ color: C.text }}
            >
              Beyond the Template: Why Technical Teams are Migrating to the Ozigi Distillery Workflow
            </h4>
            <p className="text-[11px] md:text-xs mt-2 leading-relaxed" style={{ color: C.muted }}>
              How to replace rigid marketing AI suites with a high-signal,
              developer-first content pipeline that turns raw engineering data
              into authentic technical content.
            </p>
          </div>
          <button
            className="shrink-0 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest text-white inline-flex items-center gap-1.5"
            style={{ background: C.red }}
          >
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy all
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {["1465 words", "Technical tone", "Listicle"].map((p) => (
            <span
              key={p}
              className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
              style={{
                background: C.inner,
                color: C.muted,
                border: `1px solid ${C.border}`,
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* sections */}
      <ArticleSection
        title="Introduction: The Engineering Content Crisis"
        wordCount="140 words"
        body="For senior engineers and technical founders, the current state of AI content generation is a source of profound friction. Tools like Jasper and Copy.ai were built for marketing departments, emphasizing rigid 'templates' and 'brand voices' that fail to capture the nuance of a complex pull request or an architectural brain dump. The result is 'AI smell' — a distinctively generic, verbose style characterized by words like 'tapestry' and 'delve'."
      />
      <ArticleSection
        title="1. The Template Trap vs. The Distillery Workflow"
        wordCount="265 words"
        body="Traditional AI suites rely on a 'Template' UX. To generate a blog post in Jasper, a user must navigate a library of 50+ templates, select one, and then manually fill out form fields (Title, Tone of Voice, Keywords). Ozigi's 'Distillery' workflow inverts this. Instead of starting with a structure, you start with raw ingestion."
        code={`{
  "source_type": "raw_transcript",
  "payload": "[00:01:23] Dev A: ...the legacy Jasper setup is friction…",
  "instruction": "Extract the architectural shift and draft a deep-dive."
}`}
      />
    </div>
  );
}

function ArticleSection({
  title,
  wordCount,
  body,
  code,
}: {
  title: string;
  wordCount: string;
  body: string;
  code?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 md:p-5 mb-3"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h5 className="text-sm md:text-base font-bold" style={{ color: C.text }}>
          {title}
        </h5>
        <button
          className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md inline-flex items-center gap-1.5"
          style={{
            background: C.inner,
            color: C.muted,
            border: `1px solid ${C.border}`,
          }}
        >
          <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </button>
      </div>
      <p className="text-[11.5px] md:text-xs leading-relaxed" style={{ color: C.muted }}>
        {body}
      </p>
      {code && (
        <pre
          className="mt-3 rounded-lg p-3 text-[10px] md:text-[11px] leading-snug font-mono overflow-x-auto"
          style={{
            background: "#0A1628",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#a5f3fc",
          }}
        >
          <span style={{ color: "#64748B" }}>JSON</span>
          {"\n"}
          {code}
        </pre>
      )}
      <p className="text-[10px] mt-3" style={{ color: C.dim }}>
        {wordCount}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SIDEBAR — used by phases 1 & 2 (long-form is full-width)
───────────────────────────────────────────────────────────────────── */

const NAV: { label: string; icon: React.ReactNode }[] = [
  {
    label: "Generation History",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: "Scheduled Posts",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Subscribers",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </svg>
    ),
  },
  {
    label: "Personas",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    label: "Persona Marketplace",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9 5 3h14l2 6" />
        <path d="M3 9v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
        <path d="M3 9h18" />
      </svg>
    ),
  },
  {
    label: "Blog Post",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    label: "Settings & Integrations",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33H15a1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    label: "Copilot Settings",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 9 9l-7 1 5 5-1.5 7L12 19l5.5 3L16 15l5-5-7-1z" />
      </svg>
    ),
  },
];

function Sidebar({ active }: { active: string }) {
  return (
    <aside
      className="hidden md:flex flex-col w-[200px] lg:w-[210px] shrink-0 p-4"
      style={{
        background: C.sidebar,
        borderRight: `1px solid ${C.border}`,
        boxShadow: "1px 0 0 0 rgba(10,22,40,0.02)",
      }}
    >
      {/* logo row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ background: "rgba(232,50,10,0.14)" }}
          >
            <span className="text-[12px] font-black italic" style={{ color: C.red }}>
              O
            </span>
          </span>
          <span
            className="text-sm font-black italic uppercase tracking-tight"
            style={{ color: C.text }}
          >
            Ozigi
          </span>
        </div>
        <span style={{ color: C.dim }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </span>
      </div>

      {/* nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => {
          const isActive = n.label === active;
          return (
            <div
              key={n.label}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] font-medium"
              style={{
                background: isActive ? "rgba(232,50,10,0.12)" : "transparent",
                color: isActive ? C.text : C.muted,
                border: `1px solid ${isActive ? "rgba(232,50,10,0.35)" : "transparent"}`,
              }}
            >
              <span style={{ color: isActive ? C.red : C.dim }}>{n.icon}</span>
              <span className="truncate">{n.label}</span>
            </div>
          );
        })}
      </nav>

      {/* footer impact tiles */}
      <div className="mt-auto pt-4">
        <p
          className="text-[9px] font-black uppercase tracking-[0.18em] mb-2"
          style={{ color: C.dim }}
        >
          Your impact
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <div
            className="rounded-md p-2 text-center"
            style={{ background: C.cardWhite }}
          >
            <p className="text-base font-black leading-none" style={{ color: C.ink }}>
              18
            </p>
            <p
              className="text-[8px] font-black uppercase tracking-widest mt-1"
              style={{ color: "#475569" }}
            >
              Campaigns
            </p>
          </div>
          <div
            className="rounded-md p-2 text-center"
            style={{ background: C.cardWhite }}
          >
            <p className="text-base font-black leading-none" style={{ color: C.ink }}>
              2
            </p>
            <p
              className="text-[8px] font-black uppercase tracking-widest mt-1"
              style={{ color: "#475569" }}
            >
              Scheduled
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────
   PRODUCT VIDEO DEMO
   Cinematic, video-player-style animated walkthrough of the Ozigi
   dashboard. Three chapters auto-play in a loop:
     1. Input      — content engine, typewriter URL entry
     2. Distribute — 5-platform campaign cards animate in
     3. Long-form  — full article view
   Controls: play/pause, chapter scrubbing, cursor overlay, callouts.
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

/* ── Timeline ─────────────────────────────────────────────────────── */
const TOTAL_MS = 14_000;

type Phase = "input" | "generating" | "distribution" | "longform";

const PHASE_TIMELINE: { phase: Phase; startMs: number; endMs: number }[] = [
  { phase: "input",        startMs: 0,      endMs: 4_500  },
  { phase: "generating",   startMs: 4_500,  endMs: 6_000  },
  { phase: "distribution", startMs: 6_000,  endMs: 11_000 },
  { phase: "longform",     startMs: 11_000, endMs: 14_000 },
];

// Visible chapters for the progress bar
const CHAPTERS = [
  { label: "1 · Input",     startMs: 0      },
  { label: "2 · Distribute", startMs: 6_000  },
  { label: "3 · Long-form", startMs: 11_000 },
];

const SAMPLE_INPUT = "https://ozigi.app/changelog/v2.4-distillery-workflow";

// Callout annotations — floating over the browser frame
const CALLOUTS: { text: string; showMs: number; hideMs: number; x: string; y: string }[] = [
  { text: "Paste any URL, PDF, or notes",    showMs: 700,    hideMs: 2_600,  x: "54%", y: "16%" },
  { text: "All 5 platforms in one click",    showMs: 3_000,  hideMs: 4_400,  x: "54%", y: "52%" },
  { text: "No AI buzzwords — ever",          showMs: 6_800,  hideMs: 9_000,  x: "54%", y: "20%" },
  { text: "Long-form article — always free", showMs: 11_500, hideMs: 13_500, x: "60%", y: "26%" },
];

// Cursor waypoints [ x%, y% relative to browser-content area, at ms ]
const CURSOR_PATH: { x: number; y: number; ms: number }[] = [
  { x: 54, y: 28, ms: 0       }, // over textarea
  { x: 54, y: 28, ms: 2_000   }, // linger on textarea
  { x: 54, y: 64, ms: 3_500   }, // move to generate button
  { x: 54, y: 64, ms: 4_500   }, // hover button before click
  { x: 50, y: 40, ms: 6_000   }, // distribution center
  { x: 26, y: 38, ms: 7_200   }, // hover X card
  { x: 58, y: 38, ms: 8_800   }, // hover LinkedIn card
  { x: 42, y: 68, ms: 10_200  }, // email schedule button
  { x: 72, y: 24, ms: 11_500  }, // longform copy button
  { x: 52, y: 55, ms: 13_000  }, // scroll article
  { x: 52, y: 55, ms: 14_000  }, // hold for loop
];

/* ── Cursor interpolation ─────────────────────────────────────────── */
function lerpCursor(elapsed: number): { x: number; y: number } {
  const path = CURSOR_PATH;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    if (elapsed >= a.ms && elapsed <= b.ms) {
      const t = (elapsed - a.ms) / (b.ms - a.ms);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y };
}

/* ── Main component ───────────────────────────────────────────────── */
export default function DashboardPreview() {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick at ~60fps equivalent (16ms)
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed((e) => (e >= TOTAL_MS ? 0 : e + 16));
    }, 16);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  const phase = useMemo<Phase>(() => {
    for (let i = PHASE_TIMELINE.length - 1; i >= 0; i--) {
      if (elapsed >= PHASE_TIMELINE[i].startMs) return PHASE_TIMELINE[i].phase;
    }
    return "input";
  }, [elapsed]);

  // Typewriter driven by elapsed (scrub-safe)
  const typedInput = useMemo(() => {
    if (phase !== "input") return "";
    const typeStart = 500, typeEnd = 2_800;
    if (elapsed < typeStart) return "";
    const t = Math.min((elapsed - typeStart) / (typeEnd - typeStart), 1);
    return SAMPLE_INPUT.slice(0, Math.floor(t * SAMPLE_INPUT.length));
  }, [elapsed, phase]);

  const cursorPos = useMemo(() => lerpCursor(elapsed), [elapsed]);

  const activeCallout = useMemo(
    () => CALLOUTS.find((c) => elapsed >= c.showMs && elapsed < c.hideMs) ?? null,
    [elapsed]
  );

  // Button pulse when cursor reaches generate button
  const buttonPulsing = phase === "input" && elapsed >= 3_200;

  // Distribution phase card stagger: each card appears 280ms after phase start
  const distElapsed = phase === "distribution" ? elapsed - 6_000 : 0;

  const handleSeek = (ms: number) => setElapsed(Math.max(0, Math.min(TOTAL_MS, ms)));

  const previousVisiblePhase = useMemo<"input" | "distribution" | "longform">(() => {
    if (phase === "generating") return "input";
    if (phase === "input") return "input";
    if (phase === "distribution") return "distribution";
    return "longform";
  }, [phase]);

  return (
    <div className="relative w-full select-none">
      {/* ── Browser frame ───────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          boxShadow: "0 30px 80px -20px rgba(10,22,40,0.18), 0 0 0 1px rgba(10,22,40,0.04)",
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
            style={{ background: C.inner, color: C.muted, border: `1px solid ${C.border}` }}
          >
            ozigi.app/{previousVisiblePhase === "longform" ? "long-form" : "dashboard"}
          </div>
          <div className="hidden md:block w-[60px]" />
        </div>

        {/* Phase content */}
        <div className="relative overflow-hidden" style={{ minHeight: 560 }}>
          <AnimatePresence mode="wait" initial={false}>
            {previousVisiblePhase === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: phase === "generating" ? 0.35 : 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <InputPhase typedInput={typedInput} buttonPulsing={buttonPulsing} />
              </motion.div>
            )}
            {previousVisiblePhase === "distribution" && (
              <motion.div
                key="distribution"
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <DistributionPhase distElapsed={distElapsed} />
              </motion.div>
            )}
            {previousVisiblePhase === "longform" && (
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

          {/* Generating overlay */}
          <AnimatePresence>
            {phase === "generating" && (
              <motion.div
                key="generating-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center z-20"
                style={{ background: "rgba(248,250,252,0.88)", backdropFilter: "blur(4px)" }}
              >
                <GeneratingOverlay elapsed={elapsed} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scene transition title card */}
          <AnimatePresence>
            {(elapsed >= 5_700 && elapsed < 6_400) && (
              <SceneTitleCard key="scene2" title="Distribution Grid" subtitle="5 platform-native drafts, ready to schedule" />
            )}
            {(elapsed >= 10_700 && elapsed < 11_400) && (
              <SceneTitleCard key="scene3" title="Long-form Content" subtitle="Full article generated from the same input" />
            )}
          </AnimatePresence>

          {/* Callout bubble */}
          <AnimatePresence>
            {activeCallout && (
              <motion.div
                key={activeCallout.text}
                initial={{ opacity: 0, scale: 0.88, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: 6 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="absolute z-30 pointer-events-none"
                style={{ left: activeCallout.x, top: activeCallout.y }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg"
                  style={{
                    background: C.ink,
                    color: "#fff",
                    boxShadow: "0 4px 20px rgba(10,22,40,0.35)",
                    border: `1px solid rgba(255,255,255,0.12)`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                    style={{ background: C.red }}
                  />
                  {activeCallout.text}
                </div>
                {/* Arrow */}
                <div
                  className="absolute -bottom-1.5 left-5 w-3 h-3 rotate-45"
                  style={{ background: C.ink }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Animated cursor */}
          <div
            className="absolute inset-0 pointer-events-none z-20 overflow-hidden"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <motion.div
              className="absolute"
              animate={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ transform: "translate(-50%, -50%)" }}
            >
              <CursorDot clicking={buttonPulsing && elapsed >= 4_200 && elapsed < 4_500} />
            </motion.div>
          </div>
        </div>

        {/* ── Video controls bar ─────────────────────────────────────── */}
        <VideoControls
          elapsed={elapsed}
          total={TOTAL_MS}
          playing={playing}
          chapters={CHAPTERS}
          onPlayPause={() => setPlaying((p) => !p)}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   VIDEO CONTROLS BAR
───────────────────────────────────────────────────────────────────── */

function VideoControls({
  elapsed,
  total,
  playing,
  chapters,
  onPlayPause,
  onSeek,
}: {
  elapsed: number;
  total: number;
  playing: boolean;
  chapters: typeof CHAPTERS;
  onPlayPause: () => void;
  onSeek: (ms: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(pct * total);
  };

  const progress = elapsed / total;

  // Current chapter index
  const chapterIdx = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (elapsed >= chapters[i].startMs) idx = i;
    }
    return idx;
  }, [elapsed, chapters]);

  return (
    <div
      className="px-4 pt-3 pb-4"
      style={{ background: C.ink, borderTop: `1px solid rgba(255,255,255,0.06)` }}
    >
      {/* Chapter labels row */}
      <div className="flex items-center mb-2 relative" style={{ paddingLeft: 28 }}>
        {chapters.map((ch, i) => {
          const pct = (ch.startMs / total) * 100;
          const isActive = i === chapterIdx;
          return (
            <button
              key={ch.label}
              onClick={() => onSeek(ch.startMs)}
              className="absolute text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-colors duration-200"
              style={{
                left: i === 0 ? 0 : `calc(${pct}% + 28px)`,
                color: isActive ? "#fff" : "rgba(255,255,255,0.35)",
                transform: i === 0 ? "none" : "translateX(-50%)",
              }}
            >
              {ch.label}
            </button>
          );
        })}
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Play / pause */}
        <button
          onClick={onPlayPause}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
          style={{ color: "#fff" }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Progress track */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="flex-1 relative h-1.5 rounded-full cursor-pointer group"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          {/* Fill */}
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${progress * 100}%`, background: C.red }}
          />

          {/* Chapter tick marks */}
          {chapters.slice(1).map((ch) => (
            <div
              key={ch.label}
              className="absolute top-1/2 w-px -translate-y-1/2"
              style={{
                left: `${(ch.startMs / total) * 100}%`,
                height: "150%",
                background: "rgba(255,255,255,0.4)",
              }}
            />
          ))}

          {/* Scrub handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress * 100}%`, background: "#fff", boxShadow: "0 0 0 2px rgba(10,22,40,0.5)" }}
          />
        </div>

        {/* Restart icon */}
        <button
          onClick={() => onSeek(0)}
          className="flex-shrink-0 transition-opacity hover:opacity-80"
          style={{ color: "rgba(255,255,255,0.4)" }}
          aria-label="Restart"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   CURSOR DOT
───────────────────────────────────────────────────────────────────── */

function CursorDot({ clicking }: { clicking: boolean }) {
  return (
    <div className="relative">
      {/* Outer ring on click */}
      <AnimatePresence>
        {clicking && (
          <motion.div
            key="ring"
            initial={{ scale: 0.5, opacity: 0.8 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute rounded-full"
            style={{
              width: 16,
              height: 16,
              top: -8,
              left: -8,
              border: `1.5px solid ${C.red}`,
            }}
          />
        )}
      </AnimatePresence>
      {/* Cursor body */}
      <svg
        viewBox="0 0 24 24"
        width={clicking ? 18 : 16}
        height={clicking ? 18 : 16}
        style={{
          filter: "drop-shadow(0 1px 4px rgba(10,22,40,0.4))",
          transition: "width 0.1s, height 0.1s",
        }}
      >
        <polygon points="4,2 4,18 8,14 12,22 14,21 10,13 16,13" fill="#0A1628" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SCENE TITLE CARD — briefly overlays on phase transitions
───────────────────────────────────────────────────────────────────── */

function SceneTitleCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 flex items-center justify-center z-40"
      style={{ background: "rgba(10,22,40,0.78)", backdropFilter: "blur(6px)" }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 16 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="text-center px-8"
      >
        <p
          className="text-[10px] font-black uppercase tracking-[0.25em] mb-2"
          style={{ color: C.red }}
        >
          Next
        </p>
        <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tight text-white">
          {title}
        </h3>
        <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
          {subtitle}
        </p>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   GENERATING OVERLAY
───────────────────────────────────────────────────────────────────── */

function GeneratingOverlay({ elapsed }: { elapsed: number }) {
  const genElapsed = elapsed - 4_500;
  const genTotal   = 1_500;
  const barPct     = Math.min((genElapsed / genTotal) * 100, 97);

  const steps = [
    "Extracting source context…",
    "Stripping banned phrases…",
    "Formatting for 5 platforms…",
  ];
  const stepIdx = genElapsed < 420 ? 0 : genElapsed < 960 ? 1 : 2;

  return (
    <div className="flex flex-col items-center justify-center gap-5 px-8" style={{ minHeight: 200 }}>
      {/* Spinner */}
      <div className="relative w-14 h-14">
        <svg className="absolute inset-0 animate-spin" viewBox="0 0 56 56" fill="none">
          <circle cx="28" cy="28" r="24" stroke={C.border} strokeWidth="3" />
          <path
            d="M28 4 A24 24 0 0 1 52 28"
            stroke={C.red}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-[10px] font-black"
          style={{ color: C.red }}
        >
          AI
        </div>
      </div>

      {/* Step text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={stepIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="text-sm font-semibold text-center"
          style={{ color: C.text }}
        >
          {steps[stepIdx]}
        </motion.p>
      </AnimatePresence>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: C.inner }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redDeep})` }}
            animate={{ width: `${barPct}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        <p className="text-center text-[10px] mt-1.5 font-black uppercase tracking-widest" style={{ color: C.dim }}>
          Ozigi AI · 5 platforms
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   PHASE 1 — INPUT
───────────────────────────────────────────────────────────────────── */

function InputPhase({ typedInput, buttonPulsing }: { typedInput: string; buttonPulsing: boolean }) {
  return (
    <div className="flex" style={{ background: C.bg, minHeight: 560 }}>
      <Sidebar active="Blog Post" />
      <div className="flex-1 p-5 md:p-7">
        {/* header */}
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
          <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tight" style={{ color: C.text }}>
            Distillery
          </h3>
        </div>

        {/* card */}
        <div className="rounded-xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-2" style={{ color: C.muted }}>
            Paste url, notes, or raw context
          </p>

          <div
            className="rounded-lg p-3 text-sm leading-relaxed font-mono min-h-[64px]"
            style={{ background: C.inner, border: `1px solid ${C.border}`, color: C.text }}
          >
            {typedInput || (
              <span style={{ color: C.dim }}>Paste a URL, meeting notes, or any text context here&hellip;</span>
            )}
            {typedInput && typedInput.length < SAMPLE_INPUT.length && (
              <span className="inline-block w-[7px] h-[14px] -mb-[2px] ml-[2px] animate-pulse" style={{ background: C.red }} />
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

          {/* persona + platforms */}
          <div className="flex flex-wrap items-center gap-3 mt-4 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-black uppercase tracking-widest" style={{ color: C.muted }}>Persona</span>
              <span className="px-2.5 py-1 rounded-md font-semibold" style={{ background: C.inner, color: C.text, border: `1px solid ${C.border}` }}>
                Default ▾
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-black uppercase tracking-widest mr-1" style={{ color: C.muted }}>Platforms</span>
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
                  style={{ background: p.on ? C.ink : "transparent", color: p.on ? "#FFFFFF" : C.muted, border: `1px solid ${p.on ? C.ink : C.border}` }}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>

          {/* generate button */}
          <motion.button
            animate={buttonPulsing ? { boxShadow: ["0 8px 24px rgba(232,50,10,0.35)", "0 12px 36px rgba(232,50,10,0.6)", "0 8px 24px rgba(232,50,10,0.35)"] } : {}}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
            className="mt-4 w-full py-3 text-white text-xs font-black uppercase tracking-widest rounded-lg"
            style={{ background: `linear-gradient(135deg, ${C.red} 0%, ${C.redDeep} 100%)` }}
          >
            Generate content ⚡
          </motion.button>

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
   PHASE 2 — DISTRIBUTION GRID
───────────────────────────────────────────────────────────────────── */

const DISTRIBUTIONS: {
  id: string;
  name: string;
  iconBg: string;
  icon: React.ReactNode;
  body: string;
  ctaLabel: string;
  ctaBg: string;
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
    body: "We hard-coded a blocklist that strips 'delve', 'tapestry', 'vibrant' before they hit your feed. Generic AI smell is the #1 reason posts flop on X. Ship the diff, not the marketing copy. (1 / 6)",
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
    body: "Generic AI drafts are a liability for technical founders. I spent two weeks fixing 'seamless' and 'vibrant' in every post before realizing the engine itself needed structural constraints. So we built one.",
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
    body: "Just dropped a fix for the content engine. Hard-coded blocklist removes 'delve' / 'unlock' / 'tapestry' from every draft. No more generic LinkedIn fluff. Pick a persona and let me know if it lands.",
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
    body: "Subject: The IDE wars returned while we were sleeping. The era of tab-to-autocomplete ended without a funeral. If you're still relying on Copilot to suggest the next line, you're already behind…",
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
    body: "#engineering — heads up: shipped the rate-limiting fix to prod. Edge enforcement landed in three prompts via Claude Code. Next: I'll write up the full RAG-for-code post. Threads welcome.",
    ctaLabel: "Send to Slack",
    ctaBg: "#4A154B",
  },
];

function DistributionPhase({ distElapsed }: { distElapsed: number }) {
  return (
    <div className="flex" style={{ background: C.bg, minHeight: 560 }}>
      <Sidebar active="Generation History" />

      <div className="flex-1 p-5 md:p-7">
        <div className="flex items-center justify-between mb-1">
          <button
            className="text-[10px] md:text-xs font-bold inline-flex items-center gap-1.5"
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

        <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tight mt-2 mb-4" style={{ color: C.text }}>
          Distribution grid
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {DISTRIBUTIONS.map((d, i) => {
            const visible = distElapsed > i * 280;
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 16 }}
                animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <DistributionCard item={d} />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DistributionCard({ item }: { item: typeof DISTRIBUTIONS[number] }) {
  return (
    <div className="rounded-xl p-3 flex flex-col" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md" style={{ background: item.iconBg }}>
            {item.icon}
          </span>
          <p className="text-[11px] font-black italic uppercase tracking-tight" style={{ color: C.text }}>
            {item.name}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ActionPill label="Edit" />
          <ActionPill label="Copy" />
        </div>
      </div>

      <div className="flex-1 rounded-lg p-3 mb-2.5" style={{ background: C.cardWhite }}>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1.5" style={{ color: "#475569" }}>
          Campaign summary
        </p>
        <p className="text-[11.5px] leading-relaxed line-clamp-5" style={{ color: C.ink }}>
          {item.body}
        </p>
      </div>

      <button
        className="w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white inline-flex items-center justify-center gap-1.5"
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
      style={{ background: C.inner, color: C.muted, border: `1px solid ${C.border}` }}
    >
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   PHASE 3 — LONG-FORM
───────────────────────────────────────────────────────────────────── */

function LongFormPhase() {
  return (
    <div className="p-5 md:p-7" style={{ background: C.bg, minHeight: 560 }}>
      <button className="text-[10px] md:text-xs font-bold inline-flex items-center gap-1.5" style={{ color: C.muted }}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      <div className="flex items-center gap-3 mt-3 mb-1">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "rgba(232,50,10,0.12)" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={C.red} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="13" y2="17" />
          </svg>
        </span>
        <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tight" style={{ color: C.text }}>
          Long-form content
        </h3>
      </div>
      <p className="text-xs mb-4" style={{ color: C.muted }}>
        Generate articles and structured technical briefs for your audience
      </p>

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

      <div className="rounded-xl p-4 md:p-5 mb-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-base md:text-lg font-black leading-snug" style={{ color: C.text }}>
              Beyond the Template: Why Technical Teams are Migrating to the Ozigi Distillery Workflow
            </h4>
            <p className="text-[11px] md:text-xs mt-2 leading-relaxed" style={{ color: C.muted }}>
              How to replace rigid marketing AI suites with a high-signal, developer-first content pipeline that turns raw engineering data into authentic technical content.
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
              style={{ background: C.inner, color: C.muted, border: `1px solid ${C.border}` }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <ArticleSection
        title="Introduction: The Engineering Content Crisis"
        wordCount="140 words"
        body="For senior engineers and technical founders, the current state of AI content generation is a source of profound friction. Tools like Jasper and Copy.ai were built for marketing departments, emphasizing rigid 'templates' and 'brand voices' that fail to capture the nuance of a complex pull request or an architectural brain dump."
      />
      <ArticleSection
        title="1. The Template Trap vs. The Distillery Workflow"
        wordCount="265 words"
        body="Traditional AI suites rely on a 'Template' UX. To generate a blog post, a user must navigate a library of 50+ templates, select one, and manually fill out form fields. Ozigi's 'Distillery' workflow inverts this — instead of starting with a structure, you start with raw ingestion."
        code={`{
  "source_type": "raw_transcript",
  "payload": "[00:01:23] Dev A: ...the legacy setup is friction…",
  "instruction": "Extract the shift and draft a deep-dive."
}`}
      />
    </div>
  );
}

function ArticleSection({ title, wordCount, body, code }: { title: string; wordCount: string; body: string; code?: string }) {
  return (
    <div className="rounded-xl p-4 md:p-5 mb-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h5 className="text-sm md:text-base font-bold" style={{ color: C.text }}>{title}</h5>
        <button
          className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md inline-flex items-center gap-1.5"
          style={{ background: C.inner, color: C.muted, border: `1px solid ${C.border}` }}
        >
          Copy
        </button>
      </div>
      <p className="text-[11.5px] md:text-xs leading-relaxed" style={{ color: C.muted }}>{body}</p>
      {code && (
        <pre
          className="mt-3 rounded-lg p-3 text-[10px] md:text-[11px] leading-snug font-mono overflow-x-auto"
          style={{ background: "#0A1628", border: "1px solid rgba(255,255,255,0.06)", color: "#a5f3fc" }}
        >
          <span style={{ color: "#64748B" }}>JSON</span>{"\n"}{code}
        </pre>
      )}
      <p className="text-[10px] mt-3" style={{ color: C.dim }}>{wordCount}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────────────────── */

const NAV: { label: string; icon: React.ReactNode }[] = [
  {
    label: "Generation History",
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  },
  {
    label: "Scheduled Posts",
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  },
  {
    label: "Subscribers",
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>,
  },
  {
    label: "Personas",
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  },
  {
    label: "Persona Marketplace",
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9 5 3h14l2 6" /><path d="M3 9v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" /><path d="M3 9h18" /></svg>,
  },
  {
    label: "Blog Post",
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  },
  {
    label: "Settings & Integrations",
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33H15a1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  },
  {
    label: "Copilot Settings",
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 9 9l-7 1 5 5-1.5 7L12 19l5.5 3L16 15l5-5-7-1z" /></svg>,
  },
];

function Sidebar({ active }: { active: string }) {
  return (
    <aside
      className="hidden md:flex flex-col w-[200px] lg:w-[210px] shrink-0 p-4"
      style={{ background: C.sidebar, borderRight: `1px solid ${C.border}` }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: "rgba(232,50,10,0.14)" }}>
            <span className="text-[12px] font-black italic" style={{ color: C.red }}>O</span>
          </span>
          <span className="text-sm font-black italic uppercase tracking-tight" style={{ color: C.text }}>Ozigi</span>
        </div>
        <span style={{ color: C.dim }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </span>
      </div>

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

      <div className="mt-auto pt-4">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-2" style={{ color: C.dim }}>Your impact</p>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-md p-2 text-center" style={{ background: C.cardWhite }}>
            <p className="text-base font-black leading-none" style={{ color: C.ink }}>18</p>
            <p className="text-[8px] font-black uppercase tracking-widest mt-1" style={{ color: "#475569" }}>Campaigns</p>
          </div>
          <div className="rounded-md p-2 text-center" style={{ background: C.cardWhite }}>
            <p className="text-base font-black leading-none" style={{ color: C.ink }}>2</p>
            <p className="text-[8px] font-black uppercase tracking-widest mt-1" style={{ color: "#475569" }}>Scheduled</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

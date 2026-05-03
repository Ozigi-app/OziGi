"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  motion,
  Variants,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
  useMotionTemplate,
} from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Hero from "../components/Hero";
import AuthModal from "../components/AuthModal";
import PricingCards from "../components/PricingCards";
import BeforeAfterSlider from "../components/BeforeAfterSlider";
import { LandingDemoWidget } from "../components/LandingDemoWidget";
import SocialProof from "../components/SocialProof";
import { supabase } from "@/lib/supabase/client";

/* ─── Palette — brand navy base ───────────────────────────────────────── */
const C = {
  navy:     "#0A1628",   // brand navy base
  navyDeep: "#071020",   // 1 shade darker — section contrast
  navyMid:  "#0d1e35",   // 1 shade lighter — alternate surface
  card:     "#0f2038",   // card surface
  cardB:    "#102240",   // blue-tinted card
  cardS:    "#111d30",   // slate-tinted card
  cardR:    "#200d0a",   // red-tinted card
  cardG:    "#0a1e16",   // green-tinted card (subtle)
  border:   "rgba(255,255,255,0.08)",
  borderHi: "rgba(255,255,255,0.15)",
  white:    "#ffffff",
  muted:    "rgba(148,163,184,0.9)",
  dim:      "rgba(100,116,139,0.75)",
  red:      "#E8320A",
  redSoft:  "rgba(232,50,10,0.18)",
  redGlow:  "rgba(232,50,10,0.28)",
};

/* ─── Reusable SVG patterns ───────────────────────────────────────────── */
function DiagLines({ id, opacity = 0.04 }: { id: string; opacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ opacity }}>
      <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={id} width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
            <line x1="0" y1="0" x2="0" y2="32" stroke="white" strokeWidth="0.7" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

function DotGrid({ id, opacity = 0.055 }: { id: string; opacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ opacity }}>
      <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="11" cy="11" r="0.85" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

function CrossGrid({ id, opacity = 0.035 }: { id: string; opacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ opacity }}>
      <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
            <line x1="0" y1="10" x2="20" y2="10" stroke="white" strokeWidth="0.45" />
            <line x1="10" y1="0" x2="10" y2="20" stroke="white" strokeWidth="0.45" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

/* ─── Animation presets ───────────────────────────────────────────────── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 44 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};
const springUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 72, damping: 16 } },
};
const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.09 } },
};
const staggerFast: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

/* ─── Magnetic button ─────────────────────────────────────────────────── */
function MagneticBtn({ onClick, children, variant = "red" }: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "red" | "ghost";
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 320, damping: 22 });
  const sy = useSpring(my, { stiffness: 320, damping: 22 });
  return (
    <motion.button
      style={{
        x: sx, y: sy,
        ...(variant === "red"
          ? { background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)`, boxShadow: `0 8px 32px ${C.redGlow}` }
          : { background: "rgba(255,255,255,0.08)", border: `1px solid ${C.borderHi}` }),
      }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left - r.width / 2) * 0.35);
        my.set((e.clientY - r.top - r.height / 2) * 0.35);
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      onClick={onClick}
      whileHover={variant === "red"
        ? { boxShadow: "0 14px 52px rgba(232,50,10,0.5)" } as any
        : { background: "rgba(255,255,255,0.14)" } as any}
      className="px-7 py-3.5 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-colors duration-300 active:scale-95 cursor-pointer"
    >
      {children}
    </motion.button>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */
export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  /* Cursor spotlight */
  const heroRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const spotlight = useMotionTemplate`radial-gradient(600px at ${mouseX}px ${mouseY}px, rgba(232,50,10,0.08), transparent 75%)`;

  /* Parallax on hero headline */
  const { scrollY } = useScroll();
  const heroParallaxY = useTransform(scrollY, [0, 500], [0, -50]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="font-sans text-white min-h-[100dvh] flex flex-col" style={{ background: C.navy }}>
      <Header session={session} onSignIn={() => setIsAuthModalOpen(true)} />
      <main className="flex-1">

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* HERO — split: headline left · demo right                        */}
        {/* ────────────────────────���────────────────────────────────────── */}
        <section
          ref={heroRef}
          className="relative overflow-hidden min-h-[100dvh] flex items-center"
          style={{ background: `linear-gradient(160deg, ${C.navyDeep} 0%, ${C.navy} 55%, ${C.navyMid} 100%)` }}
          onMouseMove={(e) => {
            const r = heroRef.current?.getBoundingClientRect();
            if (r) { mouseX.set(e.clientX - r.left); mouseY.set(e.clientY - r.top); }
          }}
        >
          {/* Cursor spotlight */}
          <motion.div className="absolute inset-0 pointer-events-none z-0" style={{ background: spotlight }} />

          {/* Diagonal line pattern */}
          <DiagLines id="hero-diag" opacity={0.038} />

          {/* Red glow — top right */}
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${C.redSoft} 0%, transparent 65%)` }}>
            <div className="w-full h-full animate-glow-drift" />
          </div>
          {/* Red glow — bottom left */}
          <div className="absolute -bottom-24 -left-16 w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, rgba(232,50,10,0.1) 0%, transparent 70%)` }}>
            <div className="w-full h-full animate-glow-drift-slow" />
          </div>

          {/* Thin top gradient line */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${C.red}50, transparent)` }} />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-24 flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

            {/* ── Left col: headline ──────────────────────────────────── */}
            <div className="flex-1 max-w-xl">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="mb-8"
              >
                <span className="inline-flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.22em] px-5 py-2.5 rounded-full"
                  style={{ background: C.redSoft, border: `1px solid rgba(232,50,10,0.3)`, color: C.red }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.red }} />
                  Live demo — no sign-up required
                </span>
              </motion.div>

              {/* Headline — spring word animation + parallax */}
              <motion.div style={{ y: heroParallaxY }}>
                <motion.h1
                  initial="hidden"
                  animate="visible"
                  variants={staggerFast}
                  className="font-black italic uppercase tracking-tighter text-white leading-[0.93] mb-7"
                  style={{ fontSize: "clamp(2.6rem, 5vw, 4.75rem)" }}
                >
                  {["Content", "that sounds", "like"].map((line, i) => (
                    <motion.span key={i} variants={springUp} className="block">{line}</motion.span>
                  ))}
                  <motion.span variants={springUp} className="block">
                    <span
                      className="animate-gradient-x bg-clip-text text-transparent bg-[length:220%_100%]"
                      style={{ backgroundImage: `linear-gradient(90deg, ${C.red}, #ff7b3d, ${C.red})` }}
                    >a person</span>
                  </motion.span>
                  <motion.span variants={springUp} className="block">wrote it.</motion.span>
                </motion.h1>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.38 }}
                className="text-base md:text-lg font-medium leading-relaxed mb-8 max-w-md"
                style={{ color: C.muted }}
              >
                Paste a URL, drop some notes, or type a rough idea. Get a 3-day campaign
                for X, LinkedIn, Discord, and email. Done in 20 seconds.
              </motion.p>

              {/* Ghost CTAs (secondary — demo is the primary CTA) */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="flex flex-wrap items-center gap-3 mb-10"
              >
                <MagneticBtn variant="red" onClick={() => setIsAuthModalOpen(true)}>
                  Get started free →
                </MagneticBtn>
                <MagneticBtn variant="ghost" onClick={() => setIsAuthModalOpen(true)}>
                  Sign in
                </MagneticBtn>
              </motion.div>

              {/* Launch badges — horizontal scroll */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.65 }}
                className="w-full overflow-x-auto scrollbar-hide"
              >
                <div className="flex items-center gap-6 pb-2 w-fit">
                  <a href="https://www.betterlaunch.co" target="_blank" rel="noopener noreferrer"
                    className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0"
                    aria-label="Featured on Better Launch">
                    <img src="https://www.betterlaunch.co/badge.svg" alt="Featured on Better Launch" width={140} height={32} className="h-7 w-auto" />
                  </a>
                  <a href="https://www.scrolllaunch.com/products/ozigi?utm_source=badge&utm_medium=embed&utm_campaign=ozigi&ref=scrolllaunch"
                    target="_blank" rel="noopener noreferrer"
                    className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0">
                    <img src="https://www.scrolllaunch.com/api/badge/ozigi" alt="Featured on ScrollLaunch" width={220} height={48} loading="lazy" className="h-7 w-auto" />
                  </a>
                  <a href="https://uno.directory" target="_blank" rel="noopener"
                    className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0"
                    aria-label="Listed on Uno Directory">
                    <img src="https://uno.directory/uno-directory.svg" alt="Listed on Uno Directory" width={120} height={30} className="h-7 w-auto" />
                  </a>
                  <a href="https://wired.business" target="_blank" rel="noopener"
                    className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0"
                    aria-label="Featured on Wired Business">
                    <img src="https://wired.business/badge1-white.svg" alt="Featured on Wired Business" width={200} height={54} className="h-7 w-auto" />
                  </a>
                  <a href="https://www.superlaun.ch/products/2365" target="_blank" rel="noopener"
                    className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0"
                    aria-label="Featured on Super Launch">
                    <img src="https://www.superlaun.ch/badge.png" alt="Featured on Super Launch" width={140} height={32} className="h-7 w-auto" />
                  </a>
                  <a href="https://goodaitools.com/ai/ozigi-app" target="_blank" rel="noopener"
                    className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0"
                    aria-label="Featured on Good AI Tools">
                    <img src="https://goodaitools.com/assets/images/badge-dark.png" alt="Badge" height={54} className="h-7 w-auto" />
                  </a>
                  <a href="https://www.sideprojectors.com/project/79347/ozigi-ai-content-generator-that-sounds-human" target="_blank" rel="noopener"
                    className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0"
                    aria-label="Check out Ozigi on SideProjectors">
                    <img src="https://www.sideprojectors.com/img/badges/badge_show_black.png" alt="Check out Ozigi — AI Content Generator That Sounds Human at @SideProjectors" className="h-7 w-auto" />
                  </a>
                  <a href="https://navs.site" target="_blank" rel="noopener"
                    className="opacity-30 hover:opacity-70 transition-opacity duration-300 text-sm px-3 py-1 rounded-md border border-current flex-shrink-0"
                    title="AI Sites | 2026">
                    AI Nav Site
                  </a>
                </div>
              </motion.div>
            </div>

            {/* ── Right col: demo widget ─��────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.75, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 w-full max-w-lg lg:max-w-none"
            >
              {/* Outer accent frame */}
              <div className="relative">
                {/* Top-left corner accent lines */}
                <div className="absolute -top-3 -left-3 w-10 h-10 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(to right, ${C.red}, transparent)` }} />
                  <div className="absolute top-0 left-0 h-full w-px" style={{ background: `linear-gradient(to bottom, ${C.red}, transparent)` }} />
                </div>
                {/* Bottom-right corner accent lines */}
                <div className="absolute -bottom-3 -right-3 w-10 h-10 pointer-events-none">
                  <div className="absolute bottom-0 right-0 w-full h-px" style={{ background: `linear-gradient(to left, ${C.red}, transparent)` }} />
                  <div className="absolute bottom-0 right-0 h-full w-px" style={{ background: `linear-gradient(to top, ${C.red}, transparent)` }} />
                </div>

                {/* Label above widget */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.red }} />
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.red }}>
                    Try it now — live demo
                  </span>
                </div>

                <LandingDemoWidget />

                {/* No account pill below */}
                <p className="text-center text-[10px] font-medium mt-3" style={{ color: C.dim }}>
                  No credit card · No account · Free to try
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* SOCIAL PROOF                                                    */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div style={{ background: C.navyDeep, borderTop: `1px solid ${C.border}` }}>
          <SocialProof />
        </div>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* OUTPUT SHOWCASE — fixed bg to match brand navy                  */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden" style={{ background: C.navy, borderTop: `1px solid ${C.border}` }}>
          <DotGrid id="output-dots" opacity={0.05} />
          <div className="relative z-10">
            <div className="pt-14 pb-2 px-8 md:px-14">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-1" style={{ color: C.dim }}>
                What it produces
              </p>
              <p className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter" style={{ color: C.white }}>
                Real outputs. Swipe to explore.
              </p>
            </div>
            <Hero />
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* HOW IT WORKS — dot pattern, 3-col cards                        */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 md:py-32"
          style={{ background: C.navyDeep, borderTop: `1px solid ${C.border}` }}>
          <CrossGrid id="hiw-cross" opacity={0.04} />
          {/* Red accent line top */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${C.red}40, transparent)` }} />

          <div className="relative z-10 max-w-6xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.1 }} variants={fadeUp}
              className="text-center mb-20">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>Process</p>
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-[0.95]">
                From chaos<br />to clarity
              </h2>
              <p className="text-base md:text-lg font-medium mt-5 max-w-md mx-auto" style={{ color: C.muted }}>
                Your voice. Your ideas. Zero AI aftertaste.
              </p>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.1 }} variants={stagger}
              className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  n: "01", bg: C.cardB,
                  title: "Feed raw material",
                  desc: "Paste a URL, meeting notes, or upload a PDF. No need to clean it up — Ozigi strips the noise and extracts what matters.",
                  tags: ["URLs", "PDFs", "Voice notes"],
                },
                {
                  n: "02", bg: C.card,
                  title: "Your voice applies",
                  desc: "Set your persona once. Technical depth, tone, pacing, banned AI phrases — locked in so every post sounds like you at your most articulate.",
                  tags: ["Persona", "Tone", "Banned lexicon"],
                },
                {
                  n: "03", bg: C.cardS,
                  title: "Ship everywhere",
                  desc: "Post to X, LinkedIn, Discord, email, or Slack. One click. Your audience gets content that sounds human — because it is.",
                  tags: ["X", "LinkedIn", "Discord", "Slack"],
                },
              ].map((step) => (
                <motion.div key={step.n} variants={springUp}
                  whileHover={{ y: -6, transition: { type: "spring", stiffness: 260, damping: 18 } }}
                  className="rounded-2xl p-7 flex flex-col relative overflow-hidden group shimmer-on-hover"
                  style={{ background: step.bg, border: `1px solid ${C.border}` }}>
                  {/* Watermark number */}
                  <span className="absolute right-3 bottom-0 text-[6.5rem] font-black leading-none select-none pointer-events-none"
                    style={{ color: "rgba(255,255,255,0.035)" }}>{step.n}</span>
                  {/* Hover top glow */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(to right, ${C.red}, transparent)` }} />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at top left, rgba(232,50,10,0.08), transparent 65%)` }} />
                  {/* Number badge */}
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs font-black mb-6 relative z-10"
                    style={{ background: C.redSoft, color: C.red }}>{step.n}</div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter mb-3 relative z-10 group-hover:text-brand-red transition-colors duration-300">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed mb-6 relative z-10" style={{ color: C.muted }}>{step.desc}</p>
                  <div className="flex flex-wrap gap-2 relative z-10">
                    {step.tags.map((t) => (
                      <span key={t} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded"
                        style={{ background: "rgba(255,255,255,0.05)", color: C.dim }}>{t}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STATS                                                           */}
        {/* ─────────────��───────────────────────────────────────────────── */}
        <section className="relative py-16 md:py-20"
          style={{ background: C.navy, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
          <div className="max-w-4xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={stagger}
              className="grid grid-cols-3 gap-6 text-center">
              {[
                { val: "20s",  label: "Campaign generated",  sub: "from URL or raw notes" },
                { val: "5",    label: "Publishing channels", sub: "X · LinkedIn · Discord · Email · Slack" },
                { val: "3",    label: "Days per campaign",   sub: "platform-native formats" },
              ].map((s, i) => (
                <motion.div key={i} variants={springUp}>
                  <p className="text-4xl md:text-6xl lg:text-7xl font-black italic uppercase tracking-tighter mb-2 animate-gradient-x bg-clip-text text-transparent bg-[length:220%_100%]"
                    style={{ backgroundImage: `linear-gradient(90deg, ${C.red}, #ff7b3d, ${C.red})` }}>
                    {s.val}
                  </p>
                  <p className="text-sm md:text-base font-bold mb-1">{s.label}</p>
                  <p className="text-[11px] font-medium" style={{ color: C.dim }}>{s.sub}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* HUMAN-IN-THE-LOOP — cross pattern                              */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 md:py-32"
          style={{ background: C.navyMid, borderTop: `1px solid ${C.border}` }}>
          <DiagLines id="hitl-diag" opacity={0.035} />
          {/* Glow */}
          <div className="absolute top-[-20%] right-[-5%] w-[520px] h-[520px] rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${C.redSoft} 0%, transparent 68%)` }}>
            <div className="w-full h-full animate-glow-drift" />
          </div>
          {/* Left stripe */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5"
            style={{ background: `linear-gradient(to bottom, transparent, ${C.red}, transparent)` }} />

          <div className="relative z-10 max-w-6xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}
              className="flex flex-col md:flex-row items-start md:items-center justify-between gap-12">
              <motion.div variants={fadeUp} className="max-w-xl space-y-5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: C.red }}>
                  Human-in-the-Loop
                </p>
                <h3 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95]">
                  AI does the<br />heavy lifting.<br />
                  <span style={{ color: C.muted }}>You add the<br />secret sauce.</span>
                </h3>
                <p className="text-base font-medium leading-relaxed max-w-md" style={{ color: C.muted }}>
                  Every post comes with an edit button. Add the insider detail, the specific story,
                  the personal take that only you can make. Publish when it feels authentically yours.
                </p>
              </motion.div>
              <motion.div variants={fadeUp}>
                <Link href="/docs#human-in-the-loop"
                  className="group flex-shrink-0 flex items-center gap-3 rounded-xl px-8 py-4 text-sm font-black uppercase tracking-widest text-white transition-all duration-300 active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)`, boxShadow: `0 8px 32px ${C.redGlow}` }}>
                  See how it works
                  <span className="group-hover:translate-x-1.5 transition-transform duration-200">→</span>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* THE MOAT                                                        */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="py-20 md:py-32 relative"
          style={{ background: C.navyDeep, borderTop: `1px solid ${C.border}` }}>
          <DotGrid id="moat-dots" opacity={0.045} />
          <div className="relative z-10 max-w-6xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.div variants={fadeUp} className="mb-14">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>The difference</p>
                <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-[0.95] max-w-2xl">
                  Human or chatbot?<br />
                  <span style={{ color: C.muted }}>Your audience can tell.</span>
                </h2>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-5">
                {/* Generic AI */}
                <motion.div variants={fadeUp}
                  whileHover={{ y: -6, transition: { type: "spring", stiffness: 260, damping: 18 } }}
                  className="rounded-2xl p-8 md:p-10 flex flex-col"
                  style={{ background: C.cardS, border: `1px solid ${C.border}` }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-6" style={{ color: C.dim }}>Standard AI Output</p>
                  <div className="flex-1 min-h-[13rem] rounded-xl flex items-center justify-center italic mb-6 p-6 text-center text-sm font-medium leading-relaxed"
                    style={{ background: "rgba(255,255,255,0.04)", color: C.dim, border: `1px solid ${C.border}` }}>
                    "Here are 5 key takeaways from this PDF about Scaling automation. Number 1 will shock you!
                    In conclusion, AI is changing the landscape of development for everyone..."
                  </div>
                  <span className="self-start text-[9px] font-black uppercase tracking-widest rounded px-3 py-1.5"
                    style={{ color: C.dim, border: `1px solid ${C.border}` }}>Sounds like a template</span>
                </motion.div>

                {/* Ozigi */}
                <motion.div variants={fadeUp}
                  whileHover={{ y: -6, transition: { type: "spring", stiffness: 260, damping: 18 } }}
                  className="rounded-2xl p-8 md:p-10 flex flex-col relative overflow-hidden"
                  style={{ background: C.cardR, border: `1px solid rgba(232,50,10,0.2)` }}>
                  <div className="absolute top-0 right-0 w-1 h-full"
                    style={{ background: `linear-gradient(to bottom, transparent, ${C.red}50, transparent)` }} />
                  <p className="text-[10px] font-black uppercase tracking-widest mb-6" style={{ color: C.red }}>The Ozigi Engine</p>
                  <div className="flex-1 min-h-[13rem] rounded-xl flex flex-col md:flex-row items-stretch mb-6 overflow-hidden text-sm font-medium"
                    style={{ border: `1px solid ${C.border}` }}>
                    <div className="flex-1 p-5 flex items-center justify-center text-center italic text-xs"
                      style={{ background: "rgba(255,255,255,0.04)", color: C.dim, borderRight: `1px solid ${C.border}` }}>
                      [ Structured thread with your actual insights, pacing, and tone. No templates. ]
                    </div>
                    <div className="flex-1 p-5 flex items-start pt-6 text-sm leading-relaxed"
                      style={{ background: "rgba(255,255,255,0.06)", color: C.white }}>
                      Scaling automation requires treating test code like production code. Poor architecture
                      sinks suites faster than flaky environments.
                    </div>
                  </div>
                  <span className="self-start text-[9px] font-black uppercase tracking-widest rounded px-3 py-1.5"
                    style={{ color: C.red, border: `1px solid rgba(232,50,10,0.3)` }}>Sounds like a real person</span>
                </motion.div>
              </div>

              <motion.div variants={fadeUp} className="mt-14">
                <p className="text-[9px] uppercase font-black tracking-widest mb-5" style={{ color: C.dim }}>
                  Try it yourself — drag to reveal
                </p>
                <BeforeAfterSlider />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* USE CASES — diagonal lines, 2×2 varied dark tints               */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 md:py-32"
          style={{ background: C.navy, borderTop: `1px solid ${C.border}` }}>
          <DiagLines id="uc-diag" opacity={0.04} />
          <div className="relative z-10 max-w-6xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.1 }} variants={fadeUp}
              className="text-center mb-16">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>Use cases</p>
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-[0.95]">
                Works for your world
              </h2>
              <p className="text-base md:text-lg font-medium mt-5 max-w-md mx-auto" style={{ color: C.muted }}>
                Every audience can tell when content sounds fake. Yours won't.
              </p>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.05 }} variants={stagger}
              className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { n: "01", bg: C.cardB, title: "Developers & DevRel",
                  desc: "Turn messy API docs or release notes into X threads and LinkedIn posts that read like a real engineer — not a marketing bot.", ch: "X · LinkedIn" },
                { n: "02", bg: C.cardG, title: "Founders & Leaders",
                  desc: "Rough notes from a fundraising call → thought leadership posts that sound like you at your most articulate, not outsourced to a chatbot.", ch: "LinkedIn · Email" },
                { n: "03", bg: C.cardS, title: "Educators & Trainers",
                  desc: "Upload your course slides or workshop deck. Ozigi builds a multi-week campaign that reads like you — not a lesson plan on autopilot.", ch: "Email · Discord" },
                { n: "04", bg: C.cardR, title: "Creators & Writers",
                  desc: "Drop a podcast, video, or newsletter. Ozigi extracts the ideas and generates hooks in your voice — the kind your audience recognises as yours.", ch: "All platforms" },
              ].map((uc) => (
                <motion.div key={uc.n} variants={springUp}
                  whileHover={{ y: -6, transition: { type: "spring", stiffness: 260, damping: 18 } }}
                  className="rounded-2xl p-8 flex flex-col justify-between min-h-[220px] group relative overflow-hidden shimmer-on-hover"
                  style={{ background: uc.bg, border: `1px solid ${C.border}` }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(to right, ${C.red}, transparent)` }} />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at top right, rgba(232,50,10,0.08), transparent 65%)` }} />
                  <div className="relative z-10">
                    <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: C.red }}>{uc.n}</p>
                    <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter mb-3">{uc.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{uc.desc}</p>
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest mt-8 relative z-10" style={{ color: C.dim }}>{uc.ch}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* FEATURES — dot pattern, 4-col varied tints                     */}
        {/* ─────────────────────────────────────────────────────��───────── */}
        <section className="relative overflow-hidden py-20 md:py-28"
          style={{ background: C.navyDeep, borderTop: `1px solid ${C.border}` }}>
          <DotGrid id="feat-dots" opacity={0.05} />
          <div className="relative z-10 max-w-6xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={fadeUp}
              className="text-center mb-14">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>What's inside</p>
              <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95]">
                Everything built<br />to sound human
              </h2>
              <p className="text-base font-medium mt-5 max-w-md mx-auto" style={{ color: C.muted }}>
                Four core capabilities. All in one clean flow.
              </p>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { bg: C.cardB, title: "Messy input welcome",
                  desc: "URLs, PDFs, voice notes, scattered thoughts — Ozigi finds the signal.", tag: "Any format →" },
                { bg: C.cardG, title: "Your voice, locked in",
                  desc: "Persona, tone, depth, banned phrases — enforced on every post, every time.", tag: "Set once →" },
                { bg: C.card,  title: "Instant publishing",
                  desc: "Ship to X, LinkedIn, Discord, email, and Slack in seconds. No copy-pasting.", tag: "5 platforms →" },
                { bg: C.cardR, title: "Bypasses AI detection",
                  desc: "Ozigi's Banned Lexicon strips the exact patterns LinkedIn's 360Brew system flags.", tag: "Banned Lexicon →" },
              ].map((f, i) => (
                <motion.div key={i} variants={springUp}
                  whileHover={{ y: -6, transition: { type: "spring", stiffness: 280, damping: 18 } }}
                  className="rounded-2xl p-6 flex flex-col justify-between min-h-[220px] group relative overflow-hidden"
                  style={{ background: f.bg, border: `1px solid ${C.border}` }}>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-all duration-500"
                    style={{ background: `linear-gradient(to right, ${C.red}, transparent)` }} />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at bottom right, rgba(232,50,10,0.08), transparent 70%)` }} />
                  <div className="relative z-10">
                    <h3 className="text-base font-black uppercase tracking-tighter mb-3">{f.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{f.desc}</p>
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest mt-6 relative z-10" style={{ color: C.red }}>{f.tag}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* PRICING                                                         */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section id="pricing" className="relative overflow-hidden py-20 md:py-32 scroll-mt-32"
          style={{ background: C.navy, borderTop: `1px solid ${C.border}` }}>
          <CrossGrid id="pricing-cross" opacity={0.035} />
          <div className="relative z-10 max-w-6xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={fadeUp}
              className="text-center mb-14">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>Pricing</p>
              <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95]">
                No surprises.<br />
                <span style={{ color: C.muted }}>No AI voice.</span><br />
                Just results.
              </h2>
              <p className="text-base font-medium mt-5" style={{ color: C.muted }}>
                Try free forever. Scale when you ship.
              </p>
            </motion.div>
            <PricingCards onOpenAuthModal={() => setIsAuthModalOpen(true)} />
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* BOTTOM CTA CARD — like Nchiko's closing                        */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="py-16 md:py-24 px-6"
          style={{ background: C.navyDeep, borderTop: `1px solid ${C.border}` }}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp}
            className="max-w-3xl mx-auto rounded-3xl p-12 md:p-20 text-center relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, #1f0d0a 0%, ${C.navyMid} 55%, ${C.card} 100%)`,
              border: `1px solid rgba(232,50,10,0.2)`,
              boxShadow: `0 0 80px rgba(232,50,10,0.09), 0 0 0 1px rgba(255,255,255,0.04)`,
            }}>
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none rounded-3xl"
              style={{ background: `radial-gradient(ellipse at 50% 0%, rgba(232,50,10,0.14), transparent 65%)` }} />
            {/* Diagonal lines inside card */}
            <DiagLines id="cta-diag" opacity={0.04} />

            <div className="relative z-10">
              {/* Logo */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)` }}>
                <img src="/logo.png" alt="Ozigi" className="h-9 w-auto" />
              </div>

              <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter mb-4">
                Stop sounding like AI.
              </h2>
              <p className="text-base font-medium mb-8 max-w-sm mx-auto leading-relaxed" style={{ color: C.muted }}>
                Join creators and builders who ship content in their voice — not AI's.
              </p>
              <motion.button
                onClick={() => setIsAuthModalOpen(true)}
                whileHover={{ boxShadow: "0 18px 56px rgba(232,50,10,0.55)" }}
                className="inline-flex items-center gap-3 rounded-xl px-10 py-4 text-sm font-black uppercase tracking-widest text-white transition-all duration-300 active:scale-95 cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)`,
                  boxShadow: `0 8px 32px ${C.redGlow}`,
                }}>
                Get started — it's free
              </motion.button>
              <p className="text-xs font-medium mt-4" style={{ color: C.dim }}>No credit card required.</p>
            </div>
          </motion.div>
        </section>
      </main>

      <Footer />
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
    </div>
  );
}

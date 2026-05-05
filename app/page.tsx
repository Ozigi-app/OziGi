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
import PeerlistReviews from "../components/PeerlistReviews";
import { supabase } from "@/lib/supabase/client";

/* ─── Palette — light slate base with brand navy + red ────────────────── */
const C = {
  navy:     "#F8FAFC",   // bg — light slate-50 (very airy)
  navyDeep: "#F1F5F9",   // slate-100 — section contrast
  navyMid:  "#FFFFFF",   // pure white — lighter alt surface
  card:     "#FFFFFF",   // pure white cards
  cardB:    "#F0F7FF",   // blue-tinted card
  cardS:    "#F8FAFC",   // slate-tinted card
  cardR:    "#FFF5F3",   // red-tinted card
  cardG:    "#F0FDF4",   // green-tinted card
  border:   "rgba(15,23,42,0.08)",   // navy/8 — subtle on light
  borderHi: "rgba(15,23,42,0.15)",   // navy/15
  white:    "#0A1628",   // text — brand navy (inverted role)
  muted:    "rgba(51,65,85,0.85)",   // slate-700/85 — muted text
  dim:      "rgba(100,116,139,0.75)",// slate-500 — dim text
  red:      "#E8320A",
  redSoft:  "rgba(232,50,10,0.10)",
  redGlow:  "rgba(232,50,10,0.20)",
};

/* ─── Reusable SVG patterns ───────────────────────────────────────────── */
function DiagLines({ id, opacity = 0.06 }: { id: string; opacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ opacity }}>
      <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={id} width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
            <line x1="0" y1="0" x2="0" y2="32" stroke="#0A1628" strokeWidth="0.7" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

function DotGrid({ id, opacity = 0.08 }: { id: string; opacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ opacity }}>
      <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="11" cy="11" r="0.85" fill="#0A1628" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

function CrossGrid({ id, opacity = 0.05 }: { id: string; opacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ opacity }}>
      <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
            <line x1="0" y1="10" x2="20" y2="10" stroke="#0A1628" strokeWidth="0.45" />
            <line x1="10" y1="0" x2="10" y2="20" stroke="#0A1628" strokeWidth="0.45" />
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
          ? { background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)`, boxShadow: `0 8px 32px ${C.redGlow}`, color: "#FFFFFF" }
          : { background: "rgba(15,23,42,0.06)", border: `1px solid ${C.borderHi}`, color: C.white }),
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
        : { background: "rgba(15,23,42,0.08)" } as any}
      className="px-7 py-3.5 rounded-xl text-sm font-black uppercase tracking-widest text-inherit transition-colors duration-300 active:scale-95 cursor-pointer"
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
    <div className="font-sans min-h-[100dvh] flex flex-col" style={{ background: C.navy, color: C.white }}>
      <Header session={session} onSignIn={() => setIsAuthModalOpen(true)} />
      <main className="flex-1">

        {/* ──────────────────────────────────────────────────────����������──────── */}
        {/* HERO — split: headline left · demo right                        */}
        {/* ────────────────────────����────────────────────────────────────── */}
        <section
          ref={heroRef}
          className="relative overflow-hidden min-h-[100dvh] flex items-center"
          style={{ background: `linear-gradient(160deg, ${C.navyDeep} 0%, ${C.navy} 55%, ${C.navyMid} 100%)`, color: C.white }}
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

          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-24 flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20">

            {/* ── Left col: headline + CTAs ───────────────────────────── */}
            <div className="flex-1 max-w-xl">
              {/* Headline */}
              <motion.div style={{ y: heroParallaxY }}>
              <motion.h1
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="text-5xl md:text-7xl lg:text-[5.5rem] font-black italic uppercase tracking-tighter leading-[0.92] mb-5"
              >
                Automate Content<br />
                <span className="relative inline-block">
                  Creation
                  <motion.span
                    className="absolute left-0 -bottom-0.5 h-1 rounded-full origin-left"
                    style={{ background: C.red }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5, delay: 0.55, ease: "easeOut" }}
                  />
                </span>{" "}
                <span style={{ color: C.red }}>Without ChatGPT&apos;s Voice.</span>
              </motion.h1>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.38 }}
                className="text-base md:text-lg font-medium leading-relaxed mb-8 max-w-md"
                style={{ color: C.muted }}
              >
                Blog posts, newsletters, LinkedIn, X threads — in your voice, not AI&apos;s.
              </motion.p>

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
                  <a href="https://peerlist.io/dumebi/project/ai-content-generator-that-sounds-human"
                    target="_blank" rel="noopener noreferrer"
                    className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0"
                    aria-label="Featured on Peerlist">
                    <img
                      src="https://peerlist.io/api/v1/projects/embed/PRJHBARJ6AKQ7AG6MFPMRJPBREPQBN?showUpvote=false&theme=light"
                      alt="AI Content Generator That Sounds Human on Peerlist"
                      className="h-7 w-auto"
                    />
                  </a>
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
                  <a href="https://startupfa.me/s/ozigi?utm_source=ozigi.app" target="_blank"><img src="https://startupfa.me/badges/featured-badge-small.webp" alt="Ozigi - Featured on Startup Fame" width="224" height="36" />
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
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>How it works</p>
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-[0.95]">
                Input. Generate.<br />Publish.
              </h2>
              <p className="text-base md:text-lg font-medium mt-5 max-w-md mx-auto" style={{ color: C.muted }}>
                Blog posts, newsletters, social content — all from one workflow.
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
                  title: "Pick your format",
                  desc: "Blog post, email newsletter, LinkedIn carousel, X thread, or technical brief. Your voice applies to every format automatically.",
                  tags: ["Blog", "Newsletter", "Social", "Briefs"],
                },
                {
                  n: "03", bg: C.cardS,
                  title: "Publish or send",
                  desc: "Post directly to X and LinkedIn, send newsletters to your list, or export for your CMS. One workflow for everything.",
                  tags: ["Direct post", "Email send", "Export"],
                },
              ].map((step) => (
                <motion.div key={step.n} variants={springUp}
                  whileHover={{ y: -6, transition: { type: "spring", stiffness: 260, damping: 18 } }}
                  className="rounded-2xl p-7 flex flex-col relative overflow-hidden group shimmer-on-hover"
                  style={{ background: step.bg, border: `1px solid ${C.border}` }}>
                  {/* Watermark number */}
                  <span className="absolute right-3 bottom-0 text-[6.5rem] font-black leading-none select-none pointer-events-none"
                    style={{ color: "rgba(15,23,42,0.04)" }}>{step.n}</span>
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
                        style={{ background: "rgba(15,23,42,0.05)", color: C.dim }}>{t}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
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
        {/* PEERLIST REVIEWS — real user feedback on output quality         */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div style={{ background: C.navyDeep, borderTop: `1px solid ${C.border}` }}>
          <PeerlistReviews />
        </div>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STATS                                                           */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="relative py-16 md:py-20"
          style={{ background: C.navy, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
          <div className="max-w-4xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={stagger}
              className="grid grid-cols-3 gap-6 text-center">
              {[
                { val: "6",    label: "Content formats",     sub: "Blog · Newsletter · LinkedIn · X · Discord · Briefs" },
                { val: "1-click", label: "Publish & send",   sub: "Direct to social or inbox" },
                { val: "0",    label: "AI fluff",            sub: "Banned lexicon enforced" },
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
                  AI drafts.<br />You refine.<br />
                  <span style={{ color: C.muted }}>Then publish<br />or send.</span>
                </h3>
                <p className="text-base font-medium leading-relaxed max-w-md" style={{ color: C.muted }}>
                  Every blog post, newsletter, and social post comes with an edit button. Add your insider detail,
                  your specific take — then publish to social or send to your subscribers.
                </p>
              </motion.div>
              <motion.div variants={fadeUp}>
                <Link href="/docs#human-in-the-loop"
                  className="group flex-shrink-0 flex items-center gap-3 rounded-xl px-8 py-4 text-sm font-black uppercase tracking-widest transition-all duration-300 active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)`, boxShadow: `0 8px 32px ${C.redGlow}`, color: "#FFFFFF" }}>
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
                  ChatGPT or you?<br />
                  <span style={{ color: C.muted }}>Readers know instantly.</span>
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
                    style={{ background: "rgba(15,23,42,0.04)", color: C.dim, border: `1px solid ${C.border}` }}>
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
                      style={{ background: "rgba(15,23,42,0.04)", color: C.dim, borderRight: `1px solid ${C.border}` }}>
                      [ Structured thread with your actual insights, pacing, and tone. No templates. ]
                    </div>
                    <div className="flex-1 p-5 flex items-start pt-6 text-sm leading-relaxed"
                      style={{ background: "rgba(15,23,42,0.06)", color: C.white }}>
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
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>What you can create</p>
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-[0.95]">
                Every format.<br />One voice.
              </h2>
              <p className="text-base md:text-lg font-medium mt-5 max-w-md mx-auto" style={{ color: C.muted }}>
                Newsletters, blog posts, social content, technical briefs — all sound like you.
              </p>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.05 }} variants={stagger}
              className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { n: "01", bg: C.cardB, title: "Weekly newsletters",
                  desc: "Generate and send email newsletters that sound like you wrote them. No templates, no AI voice. Connect your list and hit send.", ch: "Email newsletters" },
                { n: "02", bg: C.cardG, title: "Blog posts & briefs",
                  desc: "Turn rough notes or research into polished blog posts and technical briefs. SEO-ready, human-readable, zero editing needed.", ch: "Blog · Technical docs" },
                { n: "03", bg: C.cardS, title: "LinkedIn thought leadership",
                  desc: "Build authority with posts and carousels that sound like you at your most articulate — not like every other AI-generated post in the feed.", ch: "LinkedIn posts · Carousels" },
                { n: "04", bg: C.cardR, title: "X threads & engagement",
                  desc: "Create threads that hook, educate, and convert. Your voice, your pacing, your specific takes — the kind your audience recognises.", ch: "X threads · Tweets" },
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
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>Capabilities</p>
              <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95]">
                Write. Send. Publish.<br />All human.
              </h2>
              <p className="text-base font-medium mt-5 max-w-md mx-auto" style={{ color: C.muted }}>
                Blog posts, newsletters, social — generated and delivered from one place.
              </p>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { bg: C.cardB, title: "Blog & long-form",
                  desc: "Full blog posts and technical briefs from rough notes. SEO-ready, publish-ready.", tag: "Long-form →" },
                { bg: C.cardG, title: "Email newsletters",
                  desc: "Generate and send newsletters to your subscribers. Connect your list, hit send.", tag: "Newsletter →" },
                { bg: C.card,  title: "Social publishing",
                  desc: "Post directly to X and LinkedIn. Threads, carousels, single posts — one click.", tag: "Social →" },
                { bg: C.cardR, title: "Sounds human",
                  desc: "Banned Lexicon strips AI patterns. Your content reads like you wrote it.", tag: "No AI voice →" },
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
              <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95]" style={{ color: C.white }}>
                Blog posts.<br />
                Newsletters.<br />
                <span style={{ color: C.muted }}>Social. Briefs.</span>
              </h2>
              <p className="text-base font-medium mt-5" style={{ color: C.muted }}>
                All formats. All human. Start free.
              </p>
            </motion.div>
            <PricingCards onOpenAuthModal={() => setIsAuthModalOpen(true)} />
          </div>
        </section>

      </main>

      <Footer />
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
    </div>
  );
}

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
import AuthModal from "../components/AuthModal";
import DashboardPreview from "../components/DashboardPreview";
import SocialProof from "../components/SocialProof";
import PeerlistReviews from "../components/PeerlistReviews";
import NewsletterPopup from "../components/NewsletterPopup";
import { supabase } from "@/lib/supabase/client";

/* ─── Palette ────────────────────────────────────────────────────────────── */
const C = {
  navy:     "#F8FAFC",
  navyDeep: "#F1F5F9",
  navyMid:  "#FFFFFF",
  card:     "#FFFFFF",
  cardB:    "#F0F7FF",
  cardS:    "#F8FAFC",
  cardR:    "#FFF5F3",
  cardG:    "#F0FDF4",
  border:   "rgba(15,23,42,0.08)",
  borderHi: "rgba(15,23,42,0.15)",
  white:    "#0A1628",
  muted:    "rgba(51,65,85,0.85)",
  dim:      "rgba(100,116,139,0.75)",
  red:      "#E8320A",
  redSoft:  "rgba(232,50,10,0.10)",
  redGlow:  "rgba(232,50,10,0.20)",
};

/* ─── SVG patterns ───────────────────────────────────────────────────────── */
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

/* ─── Animation presets ──────────────────────────────────────────────────── */
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

/* ─── Magnetic button ────────────────────────────────────────────────────── */
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

/* ─── Fake outbound stat ticker ──────────────────────────────────────────── */
function StatTicker({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <span className="text-2xl font-black tabular-nums" style={{ color: color ?? C.white }}>{value}</span>
      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.dim }}>{label}</span>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [nlEmail, setNlEmail] = useState("");
  const [nlStatus, setNlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const heroRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const spotlight = useMotionTemplate`radial-gradient(600px at ${mouseX}px ${mouseY}px, rgba(232,50,10,0.08), transparent 75%)`;
  const { scrollY } = useScroll();
  const heroParallaxY = useTransform(scrollY, [0, 500], [0, -50]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  async function subscribeNewsletter(e: React.FormEvent) {
    e.preventDefault();
    if (!nlEmail) return;
    setNlStatus("loading");
    const res = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: nlEmail.trim().toLowerCase() }),
    });
    setNlStatus(res.ok ? "success" : "error");
  }

  return (
    <div style={{ background: C.navy, color: C.white }} className="min-h-[100dvh] flex flex-col">
      <Header session={session} onSignIn={() => setIsAuthModalOpen(true)} />
      <main className="flex-1">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section
          ref={heroRef}
          className="relative overflow-hidden min-h-[100dvh] flex items-center"
          style={{ background: `linear-gradient(160deg, ${C.navyDeep} 0%, ${C.navy} 55%, ${C.navyMid} 100%)`, color: C.white }}
          onMouseMove={(e) => {
            const r = heroRef.current?.getBoundingClientRect();
            if (r) { mouseX.set(e.clientX - r.left); mouseY.set(e.clientY - r.top); }
          }}
        >
          <motion.div className="absolute inset-0 pointer-events-none z-0" style={{ background: spotlight }} />
          <DiagLines id="hero-diag" opacity={0.038} />

          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${C.redSoft} 0%, transparent 65%)` }} />
          <div className="absolute -bottom-24 -left-16 w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, rgba(232,50,10,0.1) 0%, transparent 70%)` }} />
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${C.red}50, transparent)` }} />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-24 md:py-32">
            <div className="flex flex-col items-center text-center gap-8 max-w-5xl mx-auto">

              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                style={{ background: C.redSoft, color: C.red, border: `1px solid rgba(232,50,10,0.2)` }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.red }} />
                GTM Content Suite
              </motion.div>

              {/* Headline */}
              <motion.div style={{ y: heroParallaxY }}>
                <motion.h1
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="text-4xl sm:text-5xl md:text-[3.5rem] lg:text-[4rem] xl:text-[4.5rem] font-black italic uppercase tracking-tight leading-[1.02] text-balance"
                >
                  Find leads. Reach out.<br />
                  <span className="relative inline-block">
                    <span style={{ color: C.red }}>Stay top of mind.</span>
                    <motion.span
                      className="absolute left-0 -bottom-1 h-1 rounded-full origin-left"
                      style={{ background: C.red }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.6, delay: 0.7, ease: "easeOut" }}
                    />
                  </span>
                </motion.h1>
              </motion.div>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.3 }}
                className="text-base md:text-xl font-medium leading-relaxed max-w-2xl text-pretty"
                style={{ color: C.muted }}
              >
                Ozigi is the GTM engine for founders and small teams. Outbound email and LinkedIn sequences, lead scraping, and a full content engine — all in one place.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-wrap items-center justify-center gap-3"
              >
                <MagneticBtn variant="red" onClick={() => setIsAuthModalOpen(true)}>
                  Start your GTM engine →
                </MagneticBtn>
                <MagneticBtn variant="ghost" onClick={() => setIsAuthModalOpen(true)}>
                  Sign in
                </MagneticBtn>
              </motion.div>

              {/* Live stat tickers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.55 }}
                className="flex flex-wrap items-center justify-center gap-3 mt-2"
              >
                <StatTicker label="Leads sourced" value="12,400+" color={C.red} />
                <StatTicker label="Emails sent" value="38,000+" />
                <StatTicker label="Content pieces" value="94,000+" />
                <StatTicker label="Reply rate avg" value="8.4%" color="#16a34a" />
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-[10px] font-medium"
                style={{ color: C.dim }}
              >
                No credit card required · Free to start
              </motion.p>
            </div>

            {/* Demo video */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="w-full mt-10 max-w-5xl mx-auto"
            >
              <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: C.dim }}>
                See Ozigi in action
              </p>
              <div style={{ zoom: 0.82 }} className="w-full origin-top">
                <DashboardPreview />
              </div>
            </motion.div>

          </div>
        </section>

        {/* ── Launch badges strip ──────────────────────────────────────── */}
        <div className="w-full overflow-x-auto py-5 border-b"
          style={{ background: C.navyDeep, borderColor: C.border }}>
          <div className="flex items-center justify-center gap-6 px-6 w-fit mx-auto">
            <a href="https://peerlist.io/dumebi/project/ai-content-generator-that-sounds-human"
              target="_blank" rel="noopener noreferrer"
              className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0">
              <img src="https://peerlist.io/api/v1/projects/embed/PRJHBARJ6AKQ7AG6MFPMRJPBREPQBN?showUpvote=false&theme=light"
                alt="Featured on Peerlist" className="h-7 w-auto" />
            </a>
            <a href="https://theresanaiforthat.com/ai/ozigi/?ref=featured&v=10684552" target="_blank" rel="nofollow">
              <img width="300" src="https://media.theresanaiforthat.com/featured-on-taaft.png?width=600" alt="Featured on TAAFT" className="h-7 w-auto opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0" />
            </a>
            <a href="https://www.betterlaunch.co" target="_blank" rel="noopener noreferrer"
              className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0">
              <img src="https://www.betterlaunch.co/badge.svg" alt="Featured on Better Launch" width={140} height={32} className="h-7 w-auto" />
            </a>
            <a href="https://www.scrolllaunch.com/products/ozigi?utm_source=badge&utm_medium=embed&utm_campaign=ozigi&ref=scrolllaunch"
              target="_blank" rel="noopener noreferrer"
              className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0">
              <img src="https://www.scrolllaunch.com/api/badge/ozigi" alt="Featured on ScrollLaunch" width={220} height={48} loading="lazy" className="h-7 w-auto" />
            </a>
            <a href="https://startupfa.me/s/ozigi?utm_source=ozigi.app" target="_blank">
              <img src="https://startupfa.me/badges/featured-badge-small.webp" alt="Featured on Startup Fame" width="224" height="36" className="h-7 w-auto opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0" />
            </a>
            <a href="https://goodaitools.com/ai/ozigi-app" target="_blank" rel="noopener"
              className="opacity-30 hover:opacity-70 transition-opacity duration-300 grayscale hover:grayscale-0 flex-shrink-0">
              <img src="https://goodaitools.com/assets/images/badge-dark.png" alt="Badge" height={54} className="h-7 w-auto" />
            </a>
          </div>
        </div>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 md:py-32"
          style={{ background: C.navyDeep, borderTop: `1px solid ${C.border}` }}>
          <CrossGrid id="hiw-cross" opacity={0.04} />
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${C.red}40, transparent)` }} />

          <div className="relative z-10 max-w-6xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.1 }} variants={fadeUp}
              className="text-center mb-20">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>How it works</p>
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-[0.95]">
                Source. Reach out.<br />Convert.
              </h2>
              <p className="text-base md:text-lg font-medium mt-5 max-w-md mx-auto" style={{ color: C.muted }}>
                One GTM loop — from finding the right people to closing them.
              </p>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.1 }} variants={stagger}
              className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  n: "01", bg: C.cardB,
                  title: "Source leads",
                  desc: "Ozigi scrapes GitHub, Dev.to, and LinkedIn for leads that match your ICP. Gemini scores each one before they hit your pipeline.",
                  tags: ["GitHub", "Dev.to", "LinkedIn"],
                },
                {
                  n: "02", bg: C.card,
                  title: "Run outreach",
                  desc: "Launch personalised email + LinkedIn sequences. Each message is written by AI using the lead's actual profile — not a template.",
                  tags: ["Email sequences", "LinkedIn DMs", "Follow-ups"],
                },
                {
                  n: "03", bg: C.cardS,
                  title: "Stay top of mind",
                  desc: "Keep your pipeline warm with a content engine that publishes newsletters, social posts, and blogs in your voice on autopilot.",
                  tags: ["Newsletter", "Social", "Blog"],
                },
              ].map((step) => (
                <motion.div key={step.n} variants={springUp}
                  whileHover={{ y: -6, transition: { type: "spring", stiffness: 260, damping: 18 } }}
                  className="rounded-2xl p-7 flex flex-col relative overflow-hidden group shimmer-on-hover"
                  style={{ background: step.bg, border: `1px solid ${C.border}` }}>
                  <span className="absolute right-3 bottom-0 text-[6.5rem] font-black leading-none select-none pointer-events-none"
                    style={{ color: "rgba(15,23,42,0.04)" }}>{step.n}</span>
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(to right, ${C.red}, transparent)` }} />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at top left, rgba(232,50,10,0.08), transparent 65%)` }} />
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

        {/* ── SOCIAL PROOF ─────────────────────────────────────────────── */}
        <div style={{ background: C.navyDeep, borderTop: `1px solid ${C.border}` }}>
          <SocialProof />
        </div>

        {/* ── PILLARS — the two engines ─────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 md:py-32"
          style={{ background: C.navy, borderTop: `1px solid ${C.border}` }}>
          <DiagLines id="pillars-diag" opacity={0.04} />
          <div className="relative z-10 max-w-6xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.1 }} variants={fadeUp}
              className="text-center mb-16">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>The platform</p>
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-[0.95]">
                Two engines.<br />One pipeline.
              </h2>
              <p className="text-base md:text-lg font-medium mt-5 max-w-lg mx-auto" style={{ color: C.muted }}>
                Outbound growth and content generation work together. Reach cold leads while your content warms them up.
              </p>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.05 }} variants={stagger}
              className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              {/* Outbound Growth */}
              <motion.div variants={springUp}
                whileHover={{ y: -6, transition: { type: "spring", stiffness: 260, damping: 18 } }}
                className="rounded-2xl p-8 flex flex-col justify-between min-h-[280px] group relative overflow-hidden"
                style={{ background: C.cardB, border: `1px solid ${C.border}` }}>
                <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(to right, ${C.red}, transparent)` }} />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at top right, rgba(232,50,10,0.08), transparent 65%)` }} />
                <div className="relative z-10">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: C.red }}>01 — Outbound Growth</p>
                  <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter mb-4">
                    Find leads.<br />Run sequences.
                  </h3>
                  <p className="text-sm leading-relaxed mb-6" style={{ color: C.muted }}>
                    Scrape GitHub, Dev.to, and LinkedIn for ICP-matched leads. Launch personalised email and LinkedIn sequences automatically. Track opens, replies, and bounces.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 relative z-10">
                  {["Lead scraping", "Email sequences", "LinkedIn DMs", "CRM sync", "Reply detection"].map(t => (
                    <span key={t} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded"
                      style={{ background: "rgba(15,23,42,0.05)", color: C.dim }}>{t}</span>
                  ))}
                </div>
              </motion.div>

              {/* Content Engine */}
              <motion.div variants={springUp}
                whileHover={{ y: -6, transition: { type: "spring", stiffness: 260, damping: 18 } }}
                className="rounded-2xl p-8 flex flex-col justify-between min-h-[280px] group relative overflow-hidden"
                style={{ background: C.cardR, border: `1px solid rgba(232,50,10,0.15)` }}>
                <div className="absolute top-0 right-0 w-1 h-full"
                  style={{ background: `linear-gradient(to bottom, transparent, ${C.red}50, transparent)` }} />
                <div className="relative z-10">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: C.red }}>02 — Content Engine</p>
                  <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter mb-4">
                    Publish content.<br />Sound human.
                  </h3>
                  <p className="text-sm leading-relaxed mb-6" style={{ color: C.muted }}>
                    Generate newsletters, LinkedIn posts, X threads, and blog posts that sound like you — not AI. Schedule and publish directly from the dashboard. Your voice, on autopilot.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 relative z-10">
                  {["Newsletters", "LinkedIn posts", "X threads", "Blog posts", "Direct publish"].map(t => (
                    <span key={t} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded"
                      style={{ background: "rgba(232,50,10,0.06)", color: C.red }}>{t}</span>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* 4-col feature strip */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { bg: C.cardG,  title: "Persona system",    desc: "Define your voice once. Every email, post, and message inherits it automatically." },
                { bg: C.card,   title: "CRM sync",          desc: "HubSpot, Zoho, Salesforce. Leads sync on first contact — no manual imports." },
                { bg: C.cardS,  title: "Gmail & SMTP",      desc: "Connect any sending account. Rotate across multiple inboxes to protect deliverability." },
                { bg: C.cardB,  title: "Gemini-powered",    desc: "ICP scoring, email writing, content generation — all Gemini under the hood." },
              ].map((f, i) => (
                <motion.div key={i} variants={springUp}
                  whileHover={{ y: -4, transition: { type: "spring", stiffness: 280, damping: 18 } }}
                  className="rounded-2xl p-5 flex flex-col min-h-[160px] group relative overflow-hidden"
                  style={{ background: f.bg, border: `1px solid ${C.border}` }}>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-all duration-500"
                    style={{ background: `linear-gradient(to right, ${C.red}, transparent)` }} />
                  <h3 className="text-sm font-black uppercase tracking-tighter mb-2">{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── PEERLIST REVIEWS ─────────────────────────────────────────── */}
        <div style={{ background: C.navyDeep, borderTop: `1px solid ${C.border}` }}>
          <PeerlistReviews />
        </div>

        {/* ── PRICING ───────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden py-16 md:py-24"
          style={{ background: C.navyMid, borderTop: `1px solid ${C.border}` }}
        >
          <DotGrid id="pricing-dots" opacity={0.035} />
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${C.red}40, transparent)` }} />

          <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12">
            {/* Header */}
            <motion.div
              initial="hidden" whileInView="visible"
              viewport={{ once: true, amount: 0.1 }} variants={fadeUp}
              className="text-center mb-10"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-3" style={{ color: C.red }}>Pricing</p>
              <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95] mb-3">
                Simple. Transparent.
              </h2>
              <p className="text-sm font-medium max-w-md mx-auto" style={{ color: C.muted }}>
                Free to start — no credit card. Pick a plan when you&apos;re ready.
              </p>
            </motion.div>

            {/* Compact tier grid */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.05 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
            >
              {([
                {
                  name: "Free",
                  price: "$0",
                  period: "",
                  highlight: "Try both engines",
                  bullets: ["50 lead credits/mo", "30 email sends/mo", "3 content pieces/mo", "1 campaign · 1 persona"],
                  cta: "Start free",
                  popular: false,
                },
                {
                  name: "Starter",
                  price: "$19",
                  period: "/mo",
                  highlight: "Content engine only",
                  bullets: ["30 content campaigns/mo", "Image generation", "Newsletter + 500 sends", "Scheduling · unlimited personas"],
                  cta: "Get Starter",
                  popular: false,
                },
                {
                  name: "Growth",
                  price: "$29",
                  period: "/mo",
                  highlight: "Active outbound",
                  bullets: ["1,000 GTM credits/mo", "Unlimited sends", "LinkedIn outreach", "CRM sync · reply detection"],
                  cta: "Get Growth",
                  popular: false,
                },
                {
                  name: "Pro",
                  price: "$49",
                  period: "/mo",
                  highlight: "Both engines, no limits",
                  bullets: ["Unlimited credits + sends", "Unlimited content + long-form", "Copilot · campaign analytics", "Multi-inbox rotation"],
                  cta: "Get Pro",
                  popular: true,
                },
                {
                  name: "Enterprise",
                  price: "Custom",
                  period: "",
                  highlight: "Volume teams",
                  bullets: ["Everything in Pro", "Custom credit volume", "White-label option", "SLA · dedicated onboarding"],
                  cta: "Contact us",
                  popular: false,
                },
              ] as const).map((tier) => (
                <div
                  key={tier.name}
                  className="rounded-2xl p-5 flex flex-col"
                  style={
                    tier.popular
                      ? { background: "#0A1628", border: `1px solid rgba(232,50,10,0.4)`, boxShadow: "0 8px 32px rgba(232,50,10,0.12)" }
                      : { background: C.card, border: `1px solid ${C.border}` }
                  }
                >
                  {tier.popular && (
                    <span className="inline-block self-start text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-3"
                      style={{ background: C.red, color: "#fff" }}>
                      Most popular
                    </span>
                  )}

                  <p className={`text-xs font-black uppercase tracking-widest mb-1 ${tier.popular ? "text-slate-400" : ""}`}
                    style={tier.popular ? undefined : { color: C.dim }}>
                    {tier.name}
                  </p>

                  <div className="flex items-baseline gap-0.5 mb-1">
                    <span className={`text-2xl font-black ${tier.popular ? "text-white" : ""}`}
                      style={tier.popular ? undefined : { color: C.white }}>
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-xs font-semibold" style={{ color: tier.popular ? "#94a3b8" : C.dim }}>
                        {tier.period}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] font-semibold mb-4"
                    style={{ color: tier.popular ? "#94a3b8" : C.dim }}>
                    {tier.highlight}
                  </p>

                  <ul className="space-y-1.5 flex-1 mb-5">
                    {tier.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0 text-[10px]" style={{ color: C.red }}>✓</span>
                        <span className="text-[11px] leading-snug"
                          style={{ color: tier.popular ? "#cbd5e1" : C.muted }}>
                          {b}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                    style={
                      tier.popular
                        ? { background: C.red, color: "#fff" }
                        : { background: "rgba(15,23,42,0.06)", border: `1px solid ${C.border}`, color: C.white }
                    }
                  >
                    {tier.cta}
                  </button>
                </div>
              ))}
            </motion.div>

            {/* Full pricing link */}
            <p className="text-center mt-6 text-xs font-semibold" style={{ color: C.dim }}>
              Credit bundles available for Starter users · {" "}
              <Link href="/pricing" className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                style={{ color: C.muted }}>
                See full feature comparison →
              </Link>
            </p>
          </div>
        </section>

        {/* ── WHO IT'S FOR ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 md:py-32"
          style={{ background: C.navyMid, borderTop: `1px solid ${C.border}` }}>
          <DotGrid id="who-dots" opacity={0.04} />
          <div className="absolute left-0 top-0 bottom-0 w-1.5"
            style={{ background: `linear-gradient(to bottom, transparent, ${C.red}, transparent)` }} />

          <div className="relative z-10 max-w-6xl mx-auto px-8 md:px-14">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}
              className="flex flex-col md:flex-row items-start md:items-center justify-between gap-12">
              <motion.div variants={fadeUp} className="max-w-xl space-y-5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: C.red }}>
                  Built for
                </p>
                <h3 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95]">
                  Founders.<br />Small GTM teams.<br />
                  <span style={{ color: C.muted }}>Anyone doing<br />their own pipeline.</span>
                </h3>
                <p className="text-base font-medium leading-relaxed max-w-md" style={{ color: C.muted }}>
                  If you&apos;re doing outbound without a 10-person SDR team, Ozigi is your force multiplier.
                  Scrape leads, run sequences, and publish content that keeps your brand warm — all without hiring.
                </p>
              </motion.div>
              <motion.div variants={fadeUp}>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="group flex-shrink-0 flex items-center gap-3 rounded-xl px-8 py-4 text-sm font-black uppercase tracking-widest transition-all duration-300 active:scale-95 cursor-pointer"
                  style={{ background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)`, boxShadow: `0 8px 32px ${C.redGlow}`, color: "#FFFFFF" }}>
                  Start for free
                  <span className="group-hover:translate-x-1.5 transition-transform duration-200">→</span>
                </button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── NEWSLETTER ────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 md:py-28"
          style={{ background: C.navyDeep, borderTop: `1px solid ${C.border}` }}>
          <DotGrid id="nl-dots" opacity={0.04} />
          <div className="relative z-10 max-w-2xl mx-auto px-8 md:px-14 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={fadeUp}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: C.red }}>
                Newsletter
              </p>
              <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95] mb-5">
                Founder&apos;s<br />Thoughts
              </h2>
              <p className="text-base font-medium mb-8 max-w-md mx-auto" style={{ color: C.muted }}>
                GTM tactics, product thinking, and what we&apos;re building — straight to your inbox. No noise, no fluff.
              </p>

              {nlStatus === "success" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex flex-col items-center gap-2 px-8 py-5 rounded-2xl"
                  style={{ background: C.cardG, border: `1px solid ${C.border}` }}
                >
                  <p className="text-lg font-black uppercase tracking-tight" style={{ color: C.white }}>You&apos;re in!</p>
                  <p className="text-sm" style={{ color: C.muted }}>We&apos;ll be in touch soon.</p>
                </motion.div>
              ) : (
                <form onSubmit={subscribeNewsletter} className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={nlEmail}
                    onChange={(e) => setNlEmail(e.target.value)}
                    required
                    className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                    style={{ background: C.card, border: `1px solid ${C.borderHi}`, color: C.white }}
                    onFocus={(e) => (e.target.style.borderColor = C.red)}
                    onBlur={(e) => (e.target.style.borderColor = C.borderHi)}
                  />
                  <button
                    type="submit"
                    disabled={nlStatus === "loading"}
                    className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-60 flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)` }}
                  >
                    {nlStatus === "loading" ? "…" : "Subscribe →"}
                  </button>
                </form>
              )}
              {nlStatus === "error" && (
                <p className="text-xs mt-3" style={{ color: C.red }}>Something went wrong. Please try again.</p>
              )}
              <p className="text-[10px] mt-4" style={{ color: C.dim }}>No spam. Unsubscribe anytime.</p>
            </motion.div>
          </div>
        </section>

      </main>

      <Footer />
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
      <NewsletterPopup />
    </div>
  );
}

"use client";

import { motion } from "framer-motion";

/* ─── Brand palette (mirrors landing page) ────────────────────────────── */
const C = {
  navy:   "#0A1628",
  red:    "#E8320A",
  border: "rgba(15,23,42,0.08)",
  borderHi:"rgba(15,23,42,0.14)",
  muted:  "rgba(51,65,85,0.85)",
  dim:    "rgba(100,116,139,0.78)",
  surface:"#FFFFFF",
  bg:     "#F8FAFC",
  bgAlt:  "#F1F5F9",
  redSoft:"rgba(232,50,10,0.10)",
};

/* ─── Sidebar item ────────────────────────────────────────────────────── */
function NavItem({
  icon,
  label,
  active = false,
}: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors"
      style={{
        background: active ? C.redSoft : "transparent",
        color: active ? C.red : C.muted,
      }}
    >
      <span className="w-3.5 h-3.5 flex items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

/* ─── Tiny inline icons (no asset deps) ───────────────────────────────── */
const Icon = {
  spark: (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <path d="M8 1l1.8 4.2L14 7l-4.2 1.8L8 13l-1.8-4.2L2 7l4.2-1.8L8 1z" fill="currentColor" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <circle cx="8" cy="5.5" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 13.5c1-2.5 3.2-3.7 5.5-3.7s4.5 1.2 5.5 3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <path d="M2.5 9V4a1.5 1.5 0 011.5-1.5h8A1.5 1.5 0 0113.5 4v5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 9h3l1 1.5h3L10.5 9h3v3a1.5 1.5 0 01-1.5 1.5H4A1.5 1.5 0 012.5 12V9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  cog: (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.5v1.7M8 12.8v1.7M14.5 8h-1.7M3.2 8H1.5M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2M12.6 12.6l-1.2-1.2M4.6 4.6L3.4 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

/* ─── Platform glyphs for output cards ────────────────────────────────── */
const Platform = {
  blog: (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 6h6M5 8.5h6M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 4.5l5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3.7" y="6.5" width="1.8" height="6" />
      <circle cx="4.6" cy="4.5" r="1" />
      <path d="M7.2 6.5h1.7v.9c.3-.5.9-1 1.9-1 1.5 0 2.2.9 2.2 2.5v3.6h-1.8V9.6c0-.8-.3-1.3-1-1.3-.8 0-1.2.5-1.2 1.3v2.9H7.2V6.5z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M11.6 2.5h2.1l-4.6 5.3 5.4 7.7h-4.2l-3.3-4.7L3.3 15.5H1.2l4.9-5.6L1 2.5h4.3l3 4.3 3.3-4.3zm-.7 11.2h1.2L5.2 3.7H3.9l7 10z" />
    </svg>
  ),
};

/* ─── Output card ─────────────────────────────────────────────────────── */
function OutputCard({
  platform,
  title,
  meta,
  body,
  status,
  delay,
}: {
  platform: keyof typeof Platform;
  title: string;
  meta: string;
  body: React.ReactNode;
  status: { label: string; tone: "ready" | "scheduled" | "draft" };
  delay: number;
}) {
  const statusStyle =
    status.tone === "ready"
      ? { color: "#15803D", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.25)" }
      : status.tone === "scheduled"
      ? { color: "#1D4ED8", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)" }
      : { color: C.dim, bg: "rgba(15,23,42,0.05)", border: C.border };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl flex flex-col"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "rgba(15,23,42,0.05)", color: C.navy }}
          >
            {Platform[platform]}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider truncate" style={{ color: C.navy }}>
              {title}
            </p>
            <p className="text-[10px] font-medium truncate" style={{ color: C.dim }}>
              {meta}
            </p>
          </div>
        </div>
        <span
          className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0"
          style={{ color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}
        >
          {status.label}
        </span>
      </div>

      {/* Card body */}
      <div className="px-3.5 py-3 text-[12px] leading-relaxed flex-1" style={{ color: C.muted }}>
        {body}
      </div>

      {/* Card actions */}
      <div className="flex items-center gap-1.5 px-3.5 py-2 border-t" style={{ borderColor: C.border }}>
        <button
          className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md"
          style={{ background: C.red, color: "#FFFFFF" }}
        >
          Publish
        </button>
        <button
          className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md"
          style={{ background: "rgba(15,23,42,0.05)", color: C.muted, border: `1px solid ${C.border}` }}
        >
          Edit
        </button>
        <button
          className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ml-auto"
          style={{ color: C.dim }}
        >
          Copy
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Main preview ────────────────────────────────────────────────────── */
export default function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-6xl mx-auto"
    >
      {/* Floating glow accent behind the frame */}
      <div
        className="absolute -inset-8 rounded-[2rem] -z-10 pointer-events-none blur-2xl opacity-60"
        style={{ background: `radial-gradient(ellipse at top, ${C.redSoft}, transparent 70%)` }}
      />

      {/* Browser chrome */}
      <div
        className="rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: C.surface,
          border: `1px solid ${C.borderHi}`,
          boxShadow: "0 30px 80px -20px rgba(15,23,42,0.25), 0 12px 32px -12px rgba(15,23,42,0.15)",
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{ background: C.bgAlt, borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div
            className="hidden sm:flex items-center gap-2 text-[11px] font-medium px-3 py-1 rounded-md mx-auto"
            style={{ background: C.surface, color: C.dim, border: `1px solid ${C.border}`, minWidth: 240 }}
          >
            <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none">
              <path
                d="M5.5 7V5a2.5 2.5 0 015 0v2M4 7h8v6H4V7z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            ozigi.app/dashboard
          </div>
          <div className="ml-auto sm:ml-0 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.red }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.red }}>
              Live
            </span>
          </div>
        </div>

        {/* App body */}
        <div className="flex" style={{ background: C.bg }}>
          {/* Sidebar */}
          <aside
            className="hidden md:flex flex-col w-[200px] shrink-0 px-3 py-4 gap-1"
            style={{ background: C.surface, borderRight: `1px solid ${C.border}` }}
          >
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <span
                className="w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-black"
                style={{ background: C.red, color: "#FFFFFF" }}
              >
                O
              </span>
              <span className="text-[13px] font-black tracking-tight" style={{ color: C.navy }}>
                Ozigi
              </span>
            </div>

            <p
              className="text-[9px] font-black uppercase tracking-widest mb-1 px-3 mt-2"
              style={{ color: C.dim }}
            >
              Workspace
            </p>
            <NavItem icon={Icon.spark} label="Distillery" active />
            <NavItem icon={Icon.clock} label="History" />
            <NavItem icon={Icon.user} label="Personas" />
            <NavItem icon={Icon.inbox} label="Subscribers" />
            <NavItem icon={Icon.calendar} label="Scheduled" />

            <p
              className="text-[9px] font-black uppercase tracking-widest mb-1 px-3 mt-4"
              style={{ color: C.dim }}
            >
              Account
            </p>
            <NavItem icon={Icon.card} label="Billing" />
            <NavItem icon={Icon.cog} label="Settings" />

            {/* Plan card */}
            <div
              className="mt-auto rounded-lg p-3"
              style={{ background: C.bgAlt, border: `1px solid ${C.border}` }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.red }}>
                Pro plan
              </p>
              <p className="text-[10px] font-medium" style={{ color: C.dim }}>
                42 / 100 generations this month
              </p>
              <div
                className="mt-2 h-1 rounded-full overflow-hidden"
                style={{ background: "rgba(15,23,42,0.08)" }}
              >
                <div className="h-full rounded-full" style={{ width: "42%", background: C.red }} />
              </div>
            </div>
          </aside>

          {/* Main pane */}
          <div className="flex-1 min-w-0 p-4 md:p-6">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
              <div>
                <p
                  className="text-[10px] font-black uppercase tracking-[0.18em] mb-1"
                  style={{ color: C.dim }}
                >
                  Campaign · iPad Pro M5 launch
                </p>
                <h3
                  className="text-lg md:text-xl font-black italic uppercase tracking-tight"
                  style={{ color: C.navy }}
                >
                  Generated in 18 seconds
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg"
                  style={{ background: "rgba(15,23,42,0.05)", color: C.muted, border: `1px solid ${C.border}` }}
                >
                  ← New campaign
                </button>
                <button
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${C.red} 0%, #c52000 100%)`,
                    color: "#FFFFFF",
                    boxShadow: `0 6px 20px rgba(232,50,10,0.30)`,
                  }}
                >
                  Publish all
                </button>
              </div>
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { v: "4", l: "Formats" },
                { v: "1,840", l: "Words" },
                { v: "0", l: "AI tells" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-lg px-3 py-2"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <p
                    className="text-base md:text-lg font-black italic tracking-tight"
                    style={{ color: C.navy }}
                  >
                    {s.v}
                  </p>
                  <p
                    className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: C.dim }}
                  >
                    {s.l}
                  </p>
                </div>
              ))}
            </div>

            {/* Output grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <OutputCard
                platform="blog"
                title="Blog post"
                meta="1,240 words · SEO ready"
                status={{ label: "Ready", tone: "ready" }}
                delay={0.05}
                body={
                  <>
                    <p className="font-bold mb-1.5" style={{ color: C.navy }}>
                      Why the M5 iPad Pro finally earns the &quot;Pro&quot; in its name
                    </p>
                    <p>
                      Apple has been calling the iPad Pro a workstation for five years. The M5 is the first
                      one that actually behaves like one — quiet under load, cool to the touch, and finally
                      able to keep a Logic Pro session honest while ten Safari tabs argue in the background.
                    </p>
                  </>
                }
              />

              <OutputCard
                platform="email"
                title="Email newsletter"
                meta="Sending Tue · 2,184 subscribers"
                status={{ label: "Scheduled", tone: "scheduled" }}
                delay={0.12}
                body={
                  <>
                    <p className="font-bold mb-1.5" style={{ color: C.navy }}>
                      The iPad Pro got serious. Here&apos;s what changed.
                    </p>
                    <p>
                      Hey — quick one this week. Spent four days with the M5 iPad Pro and I&apos;ve got
                      thoughts. Mostly about thermals, but also about why this is the first iPad I&apos;d
                      actually swap a MacBook for...
                    </p>
                  </>
                }
              />

              <OutputCard
                platform="linkedin"
                title="LinkedIn post"
                meta="218 words · ready to schedule"
                status={{ label: "Ready", tone: "ready" }}
                delay={0.19}
                body={
                  <p>
                    Five years of calling it the &quot;Pro&quot; iPad. The M5 is the first one that earns
                    it. Silent under sustained load. Logic Pro sessions don&apos;t flinch. Final Cut renders
                    in the background while you keep editing. <br />
                    <span className="font-bold" style={{ color: C.navy }}>
                      The bottleneck is no longer the chip — it&apos;s iPadOS.
                    </span>
                  </p>
                }
              />

              <OutputCard
                platform="x"
                title="X thread"
                meta="6 posts · 220 chars avg"
                status={{ label: "Draft", tone: "draft" }}
                delay={0.26}
                body={
                  <>
                    <p className="font-bold mb-1.5" style={{ color: C.navy }}>
                      1/ Spent 4 days with the M5 iPad Pro. The chip isn&apos;t the story.
                    </p>
                    <p>
                      2/ It&apos;s the silence. Logic Pro, ten Safari tabs, a 4K export — fan-quiet the
                      whole way. Most MacBooks can&apos;t do that.
                    </p>
                  </>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

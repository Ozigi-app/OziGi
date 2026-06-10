"use client";
import { motion } from "framer-motion";

// Each wordmark is a pure JSX node so we can style each independently.
// Swap names once you have real customers.
const COMPANIES: { name: string; mark: React.ReactNode }[] = [
  {
    name: "Meridian",
    mark: <span className="text-[15px] font-black tracking-tighter text-foreground-muted">meridian</span>,
  },
  {
    name: "Stackbase",
    mark: <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-foreground-muted">STACKBASE</span>,
  },
  {
    name: "Cortex",
    mark: (
      <span className="text-[15px] font-black italic text-foreground-muted">
        Cortex<span className="text-brand-red not-italic">.</span>
      </span>
    ),
  },
  {
    name: "Northlane",
    mark: <span className="text-[13px] font-semibold tracking-[0.22em] uppercase text-foreground-muted">NORTHLANE</span>,
  },
  {
    name: "Byteform",
    mark: (
      <span className="text-[15px] font-black text-foreground-muted">
        byte<span className="font-light">form</span>
      </span>
    ),
  },
  {
    name: "Patchwork",
    mark: (
      <span className="text-[15px] font-bold text-foreground-muted">
        patch<span className="font-black">work</span>
      </span>
    ),
  },
  {
    name: "Quorum",
    mark: <span className="text-[15px] font-black tracking-tight text-foreground-muted">QUORUM</span>,
  },
  {
    name: "Driftline",
    mark: (
      <span className="text-[15px] font-semibold italic text-foreground-muted">
        drift<span className="not-italic font-black">line</span>
      </span>
    ),
  },
  {
    name: "Helios",
    mark: <span className="text-[15px] font-black tracking-widest uppercase text-foreground-muted">HELIOS</span>,
  },
  {
    name: "Archflow",
    mark: (
      <span className="text-[15px] font-bold text-foreground-muted">
        arch<span className="font-black text-foreground-subtle">flow</span>
      </span>
    ),
  },
  {
    name: "Segma",
    mark: <span className="text-[15px] font-black italic tracking-tight text-foreground-muted">Segma</span>,
  },
  {
    name: "Luminary",
    mark: (
      <span className="text-[15px] font-semibold tracking-[0.1em] text-foreground-muted">
        lum<span className="font-black">inary</span>
      </span>
    ),
  },
];

// Duplicate the list so the seamless loop works (animate-scroll moves -50%)
const DOUBLED = [...COMPANIES, ...COMPANIES];

export default function SocialProof() {
  return (
    <section className="py-10 overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 mb-7">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center text-[10px] font-black uppercase tracking-[0.22em] text-foreground-muted"
        >
          Used by small teams doing their own outreach
        </motion.p>
      </div>

      {/* Scrolling marquee — no hover pause, continuous */}
      <div className="relative w-full overflow-hidden">
        {/* Fade edges — use CSS var for bg */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10" style={{ background: "linear-gradient(to right, var(--bg), transparent)" }} />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10" style={{ background: "linear-gradient(to left, var(--bg), transparent)" }} />

        <div
          className="flex items-center gap-14 animate-scroll whitespace-nowrap"
          style={{ animationDuration: "32s" }}
        >
          {DOUBLED.map((c, i) => (
            <div key={`${c.name}-${i}`} className="flex-shrink-0 select-none">
              {c.mark}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";
import { motion } from "framer-motion";

/**
 * Empty state for the output panel — shown before any campaign has been
 * generated. Previews the formats Ozigi will produce so first-time users know
 * what to expect instead of staring at a blank panel.
 */
const OUTPUT_TYPES = [
  { icon: "🧵", label: "X thread" },
  { icon: "💼", label: "LinkedIn post" },
  { icon: "✉️", label: "Newsletter" },
  { icon: "📝", label: "Blog post" },
  { icon: "💬", label: "Discord / Slack" },
] as const;

export default function OutputEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10"
    >
      <span className="block w-10 h-1 rounded-full bg-brand-red mb-5" aria-hidden />
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
        Your campaign will appear here
      </h3>
      <p className="mt-2 max-w-sm text-xs font-medium text-slate-500">
        Add context above and hit Generate to turn it into ready-to-publish posts.
      </p>
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {OUTPUT_TYPES.map((t) => (
          <li
            key={t.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600"
          >
            <span aria-hidden className="text-xs leading-none">{t.icon}</span>
            {t.label}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

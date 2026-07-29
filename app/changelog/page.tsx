import type { Metadata } from "next";
import Link from "next/link";
import { changelog, type ChangelogLabel } from "@/lib/changelog";

export const metadata: Metadata = {
  title: { absolute: "Changelog | Ozigi" },
  description: "Every update to Ozigi — new features, improvements, and fixes.",
  alternates: { canonical: "https://ozigi.app/changelog" },
};

const LABEL_STYLES: Record<ChangelogLabel, string> = {
  Feature: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  Improvement: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  Fix: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  AI: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
  Infra: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
};

const VERSION_ACCENT: Record<"green" | "blue" | "purple", string> = {
  green: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  blue: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  purple: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Page Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Ozigi" className="h-7 w-auto" />
            <span className="text-xl font-black tracking-tighter">Ozigi</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-semibold text-slate-400">
            <Link href="/docs" className="hover:text-white transition">Docs</Link>
            <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
            <Link
              href="/"
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-200 transition"
            >
              Try Ozigi Free
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-20">
        {/* Intro */}
        <section className="mb-16">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
            Release notes
          </p>
          <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter mb-5">
            Changelog
          </h1>
          <p className="text-lg text-slate-400 max-w-xl">
            What's new in Ozigi — every update, shipped and documented.
          </p>
        </section>

        {/* Feed */}
        <div className="relative">
          {/* Timeline rule */}
          <div className="pointer-events-none absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-slate-800 via-slate-800 to-transparent" />

          <ol className="space-y-14">
            {changelog.map((entry) => (
              <li key={entry.version} className="relative pl-10">
                {/* Timeline dot */}
                <span
                  aria-hidden
                  className="absolute left-0 top-2 h-3.5 w-3.5 rounded-full bg-slate-950 ring-2 ring-slate-700"
                />

                <article className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 md:p-8 shadow-sm">
                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${VERSION_ACCENT[entry.accent]}`}
                    >
                      {entry.version}
                    </span>
                    <time
                      dateTime={entry.date}
                      className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {entry.dateLabel}
                    </time>
                  </div>

                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
                    {entry.title}
                  </h2>
                  <p className="text-slate-400 leading-relaxed mb-6">{entry.summary}</p>

                  <ul className="space-y-3">
                    {entry.items.map((item, i) => (
                      <li key={i} className="flex gap-3">
                        <span
                          className={`shrink-0 inline-flex items-center h-6 rounded-md px-2 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${LABEL_STYLES[item.label]}`}
                        >
                          {item.label}
                        </span>
                        <span className="text-slate-300 leading-relaxed pt-0.5">
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {entry.prLinks && entry.prLinks.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap gap-x-5 gap-y-2">
                      {entry.prLinks.map((pr) => (
                        <a
                          key={pr.number}
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-slate-400 hover:text-white transition inline-flex items-center gap-1"
                        >
                          View PR #{pr.number}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer CTA */}
        <section className="mt-20 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/60 to-slate-900/20 p-8 md:p-10 text-center">
          <h3 className="text-2xl font-black tracking-tight text-white mb-2">
            Have feedback?
          </h3>
          <p className="text-slate-400 mb-6">
            Tell us what to build next.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="mailto:hello@ozigi.app"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-200 transition"
            >
              Email the team
            </a>
            <a
              href="https://twitter.com/DumebiTheWriter"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-bold text-slate-200 hover:border-slate-500 hover:text-white transition"
            >
              Reach out on X
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80">
        <div className="mx-auto max-w-5xl px-6 py-8 text-xs text-slate-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Ozigi</span>
          <Link href="/" className="hover:text-white transition">Back to home →</Link>
        </div>
      </footer>
    </div>
  );
}

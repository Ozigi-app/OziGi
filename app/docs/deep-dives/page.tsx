import type { Metadata } from "next";
import Link from "next/link";
import DocsShell from "@/components/docs/DocsShell";
import { DEEP_DIVES, hrefFor } from "@/lib/docs-nav";

export const metadata: Metadata = {
  title: "Deep Dives — Ozigi Docs",
  description:
    "Architecture and philosophy deep dives. How the Ozigi constraint engine works, why the Banned Lexicon exists, and how we approach human-sounding AI output.",
  openGraph: {
    title: "Deep Dives — Ozigi Docs",
    description: "Architecture and philosophy behind how Ozigi generates content that doesn't sound like AI.",
    url: "https://ozigi.app/docs/deep-dives",
    siteName: "Ozigi",
    type: "website",
    images: [{ url: "https://ozigi.app/opengraph-image.png", width: 1200, height: 630 }],
  },
  alternates: { canonical: "https://ozigi.app/docs/deep-dives" },
};

export default function DeepDivesHub() {
  return (
    <DocsShell currentSlug="deep-dives">
      <div className="mb-12">
        <span className="bg-red-100 text-brand-red text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
          Architecture
        </span>
        <h1 className="mt-5 text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-slate-900">
          Deep Dives
        </h1>
        <p className="mt-5 text-lg text-slate-600 font-medium leading-relaxed">
          The engineering decisions behind the engine. These are not how-to guides — they explain why
          Ozigi is built the way it is, in enough detail to argue with. Read in order or jump to the one
          you care about.
        </p>
      </div>

      <div className="grid gap-4">
        {DEEP_DIVES.map((dive, i) => (
          <Link
            key={dive.slug}
            href={hrefFor(dive)}
            className="group flex gap-5 items-start bg-white border-2 border-slate-200 hover:border-brand-red/40 rounded-2xl p-6 transition-colors"
          >
            <div className="text-3xl shrink-0" aria-hidden="true">
              {dive.icon}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-black text-lg text-slate-900 group-hover:text-brand-red transition-colors">
                {dive.title}
              </h2>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{dive.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </DocsShell>
  );
}

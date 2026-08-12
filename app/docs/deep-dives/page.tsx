import type { Metadata } from "next";
import Link from "next/link";
import Footer from "../../../components/Footer";

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

const DEEP_DIVES = [
  {
    number: "01",
    title: "Multimodal Ingestion",
    slug: "multimodal-pipeline",
    description: "How the Context Engine natively extracts narrative from unstructured dumps, URLs, and PDFs.",
    icon: "🧠"
  },
  {
    number: "02",
    title: "The Banned Lexicon",
    slug: "the-banned-lexicon",
    description: "Curing 'AI-Speak' by enforcing aggressive, API-level token restrictions.",
    icon: "🚫"
  },
  {
    number: "03",
    title: "System Personas",
    slug: "system-personas",
    description: "Why we abandon standard prompting in favor of strict Editorial Briefs.",
    icon: "🎭"
  },
  {
    number: "04",
    title: "Human-in-the-Loop",
    slug: "human-in-the-loop",
    description: "The automation fallacy and the 90/10 rule of collaborative content engineering.",
    icon: "🤝"
  },
  {
    number: "05",
    title: "The Structural Audit",
    slug: "the-structural-audit",
    description: "Catching the AI tells a word list can't reach — cadence, repetition, broken code, and content aimed at the wrong reader.",
    icon: "📐"
  }
];

export default function DeepDivesHub() {
  return (
    <div className="bg-[#fafafa] font-sans text-slate-900 min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/docs" className="flex items-center gap-2 group text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            <span>←</span> Back to Platform Docs
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm"
          >
            Go to Dashboard →
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 w-full">
        <div className="mb-12 text-center">
          <span className="bg-red-100 text-brand-red text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-6 inline-block">
            Architecture & Philosophy
          </span>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-4 text-slate-900">
            Platform Deep Dives
          </h1>
          <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto">
            Understand the engineering constraints and philosophical decisions that make Ozigi a high-signal content engine.
          </p>
        </div>

        {/* The Bubbles / Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          {DEEP_DIVES.map((dive) => (
            <Link 
              key={dive.slug} 
              href={`/docs/${dive.slug}`}
              className="group bg-white border-2 border-slate-100 hover:border-red-200 hover:shadow-xl transition-all duration-300 p-8 rounded-[2rem] flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="text-4xl bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  {dive.icon}
                </div>
                <span className="text-slate-300 font-black italic text-xl group-hover:text-red-200 transition-colors">
                  {dive.number}
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-3 group-hover:text-brand-red transition-colors">
                {dive.title}
              </h2>
              <p className="text-slate-500 font-medium leading-relaxed flex-1">
                {dive.description}
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-slate-400 group-hover:text-brand-red transition-colors">
                Read Article <span className="transform group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

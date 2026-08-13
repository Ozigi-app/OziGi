import Link from "next/link";
import DocsShell from "@/components/docs/DocsShell";
import { groupedNav, hrefFor, DOCS_PAGES } from "@/lib/docs-nav";

export const metadata = {
  title: "Ozigi Docs — Find Leads, Run Outreach & Publish Content",
  description:
    "Learn how to use Ozigi: source leads from GitHub, Dev.to and npm, run email and LinkedIn outreach sequences, and publish content that sounds like you — not AI.",
  alternates: { canonical: "https://ozigi.app/docs" },
};

const START_HERE = DOCS_PAGES.filter((p) =>
  ["quick-start", "platform-overview", "personas"].includes(p.slug)
);

export default function DocsIndexPage() {
  const groups = groupedNav().filter((g) => g.group !== "Getting Started");

  return (
    <DocsShell currentSlug="">
      <div className="mb-12">
        <span className="bg-red-100 text-brand-red text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
          Documentation
        </span>
        <h1 className="mt-5 text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-slate-900">
          Ozigi Documentation
        </h1>
        <p className="mt-5 text-lg text-slate-600 font-medium leading-relaxed">
          Ozigi helps small technical teams find leads, run outreach, and publish content that sounds
          human. Two engines do the work: an <strong className="text-slate-900">Outbound</strong> engine
          that sources and qualifies leads then runs email and LinkedIn sequences, and a{" "}
          <strong className="text-slate-900">Content Engine</strong> that publishes social posts,
          newsletters, and long-form articles in your voice.
        </p>
        <p className="mt-4 text-lg text-slate-600 font-medium leading-relaxed">
          They share one brain. The persona that writes your LinkedIn sequence writes your blog post, and
          the same constraints that keep a cold email out of the spam folder keep a newsletter from
          reading like it was generated.
        </p>
      </div>

      {/* Start here */}
      <section className="mb-16">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
          Start here
        </h2>
        <div className="grid gap-4">
          {START_HERE.map((page, i) => (
            <Link
              key={page.slug}
              href={hrefFor(page)}
              className="group flex gap-4 items-start bg-white border-2 border-slate-200 hover:border-brand-red/40 rounded-2xl p-5 transition-colors"
            >
              <div className="w-9 h-9 bg-brand-red text-white rounded-full flex items-center justify-center font-black shrink-0 group-hover:scale-110 transition-transform">
                {i + 1}
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-slate-900 group-hover:text-brand-red transition-colors">
                  {page.title}
                </h3>
                <p className="text-sm text-slate-600 mt-1">{page.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-full font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors shadow-lg"
          >
            Open Dashboard →
          </Link>
          <span className="text-sm text-slate-500">No credit card required for the trial</span>
        </div>
      </section>

      {/* Everything else, by group */}
      {groups.map(({ group, pages }) => (
        <section key={group} className="mb-14">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
            {group}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pages.map((page) => (
              <Link
                key={page.slug}
                href={hrefFor(page)}
                className="group bg-white border-2 border-slate-200 hover:border-brand-red/40 rounded-2xl p-5 transition-colors"
              >
                <h3 className="font-black text-slate-900 group-hover:text-brand-red transition-colors flex items-center gap-2">
                  {page.icon && <span aria-hidden="true">{page.icon}</span>}
                  {page.title}
                </h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{page.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-4 bg-slate-900 rounded-2xl p-6 text-center">
        <p className="text-white font-medium mb-2">Can&apos;t find what you need?</p>
        <p className="text-slate-400 text-sm mb-4">
          Email us with your account email and a description of the issue.
        </p>
        <a
          href="mailto:hello@ozigi.app"
          className="inline-flex items-center gap-2 bg-brand-red text-white px-5 py-2.5 rounded-full text-sm font-black uppercase tracking-widest hover:bg-red-700 transition-colors"
        >
          hello@ozigi.app →
        </a>
      </div>
    </DocsShell>
  );
}

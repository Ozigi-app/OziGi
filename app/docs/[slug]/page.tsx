import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Metadata } from "next";
import DocsShell from "@/components/docs/DocsShell";
import { mdxComponents, toSlug } from "@/components/docs/mdx";
import { DOCS_PAGES, DEEP_DIVES, findPage, neighbours, hrefFor } from "@/lib/docs-nav";
import { FAQ_DATA } from "./faq-data";

export function generateStaticParams() {
  return DOCS_PAGES.filter((p) => p.slug).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = findPage(slug);
  const title = page?.title ?? slug.replace(/-/g, " ");
  return {
    title: `${title} — Ozigi Docs`,
    description: page?.description ?? `Documentation: ${title}.`,
    alternates: { canonical: `https://ozigi.app/docs/${slug}` },
  };
}

function getDocContent(slug: string) {
  const fullPath = path.join(process.cwd(), "content/docs", `${slug}.mdx`);
  try {
    return fs.readFileSync(fullPath, "utf8");
  } catch {
    return null;
  }
}

export default async function DocArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: currentSlug } = await params;
  const content = getDocContent(currentSlug);
  if (!content) notFound();

  const page = findPage(currentSlug);
  const frontTitle = (content.match(/title:\s*"(.*)"/) || [])[1];
  const title = frontTitle || page?.title || "Documentation";
  const tag = (content.match(/tag:\s*"(.*)"/) || [])[1] || (page?.type === "deep-dive" ? "Architecture Deep Dive" : "Guide");
  const readTime = (content.match(/readTime:\s*"(.*)"/) || [])[1] || "";
  const bodyContent = content.replace(/---[\s\S]*?---/, "");

  // TOC — h2/h3 only. Deeper levels make the rail unreadable.
  const toc: { title: string; slug: string; level: number }[] = [];
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(bodyContent)) !== null) {
    const rawTitle = match[2].replace(/[*`]/g, "").trim();
    toc.push({ title: rawTitle, slug: toSlug(rawTitle), level: match[1].length });
  }

  const { prev, next } = neighbours(currentSlug);

  const faqItems = FAQ_DATA[currentSlug] || [];
  const faqSchema = faqItems.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }
    : null;

  const deepDiveIndex = DEEP_DIVES.findIndex((d) => d.slug === currentSlug);

  return (
    <>
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      <DocsShell currentSlug={currentSlug} toc={toc}>
        <div className="mb-10 border-b-2 border-slate-100 pb-8">
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span className="bg-red-100 text-brand-red text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
              {tag}
            </span>
            {deepDiveIndex >= 0 && (
              <span className="text-slate-400 text-sm font-medium">
                Deep dive {deepDiveIndex + 1} of {DEEP_DIVES.length}
              </span>
            )}
            {readTime && <span className="text-slate-400 text-sm font-medium">{readTime}</span>}
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-slate-900">
            {title}
          </h1>
          {page?.description && (
            <p className="mt-4 text-lg text-slate-600 font-medium leading-relaxed">{page.description}</p>
          )}
        </div>

        <article className="text-slate-700 font-medium leading-relaxed max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdxComponents}>
            {bodyContent}
          </ReactMarkdown>
        </article>

        {(prev || next) && (
          <nav className="mt-16 pt-10 border-t-2 border-slate-100 grid gap-4 sm:grid-cols-2" aria-label="Page navigation">
            {prev ? (
              <Link
                href={hrefFor(prev)}
                className="group flex flex-col bg-white hover:bg-red-50 border-2 border-slate-100 hover:border-red-200 p-5 rounded-2xl transition-all"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-red mb-1.5">
                  ← Previous
                </span>
                <span className="font-black text-slate-900 group-hover:text-brand-red leading-snug">{prev.nav}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={hrefFor(next)}
                className="group flex flex-col items-end text-right bg-white hover:bg-red-50 border-2 border-slate-100 hover:border-red-200 p-5 rounded-2xl transition-all sm:col-start-2"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-red mb-1.5">
                  Up next →
                </span>
                <span className="font-black text-slate-900 group-hover:text-brand-red leading-snug">{next.nav}</span>
              </Link>
            )}
          </nav>
        )}
      </DocsShell>
    </>
  );
}

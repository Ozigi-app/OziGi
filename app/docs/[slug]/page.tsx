import fs from "fs";
import path from "path";
import Link from "next/link";
import React from "react";
import ReactMarkdown from "react-markdown";
import Footer from "../../../components/Footer";
import type { Metadata } from "next";

// --- THE SEQUENCE ARRAY ---
const DEEP_DIVE_ORDER = [
  { slug: "multimodal-pipeline", title: "1. Multimodal Ingestion" },
  { slug: "the-banned-lexicon", title: "2. The Banned Lexicon" },
  { slug: "system-personas", title: "3. System Personas" },
  { slug: "human-in-the-loop", title: "4. Human-in-the-Loop" }
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = DEEP_DIVE_ORDER.find((d) => d.slug === slug);
  const title = entry ? entry.title : slug.replace(/-/g, " ");
  return {
    title: `${title} — Ozigi Docs`,
    description: `Deep dive: ${title}. Technical documentation from the Ozigi team.`,
    alternates: { canonical: `https://ozigi.app/docs/${slug}` },
  };
}

// --- FAQ SCHEMA DATA FOR EACH DEEP DIVE ---
const FAQ_DATA: Record<string, { question: string; answer: string }[]> = {
  "multimodal-pipeline": [
    {
      question: "What is Ozigi's Multimodal Ingestion Pipeline?",
      answer: "Ozigi's Context Engine, built on Gemini 2.5 Flash, ingests raw unstructured data — meeting transcripts, brain dumps, PDFs, images, audio, video, and URLs — and extracts the core narrative without requiring you to clean up or summarize anything first. You dump the raw material, the engine handles extraction, and you get a structured draft ready for finishing."
    },
    {
      question: "What file types does Ozigi support for content ingestion?",
      answer: "Ozigi supports a wide range of input types including plain text, meeting transcripts, voice memos, PDFs, images, audio files, video files, and URLs. The multimodal pipeline processes each format and extracts relevant context for content generation."
    },
    {
      question: "How does Ozigi solve the blank page problem?",
      answer: "Instead of starting from scratch, Ozigi lets you dump raw, unstructured material — notes, recordings, screenshots — and the Context Engine extracts what matters. This eliminates the blank page problem because you always start with your existing ideas, just organized and ready to expand."
    },
    {
      question: "Do I need to format my inputs before using Ozigi?",
      answer: "No. Ozigi is designed to accept messy, unstructured inputs. The multimodal pipeline handles extraction and structuring automatically, so you can paste raw meeting notes, upload voice memos, or drop in screenshots without any preprocessing."
    }
  ],
  "the-banned-lexicon": [
    {
      question: "What is the Banned Lexicon in Ozigi?",
      answer: "The Banned Lexicon is a hard-coded list of overused AI words and phrases — like 'delve,' 'tapestry,' 'robust,' and 'thrilled to announce' — that Ozigi blocks at the API level. This forces the model to find direct, precise phrasing instead of defaulting to corporate buzzwords."
    },
    {
      question: "Why does AI-generated content sound generic?",
      answer: "AI models default to statistically common tokens — words that appear frequently in training data. This creates a 'statistical mean' problem where outputs converge on the same overused phrases. The Banned Lexicon breaks this pattern by blocking high-frequency filler words."
    },
    {
      question: "How does the Banned Lexicon help content pass AI detectors?",
      answer: "By blocking predictable, high-frequency tokens, the Banned Lexicon raises perplexity and burstiness in the output. These are the same metrics AI detectors use to flag synthetic content. Higher variance in word choice makes the content read more like human writing."
    },
    {
      question: "Can I customize the Banned Lexicon?",
      answer: "Yes. While Ozigi ships with a default list of banned words based on analysis of AI-generated content patterns, you can add industry-specific terms or phrases you want to avoid in your own content."
    }
  ],
  "system-personas": [
    {
      question: "What are System Personas in Ozigi?",
      answer: "System Personas are database-backed editorial briefs that define who the AI is writing as — not what to write. A persona includes identity markers (expertise, years of experience), stylistic constraints (sentence length, tone, humor), and formatting rules. This produces first drafts that sound like a specific person, not a generic model."
    },
    {
      question: "How are System Personas different from prompts?",
      answer: "Prompts tell AI what to write; personas tell AI who it is. Instead of saying 'write a blog post about X,' a persona establishes identity ('pragmatic Staff Engineer with 10 years of experience'), voice ('short punchy sentences, dry humor, no emojis'), and constraints. The content becomes a natural output of that identity."
    },
    {
      question: "Why do System Personas produce more authentic content?",
      answer: "When you define identity before task, the AI doesn't just complete a request — it adopts a perspective. Combined with the Banned Lexicon, this prevents the model from averaging across millions of documents and instead produces content with a consistent, recognizable voice."
    },
    {
      question: "Can I create multiple personas for different content types?",
      answer: "Yes. You can create and switch between multiple personas — one for technical documentation, another for social media, another for thought leadership. Each persona maintains its own voice, constraints, and formatting rules."
    }
  ],
  "human-in-the-loop": [
    {
      question: "What is Human-in-the-Loop in Ozigi?",
      answer: "Human-in-the-Loop is Ozigi's core philosophy: the engine handles 90% of the work (ingestion, extraction, drafting), while you contribute the 10% that matters (specificity, context, final approval). Generation and publishing are strictly separated — nothing posts without your explicit review."
    },
    {
      question: "Why doesn't Ozigi fully automate content publishing?",
      answer: "Full automation produces forgettable content at scale. The 90/10 split keeps humans in control of what actually matters: adding the specific details only you know, catching errors, and ensuring the content matches your intent. Automation handles the tedious parts; you handle the judgment calls."
    },
    {
      question: "How does Ozigi prevent accidental publishing?",
      answer: "Generation and publishing are architecturally separate in Ozigi. Content moves through explicit stages — draft, review, approved — and requires manual action to publish. There's no 'auto-post' feature by design."
    },
    {
      question: "What's the 90/10 rule in content creation?",
      answer: "The 90/10 rule means AI handles the heavy lifting (organizing inputs, generating structure, drafting content) while humans add the irreplaceable 10%: specific examples, insider knowledge, tone adjustments, and final approval. This produces content that's both efficient to create and authentically human."
    }
  ]
};

const toSlug = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

const extractText = (children: React.ReactNode): string => {
  let text = "";
  React.Children.forEach(children, (child) => {
    if (typeof child === "string") text += child;
    else if (React.isValidElement(child) && (child.props as any).children) {
      text += extractText((child.props as any).children);
    }
  });
  return text;
};

// Custom Ozigi Styling for MDX
const mdxComponents = {
  h1: ({ node, children, ...props }: any) => <h1 id={toSlug(extractText(children))} className="scroll-mt-28 text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-6 text-slate-900" {...props}>{children}</h1>,
  h2: ({ node, children, ...props }: any) => <h2 id={toSlug(extractText(children))} className="scroll-mt-28 text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-4 mt-12" {...props}>{children}</h2>,
  h3: ({ node, children, ...props }: any) => <h3 id={toSlug(extractText(children))} className="scroll-mt-28 text-xl font-black text-slate-900 mt-8 mb-4" {...props}>{children}</h3>,
  h4: ({ node, children, ...props }: any) => <h4 id={toSlug(extractText(children))} className="scroll-mt-28 text-lg font-bold text-slate-800 mt-6 mb-3" {...props}>{children}</h4>,
  h5: ({ node, children, ...props }: any) => <h5 id={toSlug(extractText(children))} className="scroll-mt-28 text-base font-bold text-slate-800 mt-4 mb-2" {...props}>{children}</h5>,
  h6: ({ node, children, ...props }: any) => <h6 id={toSlug(extractText(children))} className="scroll-mt-28 text-sm font-bold uppercase tracking-widest text-slate-500 mt-4 mb-2" {...props}>{children}</h6>,
  p: ({ node, ...props }: any) => <p className="mb-6 text-slate-700 font-medium leading-relaxed" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-black text-slate-900" {...props} />,
  blockquote: ({ node, ...props }: any) => <blockquote className="bg-red-50 border-l-4 border-brand-red p-6 rounded-r-2xl text-slate-800 italic font-medium my-8" {...props} />,
  pre: ({ node, ...props }: any) => (
    <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl my-8 border border-slate-800">
      <div className="bg-slate-800/50 px-4 py-3 flex items-center border-b border-slate-700/50 gap-2">
        <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/80"></div><div className="w-3 h-3 rounded-full bg-yellow-500/80"></div><div className="w-3 h-3 rounded-full bg-green-500/80"></div></div>
        <span className="text-xs font-mono text-slate-400 ml-2">Code Snippet</span>
      </div>
      <pre className="p-6 overflow-x-auto text-sm font-mono text-slate-300 leading-relaxed" {...props} />
    </div>
  ),
  code: ({ node, className, ...props }: any) => {
    if (!className) return <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded-md font-mono text-sm" {...props} />;
    return <code className={className} {...props} />;
  },
};

function getDocContent(slug: string) {
  const fullPath = path.join(process.cwd(), "content/docs", `${slug}.mdx`);
  try { return fs.readFileSync(fullPath, "utf8"); } 
  catch (err) { return null; }
}

export default async function DocArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const currentSlug = resolvedParams.slug;
  const content = getDocContent(currentSlug);

  if (!content) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa]">
      <Link href="/docs/deep-dives" className="mb-4 text-brand-red font-bold hover:underline">← Back to Hub</Link>
      <h1 className="text-2xl font-black italic text-slate-900">404 - Document not found</h1>
    </div>
  );

  const title = (content.match(/title:\s*"(.*)"/) || [])[1] || "Documentation";
  const tag = (content.match(/tag:\s*"(.*)"/) || [])[1] || "Guide";
  const readTime = (content.match(/readTime:\s*"(.*)"/) || [])[1] || "3 min read";
  const bodyContent = content.replace(/---[\s\S]*?---/, "");

  // TOC Extraction
  const toc: { title: string; slug: string; level: number }[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(bodyContent)) !== null) {
    const level = match[1].length;
    const rawTitle = match[2].replace(/[*`]/g, "").trim(); 
    toc.push({ title: rawTitle, slug: toSlug(rawTitle), level });
  }

  // Next Article Logic
  const currentIndex = DEEP_DIVE_ORDER.findIndex(d => d.slug === currentSlug);
  const nextArticle = currentIndex >= 0 && currentIndex < DEEP_DIVE_ORDER.length - 1 
    ? DEEP_DIVE_ORDER[currentIndex + 1] 
    : null;

  // FAQ Schema (JSON-LD)
  const faqItems = FAQ_DATA[currentSlug] || [];
  const faqSchema = faqItems.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  } : null;

  return (
    <>
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <div className="bg-[#fafafa] font-sans text-slate-900 min-h-screen flex flex-col scroll-smooth">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-4 md:px-8">
          <Link href="/docs/deep-dives" className="flex items-center gap-2 group text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            <span>←</span> Back to Deep Dives
          </Link>
          <Link href="/dashboard" className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">
            Go to Dashboard →
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-16 flex flex-col lg:flex-row gap-12 relative">
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-28">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Article Contents</h3>
            <nav>
              <ul className="space-y-3 text-sm font-medium border-l-2 border-slate-200">
                {toc.map((item, index) => {
                  const padding = item.level <= 2 ? 'pl-4' : item.level === 3 ? 'pl-8' : item.level === 4 ? 'pl-12' : 'pl-16';
                  const fontSize = item.level <= 2 ? 'text-slate-700 font-bold' : 'text-slate-500';
                  return (
                    <li key={index} className={`${padding}`}>
                      <a href={`#${item.slug}`} className={`${fontSize} hover:text-brand-red transition-colors block`}>{item.title}</a>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>
        </aside>

        <main className="flex-1 max-w-3xl overflow-hidden">
          <div className="mb-12 border-b-2 border-slate-100 pb-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-red-100 text-brand-red text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">{tag}</span>
              <span className="text-slate-400 text-sm font-medium">{readTime}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-slate-900">{title}</h1>
          </div>

          <article className="text-slate-700 font-medium leading-relaxed max-w-none">
            <ReactMarkdown components={mdxComponents}>{bodyContent}</ReactMarkdown>
          </article>

          {/* NEXT ARTICLE BUTTON INJECTED HERE */}
          {nextArticle && (
            <div className="mt-16 pt-10 border-t-2 border-slate-100 flex justify-end">
              <Link 
                href={`/docs/${nextArticle.slug}`} 
                className="group flex flex-col items-end text-right bg-white hover:bg-red-50 border-2 border-slate-100 hover:border-red-200 p-6 rounded-[2rem] shadow-sm hover:shadow-lg transition-all w-full sm:w-auto min-w-[300px]"
              >
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-red mb-2">
                  Up Next
                </span>
                <span className="text-xl font-black italic text-slate-900 group-hover:text-brand-red flex items-center gap-3">
                  {nextArticle.title} 
                  <span className="bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center transform group-hover:translate-x-2 transition-transform not-italic">
                    →
                  </span>
                </span>
              </Link>
            </div>
          )}
        </main>
      </div>
        <Footer />
      </div>
    </>
  );
}

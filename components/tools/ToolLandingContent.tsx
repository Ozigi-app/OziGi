"use client";
import Link from "next/link";

interface FAQItem {
  q: string;
  a: string;
}

interface RelatedLink {
  href: string;
  label: string;
}

export function ToolLandingContent({
  toolName,
  pageUrl,
  offerDescription,
  copyTitle,
  copyParagraphs,
  faqs,
  relatedLinks,
}: {
  toolName: string;
  pageUrl: string;
  offerDescription: string;
  copyTitle: string;
  copyParagraphs: string[];
  faqs: FAQItem[];
  relatedLinks: RelatedLink[];
}) {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: toolName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: pageUrl,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free to try, no sign-up required.",
    },
    description: offerDescription,
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="max-w-4xl mx-auto px-6 py-16 border-t border-slate-200">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="mb-14">
        <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-[#0A1628] mb-5">
          {copyTitle}
        </h2>
        <div className="space-y-4">
          {copyParagraphs.map((p, i) => (
            <p key={i} className="text-slate-600 leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </div>

      <div className="mb-14">
        <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-[#0A1628] mb-6">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="group bg-white border border-slate-200 rounded-xl p-5"
            >
              <summary className="cursor-pointer font-bold text-[#0A1628] list-none flex items-center justify-between gap-4">
                <span>{f.q}</span>
                <span className="text-slate-400 text-xl leading-none shrink-0 group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="text-slate-600 mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {relatedLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-[#E8320A] font-bold hover:underline underline-offset-2"
          >
            {l.label} →
          </Link>
        ))}
      </div>
    </section>
  );
}

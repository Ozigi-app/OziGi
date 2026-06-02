import Link from "next/link";
import Image from "next/image";
import { getAllSections, getPostsBySection, SECTION_META } from "@/lib/blog";
import { format } from "date-fns";

// Match the homepage revalidation so newly published posts appear in sections
// without requiring a full redeploy.
export const revalidate = 3600;

export async function generateStaticParams() {
  const sections = getAllSections();
  return sections.map((section) => ({
    slug: section.toLowerCase().replace(/\s+/g, "-"),
  }));
}

/** Reverse a URL slug back to its canonical section name.
 *  Looks up the slug in getAllSections() so brand-name casing
 *  (e.g. "WordPress" not "Wordpress") is always preserved. */
function slugToSection(slug: string): string {
  const sections = getAllSections();
  return (
    sections.find((s) => s.toLowerCase().replace(/\s+/g, "-") === slug) ?? slug
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sectionName = slugToSection(slug);

  return {
    title: `${sectionName} | Ozigi Blog`,
    description: `Browse ${sectionName} articles from the Ozigi team.`,
  };
}

export default async function SectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sectionName = slugToSection(slug);

  const posts = await getPostsBySection(sectionName);
  const allSections = getAllSections();

  return (
    <div className="min-h-screen bg-brand-offwhite">
      <div className="max-w-6xl mx-auto py-16 px-6">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/blog"
            className="text-sm font-semibold text-brand-red hover:text-brand-red/80 mb-4 inline-block"
          >
            ← Back to all articles
          </Link>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-4">
            {sectionName}
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl">
            {posts.length} article{posts.length !== 1 ? "s" : ""} in this section
          </p>
        </div>

        {/* Other Sections Navigation */}
        <div className="flex flex-wrap gap-2 mb-12">
          {allSections.map((section) => {
            const isActive = section === sectionName;
            return (
              <Link
                key={section}
                href={
                  isActive
                    ? "#"
                    : `/${section.toLowerCase().replace(/\s+/g, "-")}`
                }
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-brand-red text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:border-brand-red hover:text-brand-red"
                }`}
              >
                {section}
              </Link>
            );
          })}
        </div>

        {/* Section Intro */}
        {SECTION_META[sectionName] && (
          <div className="mb-12 bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-3">
              About this section
            </h2>
            <p className="text-slate-700 mb-6 leading-relaxed">
              {SECTION_META[sectionName].description}
            </p>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                Example topics
              </p>
              <div className="flex flex-wrap gap-2">
                {SECTION_META[sectionName].examples.map((example, idx) => (
                  <span key={idx} className="px-3 py-1 bg-slate-100 rounded-full text-sm text-slate-700">
                    {example}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Section Posts */}
        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all"
              >
                {post.coverImage && (
                  <div className="relative w-full aspect-[1200/630] overflow-hidden bg-slate-100">
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                    <span>{format(new Date(post.date + "T00:00:00Z"), "MMM dd, yyyy")}</span>
                    <span>•</span>
                    <span>{post.readTime || "5 min read"}</span>
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tighter mb-2 group-hover:text-brand-red transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="text-slate-600 text-sm line-clamp-2">
                    {post.excerpt || post.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-slate-600 mb-6">No articles in this section yet.</p>
            <Link
              href="/blog"
              className="inline-block px-6 py-3 bg-brand-red text-white font-bold rounded-lg hover:bg-brand-red/90 transition-colors"
            >
              Browse all articles
            </Link>
          </div>
        )}

        {/* Write for Ozigi CTA */}
        <div className="mt-16 py-12 bg-gradient-to-r from-brand-red/10 to-brand-red/5 rounded-2xl border border-brand-red/20 px-8 text-center">
          <h3 className="text-2xl font-black uppercase tracking-tighter mb-3">
            Want to write for Ozigi?
          </h3>
          <p className="text-slate-700 mb-6 max-w-2xl mx-auto">
            We&apos;re looking for {sectionName.toLowerCase()} writers to share insights with our community.
            Contributors earn a stipend and get featured on our platform.
          </p>
          <Link
            href="https://ozigi.app/write"
            className="inline-block px-6 py-3 bg-brand-red text-white font-bold uppercase tracking-widest text-sm rounded-lg hover:bg-brand-red/90 transition-colors"
          >
            Apply to write
          </Link>
        </div>
      </div>
    </div>
  );
}

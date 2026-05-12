import Link from "next/link";
import Image from "next/image";
import { getAllPosts, getAllSections } from "@/lib/blog";
import { format } from "date-fns";
import NewsletterSection from "@/components/NewsletterSection";

export default async function BlogPage() {
  const posts = await getAllPosts();
  const sections = getAllSections();

  return (
    <div className="min-h-screen bg-brand-offwhite">
      <div className="max-w-6xl mx-auto py-16 px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-4">
            Ozigi Blog
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Insights, updates, and tutorials from the team building the intelligent content engine.
          </p>
        </div>

        {/* Section Navigation */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {sections.map((section) => {
            const sectionPosts = posts.filter((p) => p.section === section);
            const count = sectionPosts.length;
            return (
              <Link
                key={section}
                href={`/${section.toLowerCase().replace(/\s+/g, "-")}`}
                className="px-4 py-2 rounded-full bg-white border border-slate-200 hover:border-brand-red hover:text-brand-red transition-colors text-sm font-semibold text-slate-700"
              >
                {section} <span className="text-xs ml-1 opacity-60">({count})</span>
              </Link>
            );
          })}
        </div>

        {/* All Posts Grid */}
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 text-slate-900">
            Latest Articles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all"
              >
                {post.coverImage && (
                  <div className="relative w-full aspect-[1200/630] overflow-hidden bg-slate-100">
                    {post.coverImage.toLowerCase().endsWith('.svg') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Image
                        src={post.coverImage}
                        alt={post.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    )}
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 flex-wrap">
                    {post.date && <span>{format(new Date(post.date + "T00:00:00Z"), "MMM dd, yyyy")}</span>}
                    {post.date && <span>•</span>}
                    <span>{post.readTime || "5 min read"}</span>
                    {post.section && (
                      <>
                        <span>•</span>
                        <span className="text-brand-red font-semibold">{post.section}</span>
                      </>
                    )}
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
        </div>
      </div>
      <NewsletterSection />
    </div>
  );
}

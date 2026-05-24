import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog";
import ServerTableOfContents from "@/components/blog/ServerTableOfContents";
import AuthorBio from "@/components/AuthorBio";
import CodeBlock from "@/components/blog/CodeBlock";



// Revalidate every hour so newly published articles appear without a full redeploy
export const revalidate = 3600;

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Not Found" };

  const postUrl = `https://blog.ozigi.app/blog/${slug}`;

  return {
    title: `${post.title} | Ozigi Blog`,
    description: post.description || post.excerpt || "",
    keywords: post.keywords || [],
    authors: post.author ? [{ name: post.author }] : [],
    alternates: {
      canonical: postUrl,
    },
    openGraph: {
      title: post.title,
      description: post.description || post.excerpt || "",
      url: postUrl,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.modifiedTime || post.date,
      authors: post.author ? [post.author] : [],
      images: [{ url: `https://blog.ozigi.app/blog/${slug}/opengraph-image`, width: 1200, height: 630, alt: post.title }],
      section: post.section || "Blog",
      tags: post.keywords || post.categories || [],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description || post.excerpt || "",
      images: [`https://blog.ozigi.app/blog/${slug}/opengraph-image`],
      creator: post.authorHandle || "@ozigi_app",
      site: "@ozigi_app",
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const relatedPosts = post.categories?.length ? await getRelatedPosts(post.categories, slug) : [];

  const generateId = (text: string) => {
    return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, "-");
  };

const hasHeadings = post.headings && post.headings.length > 0;
  const baseUrl = "https://blog.ozigi.app";

  // Article JSON-LD Schema
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description || post.excerpt,
    image: post.coverImage || "/images/og-default.png",
    datePublished: post.date,
    dateModified: post.modifiedTime || post.date,
    author: post.author ? {
      "@type": "Person",
      name: post.author,
      url: post.authorUrl || undefined,
    } : undefined,
    publisher: {
      "@type": "Organization",
      name: "Ozigi",
      logo: {
        "@type": "ImageObject",
        url: "https://ozigi.app/logo.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/blog/${slug}`,
    },
    articleSection: post.section || "Blog",
    keywords: post.keywords || post.categories || [],
  };

  // Breadcrumb JSON-LD Schema
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Blog",
        item: `${baseUrl}`,
      },
      ...(post.section ? [{
        "@type": "ListItem",
        position: 2,
        name: post.section,
        item: `${baseUrl}/section/${post.section.toLowerCase().replace(/\s+/g, "-")}`,
      }] : []),
      {
        "@type": "ListItem",
        position: post.section ? 3 : 2,
        name: post.title,
        item: `${baseUrl}/blog/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-red transition-colors"
          >
            ← Back to all posts
          </Link>
        </div>

        {post.coverImage && (
          <div className="relative w-full aspect-[1200/630] mb-8 rounded-2xl overflow-hidden bg-slate-100">
            {post.coverImage.toLowerCase().endsWith('.svg') ? (
              // SVGs can't go through Next.js image optimisation — use plain img
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 1200px"
              />
            )}
          </div>
        )}

<div
  className={
    hasHeadings
      ? "grid grid-cols-1 xl:grid-cols-[16rem_minmax(0,48rem)_16rem] gap-8 items-start"
      : "flex justify-center"
  }
>
{hasHeadings && (
  <aside>
    <div className="sticky top-24">
      <ServerTableOfContents headings={post.headings} />
    </div>
  </aside>
)}

          <main className="min-w-0 w-full">
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-4">
              {post.title}
            </h1>

            <AuthorBio
              author={post.author}
              authorImage={post.authorImage}
              authorBio={post.authorBio}
              authorUrl={post.authorUrl}
              authorHandle={post.authorHandle}
              variant="inline"
            />

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-8 pb-8 border-b border-slate-200">
              {post.date && (
                <>
                  <span>
                    {format(
                      new Date(post.date.includes('T') ? post.date : `${post.date}T00:00:00Z`), 
                      "MMMM dd, yyyy"
                    )}
                  </span>
                  <span>•</span>
                </>
              )}
              <span>{post.readTime || "5 min read"}</span>
              {post.author && (
                <>
                  <span>•</span>
                  <span>By {post.author}</span>
                </>
              )}
              {post.categories && post.categories.length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-brand-red">{post.categories.join(", ")}</span>
                </>
              )}
            </div>

            <div className="prose prose-slate prose-lg max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children, ...props }) => {
                    const text = children?.toString() || "";
                    const id = generateId(text);
                    return (
                      <h1 id={id} className="scroll-mt-24" {...props}>
                        {children}
                      </h1>
                    );
                  },
                  h2: ({ children, ...props }) => {
                    const text = children?.toString() || "";
                    const id = generateId(text);
                    return (
                      <h2 id={id} className="scroll-mt-24" {...props}>
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ children, ...props }) => {
                    const text = children?.toString() || "";
                    const id = generateId(text);
                    return (
                      <h3 id={id} className="scroll-mt-24" {...props}>
                        {children}
                      </h3>
                    );
                  },
                  h4: ({ children, ...props }) => {
                    const text = children?.toString() || "";
                    const id = generateId(text);
                    return (
                      <h4 id={id} className="scroll-mt-24" {...props}>
                        {children}
                      </h4>
                    );
                  },
                  h5: ({ children, ...props }) => {
                    const text = children?.toString() || "";
                    const id = generateId(text);
                    return (
                      <h5 id={id} className="scroll-mt-24" {...props}>
                        {children}
                      </h5>
                    );
                  },
                  h6: ({ children, ...props }) => {
                    const text = children?.toString() || "";
                    const id = generateId(text);
                    return (
                      <h6 id={id} className="scroll-mt-24" {...props}>
                        {children}
                      </h6>
                    );
                  },
                  a: ({ href, children, ...props }) => {
                    if (href?.startsWith("/")) {
                      return (
                        <Link href={href} {...props}>
                          {children}
                        </Link>
                      );
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                        {children}
                      </a>
                    );
                  },
                  code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : 'text';
      const codeString = String(children).replace(/\n$/, '');
      
      return !inline && match ? (
<CodeBlock language={language}>{codeString}</CodeBlock>
  ) : (
    <code className={className} {...props}>{children}</code>
  );
    },
                  img: ({ src, alt, ...props }) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={alt} className="rounded-lg my-4 max-w-full h-auto" {...props} />
                  ),
                }}
              >
                {post.content}
              </ReactMarkdown>
            </div>

            <AuthorBio
              author={post.author}
              authorImage={post.authorImage}
              authorBio={post.authorBio}
              authorUrl={post.authorUrl}
              authorHandle={post.authorHandle}
              variant="full"
            />

            {relatedPosts.length > 0 && (
              <div className="mt-16 pt-8 border-t border-slate-200">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-6">
                  Read more like this
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedPosts.map((related) => (
                    <Link
                      key={related.slug}
                      href={`/blog/${related.slug}`}
                      className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all"
                    >
                      {related.coverImage && (
                        <div className="relative w-full aspect-[1200/630] overflow-hidden bg-slate-100">
                          {related.coverImage.toLowerCase().endsWith('.svg') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={related.coverImage}
                              alt={related.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <Image
                              src={related.coverImage}
                              alt={related.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}
                        </div>
                      )}
                      <div className="p-4">
                        <h4 className="font-black text-brand-navy group-hover:text-brand-red transition-colors line-clamp-2">
                          {related.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-2">
                          {related.date && format(
                            new Date(related.date.includes('T') ? related.date : `${related.date}T00:00:00Z`), 
                            "MMM dd, yyyy"
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </main>

          {hasHeadings && <div className="hidden xl:block" aria-hidden="true" />}
        </div>
      </div>
    </div>
    </>
  );
}

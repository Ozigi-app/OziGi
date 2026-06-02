import { Metadata } from "next";

function slugToTitle(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Scaffold for future CMS integration
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = slugToTitle(slug);
  const canonical = `https://ozigi.app/blog/${slug}`;

  return {
    title: `${title} — Ozigi Blog`,
    description: `${title} — read the latest thoughts, tactics, and updates from the Ozigi team.`,
    openGraph: {
      title: `${title} — Ozigi Blog`,
      description: `${title} — read the latest thoughts, tactics, and updates from the Ozigi team.`,
      url: canonical,
      siteName: "Ozigi",
      type: "article",
      images: [
        {
          url: "https://ozigi.app/og-image.png",
          width: 1200,
          height: 630,
          alt: `${title} — Ozigi Blog`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Ozigi Blog`,
      description: `${title} — read the latest thoughts, tactics, and updates from the Ozigi team.`,
      images: ["https://ozigi.app/og-image.png"],
      creator: "@DumebiTheWriter",
    },
    alternates: { canonical },
  };
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const title = slugToTitle(slug);
  const canonical = `https://ozigi.app/blog/${slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    url: canonical,
    image: "https://ozigi.app/og-image.png",
    publisher: {
      "@type": "Organization",
      name: "Ozigi",
      logo: { "@type": "ImageObject", url: "https://ozigi.app/og-image.png" },
    },
    author: { "@type": "Organization", name: "Ozigi" },
  };

  return (
    <article className="max-w-3xl mx-auto py-12 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <h1>{title}</h1>
      <p>Content coming soon.</p>
    </article>
  );
}
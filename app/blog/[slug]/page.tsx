import { Metadata } from "next";

// Scaffold for future CMS integration
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  // Await the params resolution (Next.js 15 requirement)
  const resolvedParams = await params;
  
  return {
    title: `${resolvedParams.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — Ozigi Blog`,
    description: "Technical writing and updates from the Ozigi team.",
    alternates: { canonical: `https://ozigi.app/blog/${resolvedParams.slug}` },
  };
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const resolvedParams = await params;
  return (
    <article className="max-w-3xl mx-auto py-12 px-4">
      <h1>Post: {resolvedParams.slug}</h1>
      <p>Content coming soon.</p>
    </article>
  );
}
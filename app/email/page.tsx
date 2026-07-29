import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";
import EmailSubscribeForm from "@/components/EmailSubscribeForm";

export const revalidate = 3600;

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: { absolute: "Founder's Thoughts — Newsletter Archive | Ozigi" },
  description:
    "Browse every issue of Founder's Thoughts — the Ozigi newsletter on what we're building, content strategy, and personal observations from the founder.",
  alternates: { canonical: "https://ozigi.app/email" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Founder's Thoughts — Newsletter Archive",
    description:
      "Every issue of the Ozigi newsletter. Building in public, content strategy, and founder observations.",
    url: "https://ozigi.app/email",
    siteName: "Ozigi",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Founder's Thoughts — Newsletter Archive | Ozigi",
    description:
      "Browse every issue of the Ozigi newsletter — building in public, content strategy, and founder observations.",
    site: "@ozigi_app",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function excerpt(content: string, max = 160) {
  const text = stripHtml(content);
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function parseSubject(post: { subject: string | null; content: string | null }) {
  if (post.subject) return post.subject;
  const match = post.content?.match(/^\s*Subject:\s*(.+)$/im);
  return match ? match[1].trim() : "Newsletter";
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getNewsletters() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find the Ozigi admin account
  const adminEmail = process.env.ADMIN_EMAILS?.split(",")[0]?.trim();
  if (!adminEmail) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email_sender_name, display_name")
    .eq("email", adminEmail)
    .single();

  if (!profile) return [];

  const { data: posts } = await supabase
    .from("scheduled_posts")
    .select("id, subject, content, created_at, published_at")
    .eq("user_id", profile.id)
    .eq("platform", "email")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  return (posts || []).map((p) => ({
    id: p.id as string,
    subject: parseSubject(p),
    excerpt: excerpt(p.content || ""),
    date: (p.published_at || p.created_at) as string,
    senderName: profile.email_sender_name?.trim() || profile.display_name || "Ozigi",
  }));
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

function buildJsonLd(newsletters: Awaited<ReturnType<typeof getNewsletters>>) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Founder's Thoughts — Newsletter Archive",
    description:
      "Every issue of the Ozigi newsletter on what we're building, content strategy, and founder observations.",
    url: "https://ozigi.app/email",
    publisher: {
      "@type": "Organization",
      name: "Ozigi",
      url: "https://ozigi.app",
      logo: { "@type": "ImageObject", url: "https://ozigi.app/logo.png" },
    },
    hasPart: newsletters.map((n) => ({
      "@type": "Article",
      headline: n.subject,
      url: `https://ozigi.app/email/${n.id}`,
      datePublished: n.date,
      author: { "@type": "Person", name: n.senderName },
    })),
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function NewsletterArchive() {
  const newsletters = await getNewsletters();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(newsletters)) }}
      />

      <div className="min-h-screen bg-[#fafafa]">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Ozigi" className="h-7 w-auto" />
              <span className="font-black text-lg tracking-tighter text-slate-900 group-hover:text-[#E8320A] transition-colors">
                Ozigi
              </span>
            </Link>
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              ← Back to Ozigi
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12 md:py-16">
          {/* Hero */}
          <div className="mb-12 md:mb-16">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: "#E8320A" }}>
              Newsletter
            </p>
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95] text-slate-900 mb-5">
              Founder&apos;s<br />Thoughts
            </h1>
            <p className="text-base text-slate-500 max-w-xl mb-8">
              Once or twice a week — what we&apos;re building at Ozigi, how we think about content and AI,
              and the occasional personal observation from running a product company. No fluff.
            </p>

            {/* Compact subscribe inline with the hero */}
            <div className="max-w-sm">
              <p className="text-xs font-semibold text-slate-600 mb-2">Subscribe to get new issues →</p>
              <EmailSubscribeForm compact />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 mb-10" />

          {/* Issue count */}
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8">
            {newsletters.length} {newsletters.length === 1 ? "Issue" : "Issues"}
          </p>

          {/* Newsletter list */}
          {newsletters.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <p className="text-4xl mb-4">✉</p>
              <p className="font-semibold">No issues published yet.</p>
              <p className="text-sm mt-1">Subscribe above and you&apos;ll be the first to know.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {newsletters.map((n) => (
                <Link
                  key={n.id}
                  href={`/email/${n.id}`}
                  className="group flex flex-col sm:flex-row sm:items-start gap-4 py-6 hover:bg-white -mx-4 px-4 rounded-xl transition-colors"
                >
                  {/* Date pill */}
                  <time
                    dateTime={n.date}
                    className="text-xs text-slate-400 font-medium shrink-0 pt-0.5 min-w-[120px]"
                  >
                    {formatDate(n.date)}
                  </time>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-black tracking-tight text-slate-900 group-hover:text-[#E8320A] transition-colors mb-1 leading-snug">
                      {n.subject}
                    </h2>
                    <p className="text-sm text-slate-500 line-clamp-2">{n.excerpt}</p>
                  </div>

                  {/* Arrow */}
                  <span className="text-slate-300 group-hover:text-[#E8320A] transition-colors shrink-0 text-lg self-center hidden sm:block">
                    →
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Bottom subscribe CTA */}
          <div className="mt-16">
            <EmailSubscribeForm />
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-200 bg-white">
          <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <span>
              Powered by{" "}
              <Link href="https://ozigi.app" className="underline hover:text-slate-700 transition-colors">
                Ozigi
              </Link>{" "}
              — AI content that sounds human.
            </span>
            <div className="flex gap-4">
              <Link href="/" className="hover:text-slate-700 transition-colors">Home</Link>
              <Link href="/blog" className="hover:text-slate-700 transition-colors">Blog</Link>
              <Link href="/pricing" className="hover:text-slate-700 transition-colors">Pricing</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

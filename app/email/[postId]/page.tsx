import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function excerpt(content: string, max = 200) {
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

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getPost(postId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: post, error } = await supabase
    .from("scheduled_posts")
    .select("content, user_id, subject, created_at, published_at")
    .eq("id", postId)
    .eq("platform", "email")
    .single();

  if (error || !post) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_sender_name, display_name, reply_to_email, email")
    .eq("id", post.user_id)
    .single();

  return { post, profile };
}

function parseContent(post: { subject: string | null; content: string | null }) {
  let subject = post.subject || "";
  let body = post.content || "";

  // Strip Subject: line from body (in case it's embedded)
  const inlineSubject = body.match(/^\s*Subject:\s*(.+)$/im);
  if (inlineSubject) {
    if (!subject) subject = inlineSubject[1].trim();
    body = body.replace(inlineSubject[0], "").replace(/^\n+/, "").trim();
  }
  const htmlSubject = body.match(/<[^>]*>\s*Subject:\s*(.+?)\s*<\/[^>]*>/i);
  if (htmlSubject) {
    if (!subject) subject = htmlSubject[1].trim();
    body = body.replace(htmlSubject[0], "");
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(body);
  const finalBody = isHtml
    ? body
    : body
        .split(/\n\n+/)
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("\n");

  return { subject: subject || "Newsletter", body: finalBody };
}

// ─── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const data = await getPost(postId);
  if (!data) return { title: { absolute: "Newsletter | Ozigi" } };

  const { post, profile } = data;
  const { subject, body } = parseContent(post);
  const senderName =
    profile?.email_sender_name?.trim() || profile?.display_name || "Ozigi";
  const desc = excerpt(body);
  const publishedTime = post.published_at || post.created_at;
  const canonical = `https://ozigi.app/email/${postId}`;

  return {
    title: `${subject} | ${senderName}`,
    description: desc,
    authors: [{ name: senderName }],
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: subject,
      description: desc,
      url: canonical,
      siteName: "Ozigi",
      type: "article",
      ...(publishedTime && { publishedTime }),
      authors: [senderName],
    },
    twitter: {
      card: "summary",
      title: subject,
      description: desc,
      site: "@ozigi_app",
    },
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function EmailWebView({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const data = await getPost(postId);
  if (!data) notFound();

  const { post, profile } = data;
  const { subject, body } = parseContent(post);
  const senderName =
    profile?.email_sender_name?.trim() || profile?.display_name || "Ozigi";
  const replyTo = profile?.reply_to_email || profile?.email;
  const publishedAt = post.published_at || post.created_at;
  const canonical = `https://ozigi.app/email/${postId}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: subject,
    description: excerpt(body),
    author: { "@type": "Person", name: senderName },
    publisher: {
      "@type": "Organization",
      name: "Ozigi",
      url: "https://ozigi.app",
      logo: { "@type": "ImageObject", url: "https://ozigi.app/logo.png" },
    },
    url: canonical,
    mainEntityOfPage: canonical,
    ...(publishedAt && { datePublished: publishedAt, dateModified: publishedAt }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-[#fafafa]">
        {/* Minimal header */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Ozigi" className="h-7 w-auto" />
              <span className="font-black text-lg tracking-tighter text-slate-900 group-hover:text-[#E8320A] transition-colors">
                Ozigi
              </span>
            </Link>
            <Link
              href="/email"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              ← All Newsletters
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
          {/* Article header */}
          <header className="mb-10 pb-8 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-5">
              <span
                className="font-black uppercase tracking-widest text-[10px]"
                style={{ color: "#E8320A" }}
              >
                {senderName}
              </span>
              {publishedAt && (
                <>
                  <span className="text-slate-300">·</span>
                  <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
                </>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">
              {subject}
            </h1>
          </header>

          {/* Article body */}
          <article
            className="prose prose-slate max-w-none
              prose-headings:font-black prose-headings:tracking-tight
              prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
              prose-a:text-[#E8320A] prose-a:no-underline hover:prose-a:underline
              prose-img:rounded-xl prose-img:shadow-sm
              prose-blockquote:border-l-[#E8320A] prose-blockquote:not-italic
              prose-code:text-[0.85em] prose-pre:bg-slate-900"
            dangerouslySetInnerHTML={{ __html: body }}
          />

          {/* Reply CTA */}
          {replyTo && (
            <div className="mt-16 rounded-2xl bg-slate-950 px-8 py-10 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#E8320A] mb-3">
                Enjoyed this?
              </p>
              <p className="text-lg font-black italic uppercase tracking-tight text-white mb-2">
                Tell {senderName}
              </p>
              <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
                Hit reply — they read every response.
              </p>
              <a
                href={`mailto:${replyTo}?subject=Re: ${encodeURIComponent(subject)}`}
                className="inline-block px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #E8320A 0%, #c52000 100%)" }}
              >
                Reply →
              </a>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-200 bg-white">
          <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <span>
              Powered by{" "}
              <Link href="https://ozigi.app" className="underline hover:text-slate-700 transition-colors">
                Ozigi
              </Link>{" "}
              — AI content that sounds human.
            </span>
            <Link href="/email" className="hover:text-slate-700 transition-colors">
              Browse all newsletters
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}

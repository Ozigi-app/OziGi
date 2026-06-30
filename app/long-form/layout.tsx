import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI Long-Form Article Generator — Write 2,500-Word Blog Posts in Seconds | Ozigi",
  description:
    "Generate publish-ready long-form articles, blog posts, and thought-leadership pieces with AI. Choose your tone, structure, and depth — get a 800–2,500 word draft in seconds. No sign-up needed for your first article.",
  keywords: [
    "AI article writer",
    "long form content generator",
    "AI blog post generator",
    "free AI writer",
    "AI thought leadership generator",
    "blog post writer AI",
    "long form AI writing tool",
    "AI content generator free",
    "automated article writer",
    "SEO article generator AI",
  ],
  openGraph: {
    title: "Free AI Long-Form Article Generator | Ozigi",
    description:
      "Write publish-ready 800–2,500 word articles in seconds. Pick your tone, format, and depth — the AI does the rest. Try free, no sign-up required.",
    type: "website",
    url: "https://ozigi.com/long-form",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Long-Form Article Generator | Ozigi",
    description:
      "Write publish-ready 800–2,500 word articles in seconds. Pick your tone, format, and depth — the AI does the rest.",
  },
  alternates: {
    canonical: "https://ozigi.com/long-form",
  },
};

export default function LongFormLayout({ children }: { children: React.ReactNode }) {
  return children;
}

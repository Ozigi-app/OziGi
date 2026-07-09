import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI Writing Generator — Long-Form Articles in Seconds, No Sign-Up | Ozigi",
  description:
    "A free AI writing assistant for long-form content — generate publish-ready 800–2,500 word articles, blog posts, and thought-leadership pieces in seconds. Choose your tone, structure, and depth. No sign-up required to try it.",
  keywords: [
    "AI writing generator",
    "AI writing assistant free online",
    "free AI writing app",
    "AI writer generator",
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
    title: "Free AI Writing Generator | Ozigi",
    description:
      "A free AI writing assistant that writes publish-ready 800–2,500 word articles in seconds. Pick your tone, format, and depth — the AI does the rest. No sign-up required.",
    type: "website",
    url: "https://ozigi.app/long-form",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Writing Generator | Ozigi",
    description:
      "A free AI writing assistant that writes publish-ready 800–2,500 word articles in seconds. Pick your tone, format, and depth — the AI does the rest.",
  },
  alternates: {
    canonical: "https://ozigi.app/long-form",
  },
};

export default function LongFormLayout({ children }: { children: React.ReactNode }) {
  return children;
}

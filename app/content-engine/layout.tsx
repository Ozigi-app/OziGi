import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Content Engine",
  description:
    "Generate newsletters, LinkedIn posts, X threads, and blog posts that sound like you — not AI. Ozigi's content engine runs on autopilot in your voice.",
  keywords: [
    "AI content generator",
    "AI writing tool for founders",
    "newsletter generator",
    "LinkedIn post generator",
    "AI blog writer",
    "content engine for startups",
    "human-sounding AI content",
  ],
  openGraph: {
    title: "Content Engine | Ozigi",
    description:
      "Generate newsletters, LinkedIn posts, X threads, and blog posts that sound like you — not AI.",
    url: "https://ozigi.app/content-engine",
    siteName: "Ozigi",
    type: "website",
    images: [
      {
        url: "https://ozigi.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ozigi Content Engine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Content Engine | Ozigi",
    description:
      "Generate newsletters, LinkedIn posts, X threads, and blog posts that sound like you — not AI.",
    images: ["https://ozigi.app/og-image.png"],
    creator: "@DumebiTheWriter",
  },
  alternates: {
    canonical: "https://ozigi.app/content-engine",
  },
};

export default function ContentEngineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

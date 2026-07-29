import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ozigi Tutorials — Guides & How-Tos",
  description:
    "Video tutorials on building campaigns, setting up personas, publishing to X, LinkedIn, Discord, Slack, and scheduling newsletters. Everything you need to get the most out of Ozigi.",
  openGraph: {
    title: "Ozigi Tutorials — Guides & How-Tos",
    description:
      "Video guides on campaigns, personas, publishing, and scheduling. Learn how to make Ozigi sound like you at your most articulate.",
    url: "https://ozigi.app/tutorials",
    siteName: "Ozigi",
    type: "website",
    images: [
      {
        url: "https://ozigi.app/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Ozigi Tutorials",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ozigi Tutorials — Guides & How-Tos",
    description: "Guides on campaigns, personas, and publishing. Learn to use Ozigi the right way.",
    images: ["https://ozigi.app/opengraph-image.png"],
  },
  alternates: { canonical: "https://ozigi.app/tutorials" },
};

export default function TutorialsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

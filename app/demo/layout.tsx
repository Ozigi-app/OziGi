import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Try Ozigi Free — See What Human Sounds Like",
  description:
    "Paste a URL, your notes, or a rough idea. Get posts for X, LinkedIn, and Discord that sound like you wrote them — in 20 seconds. No account needed.",
  openGraph: {
    title: "Try Ozigi Free — See What Human Sounds Like",
    description:
      "Paste anything. Get content for X, LinkedIn, and Discord that sounds like a real person wrote it. Free to try — no account needed.",
    url: "https://ozigi.app/demo",
    siteName: "Ozigi",
    type: "website",
    images: [
      {
        url: "https://ozigi.app/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Ozigi — Try the demo free",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Try Ozigi Free — See What Human Sounds Like",
    description:
      "Paste anything. Get content for X, LinkedIn, and Discord in your voice — not AI's. No account needed.",
    images: ["https://ozigi.app/opengraph-image.png"],
  },
  alternates: { canonical: "https://ozigi.app/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

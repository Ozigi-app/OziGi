import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Write for Ozigi — Contributor Program",
  description:
    "We publish practical, no-fluff pieces from practitioners. If you build in public, work in DevRel, or think seriously about content and AI — we want to hear from you.",
  openGraph: {
    title: "Write for Ozigi — Contributor Program",
    description:
      "Share what you know. We publish pieces from practitioners who build, ship, and create — not marketers writing about marketing.",
    url: "https://ozigi.app/write",
    siteName: "Ozigi",
    type: "website",
    images: [
      {
        url: "https://ozigi.app/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Write for Ozigi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Write for Ozigi — Contributor Program",
    description: "Practical pieces from people who actually build and create. Apply to contribute.",
    images: ["https://ozigi.app/opengraph-image.png"],
  },
  alternates: { canonical: "https://ozigi.app/write" },
};

export default function WriteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

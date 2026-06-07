import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free for Small Teams, Scale When Ready",
  description:
    "Ozigi is free to start. Find leads, run email and LinkedIn outreach, and publish content that sounds human — upgrade for more volume when you're ready.",
  keywords: [
    "Ozigi pricing",
    "free lead generation tools",
    "free outreach platform for small teams",
    "affordable content marketing tools",
    "free LinkedIn outreach tool",
    "free email campaign software",
    "small business outreach tools",
  ],
  openGraph: {
    title: "Pricing — Free for Small Teams, Scale When Ready",
    description:
      "Find leads, run outreach, and publish content that sounds human — free to start. Upgrade when you need more volume.",
    url: "https://ozigi.app/pricing",
    siteName: "Ozigi",
    type: "website",
    images: [
      {
        url: "https://ozigi.app/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Ozigi Pricing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Free for Small Teams, Scale When Ready",
    description: "Find leads, run outreach, and publish content that sounds human — free for small teams.",
    images: ["https://ozigi.app/opengraph-image.png"],
  },
  alternates: { canonical: "https://ozigi.app/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

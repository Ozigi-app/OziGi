import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free GTM Suite, Upgrade When You Scale",
  description:
    "Ozigi is free. LinkedIn outreach, email campaigns, and AI content generation at no cost. Upgrade for unlimited usage and advanced features when you're ready to scale.",
  keywords: [
    "Ozigi pricing",
    "free GTM tools",
    "free outreach platform",
    "go-to-market tools pricing",
    "affordable startup marketing",
    "free LinkedIn outreach tool",
    "free email campaign software",
  ],
  openGraph: {
    title: "Pricing — Free GTM Suite, Upgrade When You Scale",
    description:
      "Free LinkedIn outreach, email campaigns, and AI content. Upgrade when you're ready to scale.",
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
    title: "Pricing — Free GTM Suite, Upgrade When You Scale",
    description: "Free outreach, campaigns, and AI content. Upgrade when you're ready to scale.",
    images: ["https://ozigi.app/opengraph-image.png"],
  },
  alternates: { canonical: "https://ozigi.app/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

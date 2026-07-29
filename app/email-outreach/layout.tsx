import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Free AI Cold Email Generator — Emails That Get Replies | Ozigi" },
  description:
    "Generate a personalised cold email in seconds, no sign-up required. Then start a free account (no credit card) to find verified leads and send up to 30 real emails a month on autopilot, with replies tracked automatically.",
  openGraph: {
    title: "Free Cold Email Generator | Ozigi",
    description:
      "Generate a personalised cold email free, no sign-up required. Then start a free account to find leads and send up to 30 real emails a month on autopilot.",
    type: "website",
    url: "https://ozigi.app/email-outreach",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Cold Email Generator | Ozigi",
    description:
      "Generate a personalised cold email free, no sign-up required. Then start a free account to find leads and send up to 30 real emails a month on autopilot.",
  },
  alternates: {
    canonical: "https://ozigi.app/email-outreach",
  },
};

export default function EmailOutreachLayout({ children }: { children: React.ReactNode }) {
  return children;
}

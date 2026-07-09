import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Cold Email Generator — Find Leads & Send Real Emails on Autopilot | Ozigi",
  description:
    "Generate a personalised cold email in seconds, no sign-up required. Then start a free account (no credit card) to find verified leads and send up to 30 real emails a month on autopilot, with replies tracked automatically.",
  keywords: [
    "free cold email generator",
    "send cold emails for free",
    "cold email generator",
    "AI cold email writer",
    "cold email template generator",
    "free cold email tool",
    "sales email generator AI",
    "B2B cold email generator",
    "outreach email writer",
    "cold outreach email AI",
    "personalised cold email generator",
    "automated cold outreach",
    "cold email subject line generator",
    "B2B lead generation email tool",
  ],
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

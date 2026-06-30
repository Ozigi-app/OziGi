import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI Cold Email Generator — Find Leads, Write Emails & Send on Autopilot | Ozigi",
  description:
    "Generate personalised cold emails in seconds — then let Ozigi find the leads, send at scale, and track replies automatically. No templates, no placeholders. Try the email generator free, no sign-up required.",
  keywords: [
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
    title: "Free AI Cold Email Generator | Ozigi",
    description:
      "Generate personalised cold emails in seconds — then let Ozigi find the leads, send at scale, and track replies automatically. Try free, no sign-up required.",
    type: "website",
    url: "https://ozigi.app/email-outreach",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Cold Email Generator | Ozigi",
    description:
      "Generate personalised cold emails in seconds — then let Ozigi find the leads, send at scale, and track replies automatically.",
  },
  alternates: {
    canonical: "https://ozigi.app/email-outreach",
  },
};

export default function EmailOutreachLayout({ children }: { children: React.ReactNode }) {
  return children;
}

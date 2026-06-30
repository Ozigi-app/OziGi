import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI Cold Email Generator — Write Cold Emails That Get Replies | Ozigi",
  description:
    "Generate personalised cold emails that get responses, not spam reports. Describe your product and target — get a tailored subject line and email body in seconds. No templates, no placeholders. Try free.",
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
    "email copywriting AI",
    "cold email subject line generator",
  ],
  openGraph: {
    title: "Free AI Cold Email Generator | Ozigi",
    description:
      "Stop sending ignored emails. Generate personalised cold emails with compelling subject lines — specific to your product and target. Try free, no sign-up required.",
    type: "website",
    url: "https://ozigi.app/email-outreach",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Cold Email Generator | Ozigi",
    description:
      "Stop sending ignored emails. Generate personalised cold emails with compelling subject lines — specific to your product and target.",
  },
  alternates: {
    canonical: "https://ozigi.app/email-outreach",
  },
};

export default function EmailOutreachLayout({ children }: { children: React.ReactNode }) {
  return children;
}

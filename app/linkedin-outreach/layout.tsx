import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI LinkedIn Message Generator — Connection Requests & DMs That Get Accepted | Ozigi",
  description:
    "Generate LinkedIn connection requests and direct messages that don't get ignored. Describe who you're reaching out to — get a personalised, under-the-limit message in seconds. Try free, no sign-up required.",
  keywords: [
    "LinkedIn message generator",
    "AI LinkedIn outreach tool",
    "LinkedIn connection request generator",
    "LinkedIn DM generator AI",
    "free LinkedIn message writer",
    "LinkedIn cold outreach generator",
    "LinkedIn prospecting tool",
    "personalised LinkedIn message AI",
    "LinkedIn connection note generator",
    "B2B LinkedIn outreach AI",
    "LinkedIn sales message generator",
  ],
  openGraph: {
    title: "Free AI LinkedIn Message Generator | Ozigi",
    description:
      "Write LinkedIn connection requests and DMs that get accepted. Personalised to your product and target — under the character limit. Try free, no sign-up required.",
    type: "website",
    url: "https://ozigi.app/linkedin-outreach",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI LinkedIn Message Generator | Ozigi",
    description:
      "Write LinkedIn connection requests and DMs that get accepted. Personalised to your product and target — under the character limit.",
  },
  alternates: {
    canonical: "https://ozigi.app/linkedin-outreach",
  },
};

export default function LinkedInOutreachLayout({ children }: { children: React.ReactNode }) {
  return children;
}

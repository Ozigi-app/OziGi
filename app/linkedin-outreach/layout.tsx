import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI LinkedIn Message Generator — Find Leads, Connect at Scale & Close on Autopilot | Ozigi",
  description:
    "Write LinkedIn connection requests that get accepted — then let Ozigi find the profiles, connect at scale, and follow up automatically once they accept. Try the message generator free, no sign-up required.",
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
    "automated LinkedIn outreach",
    "LinkedIn lead generation tool",
  ],
  openGraph: {
    title: "Free AI LinkedIn Message Generator | Ozigi",
    description:
      "Write LinkedIn connection requests that get accepted — then let Ozigi find the profiles, connect at scale, and follow up automatically. Try free, no sign-up required.",
    type: "website",
    url: "https://ozigi.app/linkedin-outreach",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI LinkedIn Message Generator | Ozigi",
    description:
      "Write LinkedIn connection requests that get accepted — then let Ozigi find the profiles, connect at scale, and follow up automatically.",
  },
  alternates: {
    canonical: "https://ozigi.app/linkedin-outreach",
  },
};

export default function LinkedInOutreachLayout({ children }: { children: React.ReactNode }) {
  return children;
}

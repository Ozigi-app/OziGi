import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Free LinkedIn Message Generator — DMs & Connection Requests | Ozigi" },
  description:
    "Write LinkedIn connection requests that get accepted — then let Ozigi find the profiles, connect at scale, and follow up automatically once they accept. Try the message generator free, no sign-up required.",
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

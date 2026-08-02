import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Free LinkedIn Message Generator — DMs & Connection Requests | Ozigi" },
  description:
    "Write LinkedIn connection requests that get accepted — then let Ozigi find the profiles and send the requests from your own browser, with the follow-up drafted for you. Try the message generator free, no sign-up required.",
  openGraph: {
    title: "Free AI LinkedIn Message Generator | Ozigi",
    description:
      "Write LinkedIn connection requests that get accepted — then let Ozigi find the profiles and send the requests from your own browser. Try free, no sign-up required.",
    type: "website",
    url: "https://ozigi.app/linkedin-outreach",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI LinkedIn Message Generator | Ozigi",
    description:
      "Write LinkedIn connection requests that get accepted — then let Ozigi find the profiles and send the requests from your own browser.",
  },
  alternates: {
    canonical: "https://ozigi.app/linkedin-outreach",
  },
};

export default function LinkedInOutreachLayout({ children }: { children: React.ReactNode }) {
  return children;
}

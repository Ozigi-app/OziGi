import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI Newsletter Generator — Write Email Newsletters People Actually Open | Ozigi",
  description:
    "Generate a full email newsletter issue — hook, body, actionable takeaway, and a subject line that earns opens — from just a topic and key points. 400–600 words in seconds. Try free, no sign-up required.",
  keywords: [
    "AI newsletter generator",
    "email newsletter writer AI",
    "newsletter content generator free",
    "AI email newsletter tool",
    "newsletter subject line generator",
    "email newsletter AI writer",
    "newsletter writing tool",
    "automated newsletter generator",
    "email newsletter creator AI",
    "free newsletter writer",
    "B2B newsletter generator",
    "content marketing newsletter AI",
  ],
  openGraph: {
    title: "Free AI Newsletter Generator | Ozigi",
    description:
      "Turn a topic into a full newsletter issue — subject line, hook, body, and takeaway — in seconds. Conversational, opinionated, or analytical. Try free, no sign-up required.",
    type: "website",
    url: "https://ozigi.com/newsletter",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Newsletter Generator | Ozigi",
    description:
      "Turn a topic into a full newsletter issue — subject line, hook, body, and takeaway — in seconds. Conversational, opinionated, or analytical.",
  },
  alternates: {
    canonical: "https://ozigi.com/newsletter",
  },
};

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

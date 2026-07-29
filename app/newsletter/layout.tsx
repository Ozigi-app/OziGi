import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Free AI Newsletter Generator — Full Issues in Your Voice | Ozigi" },
  description:
    "Generate a full email newsletter issue — hook, body, actionable takeaway, and a subject line that earns opens — from just a topic and key points. 400–600 words in seconds. Try free, no sign-up required.",
  openGraph: {
    title: "Free AI Newsletter Generator | Ozigi",
    description:
      "Turn a topic into a full newsletter issue — subject line, hook, body, and takeaway — in seconds. Conversational, opinionated, or analytical. Try free, no sign-up required.",
    type: "website",
    url: "https://ozigi.app/newsletter",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Newsletter Generator | Ozigi",
    description:
      "Turn a topic into a full newsletter issue — subject line, hook, body, and takeaway — in seconds. Conversational, opinionated, or analytical.",
  },
  alternates: {
    canonical: "https://ozigi.app/newsletter",
  },
};

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

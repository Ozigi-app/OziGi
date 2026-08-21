import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New LinkedIn Campaign",
  robots: { index: false, follow: false },
};

export default function NewLinkedInCampaignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

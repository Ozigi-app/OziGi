import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Outreach Campaign",
  robots: { index: false, follow: false },
};

export default function NewCampaignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

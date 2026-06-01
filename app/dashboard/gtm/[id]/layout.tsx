import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campaign",
  robots: { index: false, follow: false },
};

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

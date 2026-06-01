import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LinkedIn Outreach",
  robots: { index: false, follow: false },
};

export default function LinkedInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

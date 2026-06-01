import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GTM Settings",
  robots: { index: false, follow: false },
};

export default function GtmSettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

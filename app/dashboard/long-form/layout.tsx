import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Long-form Content",
  robots: { index: false, follow: false },
};

export default function LongFormLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

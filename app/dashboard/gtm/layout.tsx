import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "GTM Suite",
    template: "%s | Ozigi",
  },
  robots: { index: false, follow: false },
};

// GTM sub-pages live inside the dashboard route tree but don't have their own
// sidebar — navigation is handled by GtmPageHeader on each page.
export default function GtmLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

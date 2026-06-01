import type { Metadata } from "next";
import ForceLightTheme from "@/components/dashboard/ForceLightTheme";

export const metadata: Metadata = {
  title: {
    default: "Dashboard | Ozigi",
    template: "%s | Ozigi",
  },
  description: "Your Ozigi GTM dashboard — run outreach campaigns, generate content, and manage your go-to-market from one place.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ForceLightTheme />
      {children}
    </>
  );
}

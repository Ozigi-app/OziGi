import type { Metadata } from "next";
import ForceLightTheme from "@/components/dashboard/ForceLightTheme";

export const metadata: Metadata = {
  title: "Dashboard — Ozigi",
  description: "Your Ozigi dashboard.",
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

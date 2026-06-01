"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PricingCards from "@/components/PricingCards";
import AuthModal from "@/components/AuthModal";

export default function PricingPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#fafafa] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600">Loading pricing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#fafafa] min-h-screen flex flex-col">
      <Header
        session={session}
        onSignIn={() => setIsAuthModalOpen(true)}
        onOpenMobileSidebar={() => {}}
      />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              No credit card required to start. Starter users can add GTM credits without upgrading.
            </p>
          </div>
          <PricingCards onOpenAuthModal={() => setIsAuthModalOpen(true)} />
        </div>
      </main>
      <Footer />
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
    </div>
  );
}
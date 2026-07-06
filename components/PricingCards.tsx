"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Check, Minus } from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

interface FeatureItem {
  text: string;
  included: boolean;
}

interface FeatureSection {
  label: "Outreach" | "Content";
  items: FeatureItem[];
}

interface PricingTier {
  name: string;
  highlight: string;
  priceMonthly: number | null;
  priceYearly: number | null;
  badge?: string;
  buttonText: string;
  planId: "free" | "starter" | "growth" | "pro" | "enterprise";
  popular?: boolean;
  sections: FeatureSection[];
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    highlight: "Find leads, run outreach, and publish content — before you pay.",
    priceMonthly: 0,
    priceYearly: 0,
    buttonText: "Start for free",
    planId: "free",
    sections: [
      {
        label: "Outreach",
        items: [
          { text: "50 credits/mo (1 lead scraped + scored)", included: true },
          { text: "1 active campaign", included: true },
          { text: "30 sequence sends/mo (email only)", included: true },
          { text: "Reply detection", included: true },
          { text: "LinkedIn outreach", included: false },
          { text: "CRM sync", included: false },
        ],
      },
      {
        label: "Content",
        items: [
          { text: "3 content campaigns/mo", included: true },
          { text: "1 long-form article/mo", included: true },
          { text: "1 saved persona", included: true },
          { text: "X, LinkedIn, Discord publishing", included: true },
          { text: "Newsletter generation", included: true },
          { text: "Newsletter sending", included: false },
          { text: "Image generation", included: false },
          { text: "Scheduling", included: false },
          { text: "Ozigi Copilot", included: false },
        ],
      },
    ],
  },
  {
    name: "Starter",
    highlight: "The full content engine. Add outreach credits when you need them.",
    priceMonthly: 19,
    priceYearly: 182,
    buttonText: "Get Starter",
    planId: "starter",
    sections: [
      {
        label: "Outreach",
        items: [
          { text: "No outreach (buy credit bundles below)", included: false },
        ],
      },
      {
        label: "Content",
        items: [
          { text: "30 content campaigns/mo", included: true },
          { text: "1 long-form article/mo", included: true },
          { text: "Unlimited personas", included: true },
          { text: "All platforms (X, LinkedIn, Discord, Slack)", included: true },
          { text: "Newsletter generation + 500 sends/mo", included: true },
          { text: "Image generation (2/campaign)", included: true },
          { text: "Scheduling + X email reminder", included: true },
          { text: "Ozigi Copilot", included: false },
        ],
      },
    ],
  },
  {
    name: "Growth",
    highlight: "Active outbound for founders doing serious pipeline work.",
    priceMonthly: 29,
    priceYearly: 278,
    buttonText: "Get Growth",
    planId: "growth",
    sections: [
      {
        label: "Outreach",
        items: [
          { text: "1,000 credits/mo", included: true },
          { text: "Unlimited active campaigns", included: true },
          { text: "Unlimited sequence sends", included: true },
          { text: "Email + LinkedIn outreach", included: true },
          { text: "CRM sync (HubSpot, Zoho, Salesforce)", included: true },
          { text: "Reply detection", included: true },
          { text: "Multi-inbox rotation", included: false },
        ],
      },
      {
        label: "Content",
        items: [
          { text: "10 content campaigns/mo", included: true },
          { text: "1 long-form article/mo", included: true },
          { text: "2 saved personas", included: true },
          { text: "All platforms", included: true },
          { text: "Newsletter generation", included: true },
          { text: "Newsletter sending", included: false },
          { text: "Image generation", included: false },
          { text: "Ozigi Copilot", included: false },
        ],
      },
    ],
  },
  {
    name: "Pro",
    highlight: "Both engines, no limits. The full product.",
    priceMonthly: 49,
    priceYearly: 470,
    badge: "Most popular",
    buttonText: "Get Pro",
    planId: "pro",
    popular: true,
    sections: [
      {
        label: "Outreach",
        items: [
          { text: "Unlimited credits", included: true },
          { text: "Unlimited active campaigns", included: true },
          { text: "Unlimited sequence sends", included: true },
          { text: "Email + LinkedIn outreach", included: true },
          { text: "CRM sync (HubSpot, Zoho, Salesforce)", included: true },
          { text: "Multi-inbox rotation", included: true },
          { text: "Reply detection", included: true },
        ],
      },
      {
        label: "Content",
        items: [
          { text: "Unlimited campaigns + long-form articles", included: true },
          { text: "Unlimited personas", included: true },
          { text: "All platforms + Slack", included: true },
          { text: "Newsletter generation + unlimited sending", included: true },
          { text: "Unlimited image generation", included: true },
          { text: "Scheduling + X email reminder", included: true },
          { text: "Ozigi Copilot (full context)", included: true },
          { text: "Subscriber list management", included: true },
          { text: "Campaign analytics", included: true },
          { text: "Priority model access + early access features", included: true },
        ],
      },
    ],
  },
  {
    name: "Enterprise",
    highlight: "Custom volume, SLA, white-label, and dedicated support.",
    priceMonthly: null,
    priceYearly: null,
    buttonText: "Contact Sales",
    planId: "enterprise",
    sections: [
      {
        label: "Outreach",
        items: [
          { text: "Everything in Pro", included: true },
          { text: "Custom credit + send volume", included: true },
          { text: "Custom integrations (coming soon)", included: true },
        ],
      },
      {
        label: "Content",
        items: [
          { text: "Everything in Pro", included: true },
          { text: "Custom persona library", included: true },
          { text: "White-label option", included: true },
          { text: "Dedicated onboarding + SLA", included: true },
          { text: "Roadmap input + priority support", included: true },
          { text: "Dedicated Slack channel", included: true },
        ],
      },
    ],
  },
];

// Yearly savings vs paying monthly
const yearlySavings: Record<string, number> = {
  starter: 19 * 12 - 182,  // $46
  growth:  29 * 12 - 278,  // $70
  pro:     49 * 12 - 470,  // $118
};

// ─── CreditBundles ────────────────────────────────────────────────────────────

interface CreditBundle {
  id: "small" | "medium" | "large";
  credits: number;
  price: number;
}

const bundles: CreditBundle[] = [
  { id: "small",  credits: 200,   price: 5  },
  { id: "medium", credits: 500,   price: 10 },
  { id: "large",  credits: 1500,  price: 25 },
];

function CreditBundles({ onOpenAuthModal }: { onOpenAuthModal?: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (bundle: CreditBundle["id"]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      onOpenAuthModal?.();
      return;
    }
    setLoading(bundle);
    try {
      const res = await fetch("/api/create-bundle-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error("Failed to start checkout. Please try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-16 px-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-black italic uppercase tracking-tighter text-foreground mb-1">
          Outreach Credit Bundles
        </h3>
        <p className="text-sm text-foreground-subtle">
          For Starter users who want to reach more people without upgrading — credits stack on top of your plan and never expire.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {bundles.map((b) => (
          <div
            key={b.id}
            className="rounded-xl p-5 flex flex-col items-center text-center"
            style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}
          >
            <span className="text-xs font-bold uppercase tracking-widest text-foreground-subtle mb-2 capitalize">
              {b.id}
            </span>
            <span className="text-3xl font-black text-foreground mb-0.5">{b.credits.toLocaleString()}</span>
            <span className="text-xs text-foreground-subtle mb-3">credits</span>
            <span className="text-lg font-black text-foreground mb-4">${b.price}</span>
            <button
              onClick={() => handleBuy(b.id)}
              disabled={loading === b.id}
              className="w-full py-2 rounded-lg font-bold uppercase tracking-widest text-xs transition-all disabled:opacity-50"
              style={{ background: "rgba(15,23,42,0.05)", border: "1px solid #E2E8F0" }}
            >
              {loading === b.id ? "Loading…" : "Buy credits"}
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-foreground-subtle">
        Bundle credits stack on top of your monthly plan. Large bundle ($25) + Starter ($19) = $44 —{" "}
        <span className="font-semibold text-foreground">almost Pro</span>. Upgrade and get unlimited everything for $5 more.
      </p>
    </div>
  );
}

// ─── PricingCards ─────────────────────────────────────────────────────────────

interface PricingCardsProps {
  onOpenAuthModal?: () => void;
}

export default function PricingCards({ onOpenAuthModal }: PricingCardsProps) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const router = useRouter();

  const handleUpgrade = async (planId: string) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (planId === "free") {
      if (!session) { onOpenAuthModal?.(); return; }
      router.push("/dashboard");
      return;
    }

    if (planId === "enterprise") {
      window.location.href = "mailto:hello@ozigi.app?subject=Enterprise Inquiry";
      return;
    }

    if (!session) { onOpenAuthModal?.(); return; }

    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, interval: billingInterval }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error("Failed to create checkout. Please try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex justify-center mb-10">
        <div
          className="inline-flex rounded-full p-1"
          style={{ background: "rgba(15,23,42,0.06)", border: "1px solid rgba(15,23,42,0.12)" }}
        >
          {(["monthly", "yearly"] as const).map((interval) => (
            <button
              key={interval}
              onClick={() => setBillingInterval(interval)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${
                billingInterval === interval
                  ? "bg-brand-navy text-white"
                  : "text-foreground-subtle hover:text-foreground"
              }`}
            >
              {interval}
              {interval === "yearly" && (
                <span className="ml-1 text-[10px] font-semibold text-green-600">Save 20%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-7xl mx-auto items-start">
        {tiers.map((tier) => {
          const isPopular = tier.popular === true;
          const isFree = tier.planId === "free";
          const isEnterprise = tier.planId === "enterprise";

          const price =
            billingInterval === "monthly" ? tier.priceMonthly : tier.priceYearly;
          const monthlyEquiv =
            billingInterval === "yearly" && tier.priceYearly !== null
              ? Math.round(tier.priceYearly / 12)
              : null;
          const saving =
            billingInterval === "yearly" ? yearlySavings[tier.planId] : undefined;

          const priceDisplay =
            price === null ? "Custom" : price === 0 ? "Free" : `$${price}`;
          const period =
            billingInterval === "monthly" ? "/mo" : "/yr";

          return (
            <div
              key={tier.name}
              className={`rounded-xl p-4 md:p-5 flex flex-col h-full transition-all ${
                isPopular
                  ? "ring-2 ring-brand-red shadow-2xl md:scale-105 z-10"
                  : "hover:shadow-md"
              }`}
              style={
                isPopular
                  ? { background: "#0A1628", border: "1px solid rgba(232,50,10,0.35)" }
                  : { background: "#FFFFFF", border: "1px solid #E2E8F0" }
              }
            >
              {/* Badge */}
              {tier.badge && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest bg-brand-red text-white px-2 py-0.5 rounded-full self-start mb-3">
                  {tier.badge}
                </span>
              )}

              {/* Name */}
              <h3
                className={`text-base font-black italic uppercase tracking-tighter mb-1 ${
                  isPopular ? "text-white" : "text-foreground"
                }`}
              >
                {tier.name}
              </h3>

              {/* Price */}
              <div className="mb-1">
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-2xl font-black ${isPopular ? "text-white" : "text-foreground"}`}
                  >
                    {priceDisplay}
                  </span>
                  {!isFree && !isEnterprise && price !== null && (
                    <span className={`text-xs ${isPopular ? "text-slate-400" : "text-foreground-subtle"}`}>
                      {period}
                    </span>
                  )}
                </div>
                {monthlyEquiv !== null && !isFree && !isEnterprise && (
                  <p className={`text-[10px] ${isPopular ? "text-slate-400" : "text-foreground-subtle"}`}>
                    ~${monthlyEquiv}/mo
                    {saving ? (
                      <span className="ml-1 text-green-500 font-semibold">· Save ~${saving}</span>
                    ) : null}
                  </p>
                )}
              </div>

              {/* Highlight */}
              <p className={`text-[11px] leading-snug mb-3 ${isPopular ? "text-slate-400" : "text-foreground-subtle"}`}>
                {tier.highlight}
              </p>

              <hr className={`mb-3 ${isPopular ? "border-white/10" : "border-border"}`} />

              {/* Feature sections */}
              <div className="flex-1 space-y-3 mb-4">
                {tier.sections.map((section) => (
                  <div key={section.label}>
                    <span
                      className={`block text-[9px] font-black uppercase tracking-widest mb-1.5 ${
                        isPopular ? "text-slate-500" : "text-foreground-subtle"
                      }`}
                    >
                      {section.label}
                    </span>
                    <ul className="space-y-1.5">
                      {section.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                          {item.included ? (
                            <Check
                              size={12}
                              className="text-brand-red shrink-0 mt-0.5"
                            />
                          ) : (
                            <Minus
                              size={12}
                              className="shrink-0 mt-0.5"
                              style={{ color: isPopular ? "#475569" : "#CBD5E1" }}
                            />
                          )}
                          <span
                            className={
                              item.included
                                ? isPopular
                                  ? "text-slate-300"
                                  : "text-foreground-muted"
                                : isPopular
                                ? "text-slate-600"
                                : "text-slate-400"
                            }
                          >
                            {item.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => handleUpgrade(tier.planId)}
                className={`w-full py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all ${
                  isPopular
                    ? "bg-brand-red text-white hover:bg-brand-red-dark"
                    : "text-foreground hover:bg-surface-2"
                }`}
                style={
                  !isPopular
                    ? { background: "rgba(15,23,42,0.05)", border: "1px solid #E2E8F0" }
                    : {}
                }
              >
                {tier.buttonText}
              </button>
            </div>
          );
        })}
      </div>

      {/* Credit bundles */}
      <CreditBundles onOpenAuthModal={onOpenAuthModal} />

      {/* PLG line */}
      <p className="text-center text-xs text-foreground-subtle mt-8">
        Free plan includes a real outbound campaign and 3 content runs — no credit card required.
      </p>
    </div>
  );
}

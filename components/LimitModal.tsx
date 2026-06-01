"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

type LimitReason = "content_limit" | "gtm_limit" | "feature_gate";

interface LimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: LimitReason;
}

const COPY: Record<LimitReason, { heading: string; body: string }> = {
  content_limit: {
    heading: "Content limit reached",
    body: "You've used all your content campaigns for this month. Upgrade to Pro for unlimited campaigns, long-form articles, and image generation.",
  },
  gtm_limit: {
    heading: "GTM limit reached",
    body: "You've used your available credits or campaign slots. Upgrade to Growth or Pro for more credits and unlimited campaigns.",
  },
  feature_gate: {
    heading: "Feature not available on your plan",
    body: "This feature requires a higher plan. See the full comparison at /pricing to find the right fit.",
  },
};

export default function LimitModal({ isOpen, onClose, reason }: LimitModalProps) {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/user/stats")
        .then(r => r.ok ? r.json() : null)
        .then(data => { setStats(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const { heading, body } = COPY[reason];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border-4 border-slate-900"
        >
          {/* Header */}
          <div className="bg-slate-900 p-6 text-white">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">{heading}</h2>
            <p className="text-slate-300 mt-2 text-sm font-medium">{body}</p>
          </div>

          {/* Stats */}
          <div className="p-6 border-b border-slate-100">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-2xl font-black text-slate-900">
                  {loading ? "—" : (stats?.campaignsGenerated ?? "—")}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Campaigns</div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">
                  {loading ? "—" : (stats?.personasSaved ?? "—")}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Personas</div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">
                  {loading ? "—" : (stats?.creditsUsed ?? "—")}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Credits Used</div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">
                  {loading ? "—" : (stats?.postsPublished ?? "—")}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Posts</div>
              </div>
            </div>
          </div>

          {/* What's locked vs kept */}
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-lg mt-0.5">●</span>
              <div>
                <p className="font-bold text-slate-900">Without upgrading</p>
                <p className="text-xs text-slate-500">
                  New generation locked · Additional campaigns locked · Premium features locked
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-500 text-lg mt-0.5">●</span>
              <div>
                <p className="font-bold text-slate-900">Always kept</p>
                <p className="text-xs text-slate-500">
                  Your saved personas · Your campaign history · Your account and data
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 bg-slate-50 space-y-3">
            <button
              onClick={() => router.push('/pricing')}
              className="block w-full bg-slate-900 text-white text-center py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-colors"
            >
              See all plans →
            </button>
            <button
              onClick={onClose}
              className="w-full text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800 font-medium"
            >
              Continue on current plan
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

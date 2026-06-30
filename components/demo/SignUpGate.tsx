"use client";
import { motion } from "framer-motion";
import { Zap, CheckCircle2 } from "lucide-react";

export function SignUpGate({
  onSignUp,
  onViewResult,
  toolName,
}: {
  onSignUp: () => void;
  onViewResult: () => void;
  toolName: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-3xl shadow-2xl border border-slate-100 px-8 py-12 max-w-lg mx-auto text-center"
    >
      <div className="w-14 h-14 bg-[#E8320A] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
        <Zap className="w-7 h-7 text-white" />
      </div>

      <h2 className="text-[#0A1628] font-black italic uppercase tracking-tighter text-3xl mb-3 leading-tight">
        That's what real output looks like.
        <br />
        <span className="text-[#E8320A]">Save it for free.</span>
      </h2>

      <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
        Create a free account to save your {toolName}, run unlimited generations, and manage everything from your dashboard.
      </p>

      <button
        onClick={onSignUp}
        className="block w-full bg-[#E8320A] hover:bg-[#C5280A] text-white font-black uppercase tracking-widest text-sm px-6 py-4 rounded-xl transition-all active:scale-[0.98] mb-4 shadow-lg"
      >
        Create Free Account →
      </button>

      <ul className="flex flex-col gap-2 text-xs text-slate-500 mb-6">
        {["Unlimited generations", "No credit card required", "Full dashboard access"].map((item) => (
          <li key={item} className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#E8320A] shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      <button
        onClick={onViewResult}
        className="text-sm text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors"
      >
        View what was generated
      </button>
    </motion.div>
  );
}

export function PostGenerationBanner({ onSignUp }: { onSignUp: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="mt-8 rounded-2xl bg-[#0A1628] border-l-4 border-[#E8320A] px-8 py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
    >
      <div>
        <p className="text-white font-black italic uppercase tracking-tighter text-xl md:text-2xl mb-2">
          Want to save this and run more?
        </p>
        <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
          Sign up free to save this output, generate unlimited versions, and access your full dashboard.
        </p>
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <button
          onClick={onSignUp}
          className="bg-[#E8320A] hover:bg-[#C5280A] text-white font-black uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-all active:scale-[0.98] whitespace-nowrap shadow-lg"
        >
          Sign Up Free →
        </button>
        <p className="text-slate-500 text-xs text-center">No credit card. Always free to start.</p>
      </div>
    </motion.div>
  );
}

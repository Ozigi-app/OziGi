"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const SAMPLES = [
  {
    label: "GitHub release notes",
    value: `We just shipped Ozigi v1.2. Key changes:\n- Added Firecrawl URL scraping for faster context extraction\n- Expanded Banned Lexicon to 8 categories including Gemini-specific patterns\n- Fixed scheduling edge case where X reminders weren't firing at the correct timezone\n- Email newsletter generation now runs independently of campaign posts`,
  },
  {
    label: "Product update",
    value: `Ozigi now supports Slack webhooks. You can publish directly to your Slack workspace the same way Discord works — paste your webhook URL in Settings and your campaign drafts route there automatically. Took us about a day to build. The hardest part was the formatting rules — Slack markdown is different from Discord in a few annoying ways.`,
  },
  {
    label: "Blog post URL",
    value: `https://blog.ozigi.app/blog/your-launch-post-got-4-likes`,
  },
];

export function LandingDemoWidget() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-expand textarea */
  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    autoResize(e.target);
  };

  const handleSample = (value: string) => {
    setInput(value);
    // Expand after state update
    requestAnimationFrame(() => {
      if (textareaRef.current) autoResize(textareaRef.current);
    });
  };

  const handleGenerate = () => {
    if (!input.trim()) return;
    setLoading(true);
    sessionStorage.setItem("ozigi_landing_demo_input", input.trim());
    router.push("/demo?from=landing");
  };

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        background: "#ffffff",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1)",
      }}>

      {/* Title bar — echoes the Mac chrome from the hero */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] font-semibold text-slate-400">ozigi.app — live demo</span>
      </div>

      <div className="p-3">
        {/* Inline row: textarea + button on the same line */}
        <div className="flex items-stretch gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            placeholder="Paste a URL, notes, or idea..."
            rows={1}
            className="flex-1 text-sm text-left text-slate-800 placeholder:text-slate-400
                       bg-slate-50 border border-slate-200 rounded-lg px-3 py-2
                       overflow-hidden resize-none focus:outline-none
                       focus:border-[#E8320A]/50 focus:ring-2 focus:ring-[#E8320A]/10
                       transition-all duration-200 leading-snug"
            style={{ minHeight: "2.25rem" }}
          />

          <button
            onClick={handleGenerate}
            disabled={!input.trim() || loading}
            className="shrink-0 px-4 disabled:opacity-40
                       text-white font-black uppercase tracking-widest text-[11px] rounded-lg
                       transition-all duration-300 active:scale-[0.98]
                       flex items-center justify-center gap-2"
            style={{
              background: !input.trim() || loading
                ? "#E8320A"
                : "linear-gradient(135deg, #E8320A 0%, #c52000 100%)",
              boxShadow: input.trim() && !loading ? "0 8px 24px rgba(232,50,10,0.35)" : "none",
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="hidden sm:inline">Taking you there...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Generate ⚡</span>
                <span className="sm:hidden">⚡</span>
              </>
            )}
          </button>
        </div>

        {/* Sample pills */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Try:
          </span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => handleSample(s.value)}
              className="text-[10px] font-bold text-slate-500 border border-slate-200
                         rounded-full px-2.5 py-0.5 hover:border-[#E8320A] hover:text-[#E8320A]
                         transition-colors duration-200"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

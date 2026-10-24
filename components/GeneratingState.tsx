"use client";
import { useState, useEffect, useMemo } from "react";
import { PLATFORMS } from "@/lib/platforms";

// `only` limits a step to generations that include one of those platforms.
// Steps without `only` are shown for every generation.
const SOCIAL_PLATFORMS: string[] = [PLATFORMS.X, PLATFORMS.LINKEDIN, PLATFORMS.DISCORD, PLATFORMS.SLACK];

const GENERATION_MESSAGES: { text: string; duration: number; only?: string[] }[] = [
  { text: "Analyzing your source material...", duration: 3000 },
  { text: "Extracting key narratives...", duration: 4000 },
  { text: "Applying your persona voice...", duration: 5000 },
  { text: "Drafting platform-specific posts...", duration: 6000, only: SOCIAL_PLATFORMS },
  { text: "Generating X thread...", duration: 5000, only: [PLATFORMS.X] },
  { text: "Writing LinkedIn post...", duration: 5000, only: [PLATFORMS.LINKEDIN] },
  { text: "Building Discord announcement...", duration: 4000, only: [PLATFORMS.DISCORD] },
  { text: "Composing email newsletter...", duration: 5000, only: [PLATFORMS.EMAIL] },
  { text: "Running the slop filter...", duration: 5000 },
  { text: "Scanning for AI tells...", duration: 4000 },
  { text: "Re-running if any slop slipped through...", duration: 8000 },
  { text: "Almost there...", duration: 10000 },
];

interface GeneratingStateProps {
  /** Platforms being generated. When omitted, every step is shown. */
  platforms?: readonly string[];
}

export default function GeneratingState({ platforms }: GeneratingStateProps = {}) {
  const platformKey = platforms ? platforms.join(",") : "";
  const messages = useMemo(() => {
    if (!platformKey) return GENERATION_MESSAGES;
    const active = platformKey.split(",");
    return GENERATION_MESSAGES.filter((m) => !m.only || m.only.some((p) => active.includes(p)));
  }, [platformKey]);

  const [rawIndex, setCurrentIndex] = useState(0);
  const currentIndex = rawIndex % messages.length;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        // Slow down as we approach 90%
        if (prev >= 90) return Math.min(prev + 0.1, 95);
        if (prev >= 70) return prev + 0.3;
        if (prev >= 50) return prev + 0.5;
        return prev + 1;
      });
    }, 500);

    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    // Cycle through messages
    const messageTimeout = setTimeout(() => {
      setCurrentIndex((currentIndex + 1) % messages.length);
    }, messages[currentIndex].duration);

    return () => clearTimeout(messageTimeout);
  }, [currentIndex, messages]);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Animated logo/icon */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center ring-2 ring-brand-red/30 animate-pulse">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Ozigi" className="w-12 h-12 object-contain" />
        </div>
        {/* Orbiting dots */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: "4s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-2 h-2 bg-brand-red rounded-full" />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: "6s", animationDirection: "reverse" }}>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 w-1.5 h-1.5 bg-red-400 rounded-full" />
        </div>
      </div>

      {/* Status message with typewriter effect */}
      <div className="h-8 flex items-center justify-center mb-6">
        <p
          key={currentIndex}
          className="text-lg font-semibold text-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          {messages[currentIndex].text}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-4">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-red to-red-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Progress percentage */}
      <p className="text-sm text-slate-500 font-medium">
        {Math.round(progress)}% complete
      </p>

      {/* Subtle tip */}
      <p className="mt-8 text-xs text-slate-400 max-w-sm text-center leading-relaxed">
        Every draft runs through Ozigi&apos;s banned-lexicon validator before it reaches you.
        If we catch AI slop, we regenerate once. That&apos;s why this can take a beat longer
        than other tools &mdash; the output won&apos;t read like ChatGPT.
      </p>
    </div>
  );
}

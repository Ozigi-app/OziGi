"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  /** "icon" = compact circle button. "labelled" = pill with text. */
  variant?: "icon" | "labelled";
}

export default function ThemeToggle({
  className = "",
  variant = "icon",
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes is SSR-safe but resolved value is only known on the client.
  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (variant === "labelled") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        className={`inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-colors ${className}`}
      >
        {mounted ? (
          isDark ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )
        ) : (
          <Sun className="h-3.5 w-3.5 opacity-0" />
        )}
        <span>{mounted ? (isDark ? "Light" : "Dark") : ""}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground hover:border-accent hover:text-accent transition-colors ${className}`}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <Sun className="h-4 w-4 opacity-0" />
      )}
    </button>
  );
}

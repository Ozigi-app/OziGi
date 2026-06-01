import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-mono)', 'monospace'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        // Brand colors (constant across themes)
        brand: {
          navy: "#0A1628",
          red: "#E8320A",
          "red-dark": "#C4290A",
          offwhite: "#FAFAFA",
          slate: "#1E293B",
          "slate-light": "#F1F5F9",
          grey: "#94A3B8",
        },
        // Semantic tokens (light/dark aware via CSS vars)
        bg: "var(--bg)",
        "bg-deep": "var(--bg-deep)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        foreground: "var(--foreground)",
        "foreground-muted": "var(--foreground-muted)",
        "foreground-subtle": "var(--foreground-subtle)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-foreground": "var(--accent-foreground)",
        success: "var(--success)",
        warning: "var(--warning)",
        info: "var(--info)",
        // Legacy alias
        background: "var(--bg)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      animation: {
        scroll: "scroll 20s linear infinite",
      },
      keyframes: {
        scroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config;

"use client";
import { useState, useEffect, useRef } from "react";
import { motion, Variants } from "framer-motion";
import { toast } from "sonner";
import { CampaignDay } from "../lib/types";
import ScheduleModal from "./ScheduleModal";
import RichTextEditor from "./RichTextEditor";
import ScheduleEmailModal from "./ScheduleEmailModal";
import { usePlanStatus } from "@/components/hooks/usePlanStatus";
import { supabase } from "@/lib/supabase/client";
import { PLATFORMS, getApiEndpoint } from "@/lib/platforms";
import { uploadLargeAsset } from "@/lib/utils";
import { ImagePlus, X } from "lucide-react";
import {
  BUILT_IN_THEMES,
  loadCustomThemes,
  saveCustomThemes,
  hexToRgb,
  rgbToHex,
  rgbToCss,
  type CarouselTheme,
  type RGB,
} from "@/lib/carousel-themes";

// ─── LinkedIn Engagement Nudge ────────────────────────────────────────────────
function LinkedInEngagementNudge({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex items-start gap-4">
      <div className="w-8 h-8 rounded-lg bg-[#0A66C2] flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-blue-900 mb-1">
          Post is live — now engage for the next 60 minutes
        </p>
        <p className="text-xs text-blue-700 leading-relaxed">
          {"LinkedIn's 360Brew algorithm uses early engagement to decide how widely to distribute your post. Reply to every comment, respond to reactions, and stay active in the thread. Posts where the author goes quiet after publishing are deprioritised automatically."}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── LinkedIn Tips Modal ──────────────────────────────────────────────────────
function LinkedInTipsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-5">
          <h2 className="text-base font-black uppercase tracking-tighter text-slate-900">
            Getting the most out of LinkedIn in 2026
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors ml-4 flex-shrink-0"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 text-sm">
          <div>
            <p className="font-semibold text-slate-900 mb-1.5">Post natively when possible</p>
            <p className="text-slate-600 leading-relaxed">
              {"LinkedIn's 360Brew algorithm gives a small preference to content posted directly from LinkedIn.com. If reach matters, copy your post and paste it manually rather than using the OAuth publish button. The trade-off: native posting takes a few extra seconds."}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1.5">Stay active for 60 minutes after posting</p>
            <p className="text-slate-600 leading-relaxed">
              {"360Brew watches whether the author engages after posting. Reply to every comment, respond to reactions, and don't disappear. The first hour determines how widely your post gets distributed."}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1.5">Keep links out of the post body</p>
            <p className="text-slate-600 leading-relaxed">
              External links in a post body reduce reach by roughly 60%. If you need to share a link, put it in the first comment after posting. Even first-comment links carry a small penalty, but it&apos;s significantly lower than an in-post link.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1.5">The post ending matters more than you think</p>
            <p className="text-slate-600 leading-relaxed">
              Ozigi ends LinkedIn posts with a specific, practitioner-level question rather than a generic &quot;What do you think?&quot; 360Brew penalises engagement bait. A specific question gets fewer but higher-quality replies — and those replies carry more weight with the algorithm.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1.5">Best performing formats in 2026</p>
            <p className="text-slate-600 leading-relaxed">
              PDF carousels (document posts) are currently the highest-engagement format on LinkedIn. Text-only posts outperform single-image posts. If you have a set of related points, consider creating a carousel rather than a text post — each page-swipe counts as engagement and increases dwell time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add the missing interface
interface DistributionGridProps {
  campaign?: CampaignDay[];
  session?: any;
  selectedPlatforms?: string[];
  emailContent?: string | null;
  setEmailContent?: (content: string | null) => void;
  onStatsChange?: () => void;
  demoMode?: boolean;
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

// Expandable Text Component
function ExpandableText({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.length > 250;
  return (
    <div className="flex-1 flex flex-col mb-4">
      <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap flex-1 leading-relaxed">
        {isExpanded || !isLong ? text : `${text.slice(0, 250)}...`}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-[10px] font-black uppercase tracking-widest text-brand-red hover:text-brand-red/80 transition-colors self-start"
        >
          {isExpanded ? "Show Less" : "Read More"}
        </button>
      )}
    </div>
  );
}

// ─── Carousel slide type ────────���─────────────────────────────────────────────
interface CarouselSlide {
  title: string;
  body: string;
}

// ─── Parse post text into slides heuristic ────────────────────────────────────
function parsePostIntoSlides(postText: string): CarouselSlide[] {
  // Split on double newlines or numbered list items
  let chunks = postText
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

  // If only one chunk, split by sentence
  if (chunks.length <= 1) {
    chunks = postText
      .split(/(?<=[.?!])\s+/)
      .map((c) => c.trim())
      .filter(Boolean);
  }

  // Cap at 8 slides
  const capped = chunks.slice(0, 8);

  return capped.map((chunk) => {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      title: lines[0] ?? chunk.slice(0, 60),
      body: lines.slice(1).join(" ") || "",
    };
  });
}

// ─── Generate PDF from slides (jspdf) using the selected theme ────────────────
async function generateCarouselPdf(
  slides: CarouselSlide[],
  title: string,
  theme: CarouselTheme
): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const size = 1080;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [size, size],
    hotfixes: ["px_scaling"],
  });

  const {
    background,
    bar,
    accent,
    titleText,
    bodyText,
    mutedText,
    fontFamily,
  } = theme;

  // Determine if the background is dark to pick the right ghost number tint
  const bgLuma = (background[0] * 299 + background[1] * 587 + background[2] * 114) / 1000;
  const ghostColor: RGB = bgLuma < 128 ? [255, 255, 255] : [0, 0, 0];

  slides.forEach((slide, i) => {
    if (i > 0) doc.addPage([size, size]);

    // ── Background ────────────────────────────────────────────
    doc.setFillColor(...background);
    doc.rect(0, 0, size, size, "F");

    // ── Accent stripe (left edge, full height) ────────────────
    doc.setFillColor(...accent);
    doc.rect(0, 0, 18, size, "F");

    // ── Top bar with slide counter ─────────────────────────────
    doc.setFillColor(...bar);
    doc.rect(0, 0, size, 90, "F");

    // Slide counter — top right
    doc.setFontSize(18);
    doc.setTextColor(...mutedText);
    doc.setFont(fontFamily, "bold");
    doc.text(`${i + 1} / ${slides.length}`, size - 60, 54, { align: "right" });

    // Brand watermark — very faint, top left
    doc.setGState(doc.GState({ opacity: 0.12 }));
    doc.setFontSize(11);
    doc.setTextColor(...mutedText);
    doc.setFont(fontFamily, "normal");
    doc.text("ozigi", 54, 54);
    doc.setGState(doc.GState({ opacity: 1 }));

    // ── Decorative element: large ghost slide number ──────────
    // Faint oversized number anchored to bottom-right — intentional, not noisy
    doc.setGState(doc.GState({ opacity: 0.045 }));
    doc.setFontSize(520);
    doc.setTextColor(...ghostColor);
    doc.setFont(fontFamily, "bold");
    doc.text(String(i + 1).padStart(2, "0"), size + 30, size - 20, { align: "right" });
    doc.setGState(doc.GState({ opacity: 1 }));

    // ── Title ─────────────────────────────────────────────────
    const isLastSlide = i === slides.length - 1;

    doc.setFontSize(slide.title.length > 60 ? 52 : 62);
    doc.setTextColor(...titleText);
    doc.setFont(fontFamily, "bold");

    const titleLines = doc.splitTextToSize(slide.title, size - 160);
    const titleBlockHeight = titleLines.length * (slide.title.length > 60 ? 64 : 76);
    const totalContentHeight = titleBlockHeight + (slide.body ? 220 : 0);
    const startY = (size - totalContentHeight) / 2 + (i === 0 ? 20 : 0);

    doc.text(titleLines, 80, startY, { align: "left", lineHeightFactor: 1.2 });

    // ── Body text ──────────────────────────────────────────────
    if (slide.body) {
      // Accent rule between title and body
      doc.setDrawColor(...accent);
      doc.setLineWidth(3);
      doc.line(80, startY + titleBlockHeight + 30, 220, startY + titleBlockHeight + 30);

      doc.setFontSize(26);
      doc.setTextColor(...bodyText);
      doc.setFont(fontFamily, "normal");
      const bodyLines = doc.splitTextToSize(slide.body, size - 160).slice(0, 6);
      doc.text(bodyLines, 80, startY + titleBlockHeight + 65, {
        align: "left",
        lineHeightFactor: 1.5,
      });
    }

    // ── Cover slide treatment (first slide) ───────────────────
    if (i === 0 && title && title !== "Carousel") {
      // Overprint a small label above the title
      doc.setFontSize(14);
      doc.setTextColor(...accent);
      doc.setFont(fontFamily, "bold");
      doc.text(title.toUpperCase(), 80, startY - 36);
    }

    // ── Bottom bar ─────────────────────────────────────────────
    doc.setFillColor(...bar);
    doc.rect(0, size - 70, size, 70, "F");

    // Subtle watermark — bottom right, barely there
    doc.setGState(doc.GState({ opacity: 0.12 }));
    doc.setFontSize(10);
    doc.setTextColor(...mutedText);
    doc.setFont(fontFamily, "normal");
    doc.text("made with ozigi.app", size - 36, size - 22, { align: "right" });
    doc.setGState(doc.GState({ opacity: 1 }));
  });

  return doc.output("datauristring");
}

// ─── Theme Swatch (compact preview used in the picker) ────────────────────────
function ThemeSwatch({ theme, size = 44 }: { theme: CarouselTheme; size?: number }) {
  return (
    <div
      className="rounded-md overflow-hidden border border-slate-200 flex-shrink-0 relative"
      style={{ width: size, height: size, background: rgbToCss(theme.background) }}
      aria-hidden
    >
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: Math.max(3, size * 0.1), background: rgbToCss(theme.accent) }}
      />
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: Math.max(5, size * 0.18), background: rgbToCss(theme.bar) }}
      />
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ height: Math.max(5, size * 0.18), background: rgbToCss(theme.bar) }}
      />
      <div
        className="absolute"
        style={{
          left: size * 0.28,
          right: size * 0.18,
          top: size * 0.4,
          height: Math.max(2, size * 0.08),
          background: rgbToCss(theme.titleText),
          borderRadius: 1,
        }}
      />
      <div
        className="absolute"
        style={{
          left: size * 0.28,
          right: size * 0.34,
          top: size * 0.55,
          height: Math.max(1, size * 0.05),
          background: rgbToCss(theme.bodyText),
          borderRadius: 1,
        }}
      />
    </div>
  );
}

// ─── Custom Theme Editor Modal ────────────────────────────────────────────────
type CustomThemeDraft = {
  name: string;
  background: string;
  bar: string;
  accent: string;
  titleText: string;
  bodyText: string;
  mutedText: string;
  fontFamily: "helvetica" | "times" | "courier";
};

const COLOR_FIELDS: {
  key: keyof Omit<CustomThemeDraft, "name" | "fontFamily">;
  label: string;
  hint: string;
}[] = [
  { key: "background", label: "Background", hint: "Main slide color" },
  { key: "bar", label: "Bar", hint: "Top/bottom strip" },
  { key: "accent", label: "Accent", hint: "Stripe, rule, dot" },
  { key: "titleText", label: "Title", hint: "Headline" },
  { key: "bodyText", label: "Body", hint: "Paragraph text" },
  { key: "mutedText", label: "Muted", hint: "Counter / footer" },
];

function CustomThemeModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: CarouselTheme;
  onSave: (theme: CarouselTheme) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CustomThemeDraft>(() =>
    initial
      ? {
          name: initial.name,
          background: rgbToHex(initial.background),
          bar: rgbToHex(initial.bar),
          accent: rgbToHex(initial.accent),
          titleText: rgbToHex(initial.titleText),
          bodyText: rgbToHex(initial.bodyText),
          mutedText: rgbToHex(initial.mutedText),
          fontFamily: initial.fontFamily,
        }
      : {
          name: "My Theme",
          background: "#0A1628",
          bar: "#14243A",
          accent: "#E8320A",
          titleText: "#FAFAFA",
          bodyText: "#B4C3D2",
          mutedText: "#475569",
          fontFamily: "helvetica",
        }
  );

  const preview: CarouselTheme | null = (() => {
    const background = hexToRgb(draft.background);
    const bar = hexToRgb(draft.bar);
    const accent = hexToRgb(draft.accent);
    const titleText = hexToRgb(draft.titleText);
    const bodyText = hexToRgb(draft.bodyText);
    const mutedText = hexToRgb(draft.mutedText);
    if (!background || !bar || !accent || !titleText || !bodyText || !mutedText) return null;
    return {
      id: initial?.id ?? `custom-${Date.now()}`,
      name: draft.name || "Untitled",
      description: "Custom theme",
      background,
      bar,
      accent,
      titleText,
      bodyText,
      mutedText,
      fontFamily: draft.fontFamily,
      custom: true,
    };
  })();

  const handleSave = () => {
    if (!preview) {
      toast.error("One of the colors is invalid — use 6-digit hex codes.");
      return;
    }
    if (!draft.name.trim()) {
      toast.error("Give your theme a name.");
      return;
    }
    onSave(preview);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-black uppercase tracking-tighter text-slate-900">
              {initial ? "Edit theme" : "Build your theme"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Pick colors and a font — saved locally so it&apos;s here every time you open the carousel builder.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <ThemeSwatch theme={preview} size={64} />
            <div className="text-xs text-slate-600">
              <p className="font-bold text-slate-800">{preview.name}</p>
              <p>Font: {preview.fontFamily}</p>
            </div>
          </div>
        )}

        {/* Name */}
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
          Name
        </label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-[#0A66C2]"
          placeholder="My Theme"
        />

        {/* Colors */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {COLOR_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
                {f.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft[f.key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                  className="h-8 w-10 rounded border border-slate-200 cursor-pointer bg-white"
                />
                <input
                  type="text"
                  value={draft[f.key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                  className="flex-1 text-xs font-mono text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#0A66C2]"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">{f.hint}</p>
            </div>
          ))}
        </div>

        {/* Font */}
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
          Font family
        </label>
        <div className="flex gap-1.5 mb-5">
          {(["helvetica", "times", "courier"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDraft((d) => ({ ...d, fontFamily: f }))}
              className={`flex-1 text-[10px] font-black uppercase tracking-widest px-2 py-2 rounded-lg border transition-colors ${
                draft.fontFamily === f
                  ? "bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/30"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] bg-[#0A66C2] text-white hover:bg-[#0A66C2]/90 transition-colors"
          >
            Save theme
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LinkedIn Carousel Builder ─────────────────────────────────────────────────
function LinkedInCarouselBuilder({
  postText,
  session,
  day,
  onCarouselReady,
}: {
  postText: string;
  session: any;
  day: number;
  onCarouselReady?: (data: { documentBase64: string; documentTitle: string } | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [documentTitle, setDocumentTitle] = useState("Carousel");
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const [uploadedPdfBase64, setUploadedPdfBase64] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "ready">("idle");
  const [isExtractingSlides, setIsExtractingSlides] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // ── Theme state ────────────────────────────────────────────────────────────
  const [customThemes, setCustomThemes] = useState<CarouselTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string>(BUILT_IN_THEMES[0].id);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CarouselTheme | undefined>(undefined);

  // Load custom themes (and remembered selection) from localStorage on mount
  useEffect(() => {
    const loaded = loadCustomThemes();
    setCustomThemes(loaded);
    try {
      const savedId = window.localStorage.getItem("ozigi.carousel.selectedTheme");
      if (savedId) {
        const all = [...BUILT_IN_THEMES, ...loaded];
        if (all.some((t) => t.id === savedId)) setSelectedThemeId(savedId);
      }
    } catch {
      // ignore
    }
  }, []);

  const allThemes: CarouselTheme[] = [...BUILT_IN_THEMES, ...customThemes];
  const activeTheme: CarouselTheme =
    allThemes.find((t) => t.id === selectedThemeId) ?? BUILT_IN_THEMES[0];

  const handleSelectTheme = (id: string) => {
    setSelectedThemeId(id);
    try {
      window.localStorage.setItem("ozigi.carousel.selectedTheme", id);
    } catch {
      // ignore
    }
    // Invalidate any previously generated PDF so the next generate uses the new theme
    setPdfDataUri(null);
  };

  const handleSaveCustomTheme = (theme: CarouselTheme) => {
    setCustomThemes((prev) => {
      const exists = prev.some((t) => t.id === theme.id);
      const next = exists ? prev.map((t) => (t.id === theme.id ? theme : t)) : [...prev, theme];
      saveCustomThemes(next);
      return next;
    });
    handleSelectTheme(theme.id);
    setShowThemeModal(false);
    setEditingTheme(undefined);
    toast.success(`Theme "${theme.name}" saved`);
  };

  const handleDeleteCustomTheme = (id: string) => {
    setCustomThemes((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveCustomThemes(next);
      return next;
    });
    if (selectedThemeId === id) handleSelectTheme(BUILT_IN_THEMES[0].id);
  };

  const handleParseFromPost = async () => {
    setIsExtractingSlides(true);
    try {
      const res = await fetch("/api/generate-carousel-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to extract slides");
      setSlides(data.slides);
      // Auto-populate title from the first slide's heading so LinkedIn
      // displays a meaningful name on the carousel instead of the default.
      if (data.slides?.[0]?.title) {
        setDocumentTitle(data.slides[0].title);
      }
    } catch (err: any) {
      toast.error(`Could not extract slides: ${err.message}`);
      // Fallback to heuristic
      const fallbackSlides = parsePostIntoSlides(postText);
      setSlides(fallbackSlides);
      if (fallbackSlides[0]?.title) {
        setDocumentTitle(fallbackSlides[0].title);
      }
    } finally {
      setPdfDataUri(null);
      setUploadedPdfBase64(null);
      setUploadedFileName(null);
      setStatus("idle");
      setIsExtractingSlides(false);
    }
  };

  const handleAddSlide = () => {
    setSlides((prev) => [...prev, { title: "", body: "" }]);
  };

  const handleRemoveSlide = (index: number) => {
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setPdfDataUri(null);
  };

  const handleSlideChange = (index: number, field: "title" | "body", value: string) => {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    setPdfDataUri(null);
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("PDF must be under 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const nameFromFile = file.name.replace(/\.pdf$/i, "").trim();
      const titleToUse = nameFromFile || documentTitle;
      setUploadedPdfBase64(ev.target?.result as string);
      setUploadedFileName(file.name);
      setDocumentTitle(titleToUse);
      setSlides([]);
      setPdfDataUri(null);
      setStatus("ready");
      if (onCarouselReady) {
        onCarouselReady({ documentBase64: ev.target?.result as string, documentTitle: titleToUse });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGeneratePdf = async () => {
    if (slides.length === 0) return;
    setStatus("generating");
    try {
      const dataUri = await generateCarouselPdf(slides, documentTitle, activeTheme);
      setPdfDataUri(dataUri);
      setStatus("ready");
      if (onCarouselReady) {
        onCarouselReady({ documentBase64: dataUri, documentTitle });
      }
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + err.message);
      setStatus("idle");
    }
  };

  const handleDownloadPdf = () => {
    const documentBase64 = uploadedPdfBase64 ?? pdfDataUri;
    if (!documentBase64) return;
    
    const link = document.createElement("a");
    link.href = documentBase64;
    link.download = `${documentTitle}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasCarousel = uploadedPdfBase64 || pdfDataUri;

  return (
    <div className="mt-3 border border-[#0A66C2]/10 rounded-xl bg-gradient-to-br from-[#0A66C2]/2 to-transparent overflow-hidden">
      {/* Compact header / toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#0A66C2]/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A66C2" strokeWidth="2.5" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span className="text-xs font-black uppercase tracking-widest text-[#0A66C2]">
            {hasCarousel ? `Carousel Ready (${slides.length || 1} slide${slides.length !== 1 ? 's' : ''})` : "Build Carousel"}
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A66C2" strokeWidth="2.5"
          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[#0A66C2]/10 px-3 py-3 space-y-3">
          {/* Title input */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Carousel Title <span className="normal-case font-medium tracking-normal">(shown on LinkedIn)</span></label>
            <input
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="Carousel title"
              className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#0A66C2]"
            />
          </div>

          {/* Theme picker */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">
              Theme
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {allThemes.map((t) => {
                const isActive = t.id === activeTheme.id;
                return (
                  <div key={t.id} className="relative flex-shrink-0 group">
                    <button
                      onClick={() => handleSelectTheme(t.id)}
                      title={`${t.name} — ${t.description}`}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                        isActive
                          ? "border-[#0A66C2] ring-2 ring-[#0A66C2]/30 bg-[#0A66C2]/5"
                          : "border-slate-200 hover:border-slate-400 bg-white"
                      }`}
                    >
                      <ThemeSwatch theme={t} size={40} />
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wide ${
                          isActive ? "text-[#0A66C2]" : "text-slate-500"
                        }`}
                      >
                        {t.name}
                      </span>
                    </button>
                    {t.custom && (
                      <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTheme(t);
                            setShowThemeModal(true);
                          }}
                          className="w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-600 hover:text-[#0A66C2] flex items-center justify-center text-[10px]"
                          title="Edit"
                          aria-label={`Edit ${t.name}`}
                        >
                          ✎
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete "${t.name}"?`)) handleDeleteCustomTheme(t.id);
                          }}
                          className="w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-600 hover:text-red-600 flex items-center justify-center"
                          title="Delete"
                          aria-label={`Delete ${t.name}`}
                        >
                          <X size={8} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add custom theme card */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => {
                    setEditingTheme(undefined);
                    setShowThemeModal(true);
                  }}
                  title="Create your own theme"
                  className="flex flex-col items-center gap-1 p-1.5 rounded-lg border border-dashed border-slate-300 hover:border-[#0A66C2] hover:bg-[#0A66C2]/5 bg-white transition-all group/add"
                >
                  <div
                    className="rounded-md border border-dashed border-slate-300 group-hover/add:border-[#0A66C2]/40 flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ width: 40, height: 40 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-slate-400 group-hover/add:text-[#0A66C2] transition-colors">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 group-hover/add:text-[#0A66C2] transition-colors">
                    Custom
                  </span>
                </button>
              </div>
            </div>

            {/* Active theme description */}
            <p className="mt-1.5 text-[10px] text-slate-400 leading-snug">
              <span className="font-semibold text-slate-600">{activeTheme.name}</span>
              {" — "}
              {activeTheme.description}
              {activeTheme.custom && (
                <button
                  onClick={() => {
                    setEditingTheme(activeTheme);
                    setShowThemeModal(true);
                  }}
                  className="ml-2 underline hover:text-[#0A66C2] transition-colors"
                >
                  Edit
                </button>
              )}
            </p>
          </div>

          {/* Slide thumbnails / preview */}
          {slides.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">{slides.length} slides</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {slides.map((slide, i) => (
                  <div key={i} className="flex-shrink-0 w-12 h-16 bg-gradient-to-br from-[#0A66C2]/20 to-[#0A66C2]/5 rounded-lg border border-[#0A66C2]/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#0A66C2]">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={handleParseFromPost}
              disabled={isExtractingSlides}
              className="text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-[#0A66C2] hover:text-[#0A66C2] transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {isExtractingSlides ? "Extracting…" : "Extract Slides"}
            </button>
            <button
              onClick={handleAddSlide}
              className="text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-[#0A66C2] hover:text-[#0A66C2] transition-colors"
            >
              + Slide
            </button>
            <button
              onClick={() => pdfInputRef.current?.click()}
              className="text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-[#0A66C2] hover:text-[#0A66C2] transition-colors"
            >
              Upload PDF
            </button>
            <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
          </div>

          {/* Generate button */}
          {slides.length > 0 && !pdfDataUri && (
            <button
              onClick={handleGeneratePdf}
              disabled={status === "generating"}
              className="w-full py-1.5 rounded-lg font-black uppercase tracking-widest text-[10px] bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/20 hover:bg-[#0A66C2]/20 transition-colors disabled:opacity-60"
            >
              {status === "generating" ? "Generating..." : "Generate PDF"}
            </button>
          )}

          {/* Download button */}
          {hasCarousel && (
            <button
              onClick={handleDownloadPdf}
              className="w-full py-1.5 rounded-lg font-black uppercase tracking-widest text-[10px] bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </button>
          )}
        </div>
      )}

      {showThemeModal && (
        <CustomThemeModal
          initial={editingTheme}
          onSave={handleSaveCustomTheme}
          onClose={() => {
            setShowThemeModal(false);
            setEditingTheme(undefined);
          }}
        />
      )}
    </div>
  );
}

// Social Card Component
function SocialCard({
  day,
  platformName,
  initialText,
  onPost,
  postStatus,
  session,
  actionButtonConfig,
  onStatsChange,
  imagesGeneratedCount,
  incrementImageCount,
  planStatus,
  showNudge,
  onDismissNudge,
  onOpenTips,
  showCarouselOption,
  demoMode = false,
  profileEmail,
}: {
  day: number;
  platformName: string;
  initialText: string;
  session: any;
  profileEmail?: string | null;
  onPost?: (text: string, day: number, imageUrls?: string[], carouselData?: { documentBase64: string; documentTitle: string }) => void;
  postStatus?: "idle" | "loading" | "success" | "error";
  actionButtonConfig?: {
    idle: string;
    loading: string;
    success: string;
    classes: string;
  };
  onStatsChange?: () => void;
  imagesGeneratedCount: number;
  incrementImageCount: () => void;
  planStatus: any;
  showNudge?: boolean;
  onDismissNudge?: () => void;
  onOpenTips?: () => void;
  showCarouselOption?: boolean;
  demoMode?: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [imageTitle, setImageTitle] = useState("");
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [showCarouselBuilder, setShowCarouselBuilder] = useState(false);
  const [carouselData, setCarouselData] = useState<{ documentBase64: string; documentTitle: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateImage = async () => {
    if (!planStatus) return;
    if (planStatus.imageGenLimit !== -1 && imagesGeneratedCount >= planStatus.imageGenLimit) {
      toast.error(`You've reached your image limit (${planStatus.imageGenLimit} per campaign). Upgrade for more.`);
      return;
    }

    setIsGeneratingImg(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          platform: platformName,
          graphicTitle: imageTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImageUrls((prev) => [...prev, data.imageUrl]);
      incrementImageCount();
      toast.success("Image generated!");
    } catch (err: any) {
      console.error(err);
      let errorMsg = `Image generation failed: ${err.message}`;
      if (err.message.includes("Quota exceeded")) {
        errorMsg = "Image quota exceeded. Try again later or upgrade.";
      }
      toast.error(errorMsg);
    } finally {
      setIsGeneratingImg(false);
    }
  };

  const handleDownloadImage = (e: React.MouseEvent, url: string, idx: number) => {
    e.stopPropagation();
    if (!url) return;

    const filename = `ozigi-campaign-day-${day}${imageUrls.length > 1 ? `-${idx + 1}` : ""}.jpg`;

    if (url.startsWith("data:")) {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Image downloaded!");
      return;
    }

    // R2 images block cross-origin fetch, so route the download through our
    // same-origin proxy which sets Content-Disposition: attachment
    const link = document.createElement("a");
    link.href = `/api/download-image?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Image download started");
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = 9 - imageUrls.length;
    if (remaining <= 0) {
      toast.error("Maximum 9 images per post.");
      return;
    }
    const toUpload = files.slice(0, remaining);

    for (const file of toUpload) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10 MB.`);
        continue;
      }
      setIsUploadingImg(true);
      try {
        const publicUrl = await uploadLargeAsset(file, session?.access_token);
        setImageUrls((prev) => [...prev, publicUrl]);
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(`Failed to upload ${file.name}.`);
      } finally {
        setIsUploadingImg(false);
      }
    }
    toast.success(toUpload.length === 1 ? "Image uploaded!" : `${toUpload.length} images uploaded!`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSchedule = async (scheduledFor: string, email?: string | null) => {
    const token = session?.access_token;
    if (!token) {
      toast.error("Sign in to schedule posts.");
      return;
    }

    const response = await fetch("/api/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        posts: [
          {
            platform: platformName.toLowerCase(),
            content: text,
            imageUrl: imageUrls[0] || undefined,
            day: day,
            email: email,
          },
        ],
        scheduledFor,
        campaignId: null,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to schedule");
    }

    if (onStatsChange) onStatsChange();
  };

  const imageGenButton = planStatus?.imageGenLimit !== 0 ? (
    <button
      onClick={handleGenerateImage}
      disabled={isGeneratingImg}
      className="w-full mb-5 py-3 border border-dashed border-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-red hover:border-brand-red hover:bg-red-50 transition-all flex items-center justify-center gap-2"
    >
      {isGeneratingImg ? "🎨 Painting pixels..." : "🎨 Generate Graphic"}
    </button>
  ) : (
    <div className="relative group w-full mb-5">
      <button
        disabled
        className="w-full py-3 border border-dashed border-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-not-allowed flex items-center justify-center gap-2"
      >
        🔒 Upgrade to Generate
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
        Upgrade to Team for image generation
      </div>
    </div>
  );

  return (
    <motion.div
      variants={fadeUp}
      className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col p-5 hover:border-brand-red/20 hover:shadow-md transition-all"
    >
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
        <span className="text-xs font-black uppercase tracking-widest text-brand-navy">Day {day}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-brand-red bg-slate-50 hover:bg-red-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            {isEditing ? "Save" : "Edit"}
          </button>
          <button
            onClick={handleCopy}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-brand-red bg-slate-50 hover:bg-red-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          {demoMode ? (
            <div className="relative group">
              <button
                disabled
                className="text-[10px] font-bold uppercase tracking-widest text-slate-300 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg cursor-not-allowed"
              >
                Schedule
              </button>
              <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-lg">
                Sign up to schedule posts
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-brand-red bg-slate-50 hover:bg-red-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Schedule
            </button>
          )}
        </div>
      </div>

      {/* Image Title Input */}
      {planStatus?.imageGenLimit !== 0 && (
        <div className="mb-3">
          <input
            type="text"
            value={imageTitle}
            onChange={(e) => setImageTitle(e.target.value)}
            placeholder="Image Copy (Optional)"
            className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-red/50 text-brand-slate placeholder:text-slate-600"
          />
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingImg || imageUrls.length >= 9}
          className="flex-1 py-2 border border-dashed border-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-red hover:border-brand-red hover:bg-red-50 transition-all flex items-center justify-center gap-2"
        >
          {isUploadingImg ? "Uploading..." : <><ImagePlus size={12} /> Upload {imageUrls.length > 0 && `(${imageUrls.length}/9)`}</>}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleUploadImage}
        />
        {planStatus?.imageGenLimit !== 0 && (
          <button
            onClick={handleGenerateImage}
            disabled={isGeneratingImg}
            className="flex-1 py-2 border border-dashed border-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-red hover:border-brand-red hover:bg-red-50 transition-all flex items-center justify-center gap-2"
          >
            {isGeneratingImg ? "Generating..." : "Generate Graphic"}
          </button>
        )}
      </div>

      {imageUrls.length > 0 && (
        <div className={`mb-4 grid gap-2 ${imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {imageUrls.map((url, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200">
              <img src={url} alt={`Image ${idx + 1}`} className="w-full aspect-video object-cover" />
              <div className="absolute top-1.5 right-1.5 flex gap-1">
                <button
                  onClick={(e) => handleDownloadImage(e, url, idx)}
                  className="bg-white/90 rounded-full p-1.5 shadow-md hover:bg-blue-100 transition-colors"
                  title="Download image"
                >
                  <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={() => handleRemoveImage(idx)}
                  className="bg-white/90 rounded-full p-1.5 shadow-md hover:bg-red-100 transition-colors"
                  title="Remove image"
                >
                  <X size={12} className="text-slate-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 w-full text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 min-h-[150px] resize-y focus:outline-none focus:border-brand-red"
        />
      ) : (
        <ExpandableText text={text} />
      )}

      {demoMode ? (
        <div className="relative group mt-auto">
          <button
            disabled
            className="w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex items-center justify-center gap-2"
          >
            🔒 Sign up to post
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-lg">
            Create a free account to publish directly
          </div>
        </div>
      ) : onPost && actionButtonConfig && (
        <button
          onClick={() => onPost(text, day, imageUrls.length > 0 ? imageUrls : undefined, carouselData || undefined)}
          disabled={postStatus === "loading" || postStatus === "success"}
          className={`w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 mt-auto ${postStatus === "success"
              ? "bg-green-100 text-green-700 border border-green-200"
              : actionButtonConfig.classes
            }`}
        >
          {postStatus === "loading" && actionButtonConfig.loading}
          {postStatus === "success" && actionButtonConfig.success}
          {postStatus !== "loading" && postStatus !== "success" && actionButtonConfig.idle}
        </button>
      )}

      {/* API-free fallback: opens LinkedIn's composer with the text pre-filled */}
      {platformName === "LinkedIn" && !demoMode && (
        <>
          {postStatus === "error" && (
            <p className="text-[10px] text-red-500 font-medium mt-2 text-center">
              Direct post failed — you can still post via the LinkedIn composer below.
            </p>
          )}
          <button
            onClick={() => {
              const intentUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
              window.open(intentUrl, "_blank", "noopener,noreferrer");
            }}
            className={`w-full py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5 mt-2 border ${
              postStatus === "error"
                ? "border-[#0A66C2] text-[#0A66C2] bg-[#0A66C2]/5 hover:bg-[#0A66C2]/10"
                : "border-slate-200 text-slate-400 hover:text-[#0A66C2] hover:border-[#0A66C2]/40"
            }`}
          >
            Open in LinkedIn
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M17 7H8M17 7v9" />
            </svg>
          </button>
          {imageUrls.length > 0 && (
            <p className="text-[9px] text-slate-400 mt-1 text-center">
              Images can't be pre-attached — download them above and add them in the composer.
            </p>
          )}
        </>
      )}

      {(onOpenTips || showCarouselOption) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          {showCarouselOption && (
            <button
              onClick={() => setShowCarouselBuilder((v) => !v)}
              className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                carouselData
                  ? "text-[#0A66C2]"
                  : showCarouselBuilder
                  ? "text-[#0A66C2]"
                  : "text-slate-400 hover:text-[#0A66C2]"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              {carouselData ? "Carousel ready ✓" : showCarouselBuilder ? "Hide carousel" : "Add carousel"}
            </button>
          )}

          {onOpenTips && (
            <button
              onClick={onOpenTips}
              className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest
                         text-slate-400 hover:text-[#0A66C2] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              LinkedIn tips
            </button>
          )}
        </div>
      )}

      {showNudge && onDismissNudge && (
        <LinkedInEngagementNudge onDismiss={onDismissNudge} />
      )}

      {showCarouselOption && showCarouselBuilder && (
        <LinkedInCarouselBuilder
          postText={text}
          session={session}
          day={day}
          onCarouselReady={(data) => {
            setCarouselData(data);
          }}
        />
      )}

      {isScheduleModalOpen && (
        <ScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSchedule={handleSchedule}
          postText={text}
          platform={platformName}
          day={day}
          imageUrl={imageUrls[0] || undefined}
          userEmail={session?.user?.email}
          profileEmail={profileEmail}
        />
      )}
    </motion.div>
  );
}

// Main DistributionGrid Component
export default function DistributionGrid({
  campaign = [],
  session,
  selectedPlatforms = [],
  emailContent,
  setEmailContent,
  onStatsChange,
  demoMode = false,
}: DistributionGridProps) {
  const { planStatus, loading: planLoading } = usePlanStatus();
  const [xStatuses, setXStatuses] = useState<{ [day: number]: "idle" | "loading" | "success" | "error" }>({});
  const [discordStatuses, setDiscordStatuses] = useState<{ [day: number]: "idle" | "loading" | "success" | "error" }>({});
  const [liStatuses, setLiStatuses] = useState<{ [day: number]: "idle" | "loading" | "success" | "error" }>({});
  const [slackStatuses, setSlackStatuses] = useState<{ [day: number]: "idle" | "loading" | "success" | "error" }>({});
  const [liNudgeVisible, setLiNudgeVisible] = useState<{ [day: number]: boolean }>({});
  const [showLinkedInTips, setShowLinkedInTips] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [localEmailContent, setLocalEmailContent] = useState<string | null>(emailContent || null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [emailImageUrl, setEmailImageUrl] = useState<string | null>(null);
  const [imagesGeneratedCount, setImagesGeneratedCount] = useState(0);
  const incrementImageCount = () => setImagesGeneratedCount((prev) => prev + 1);
  // Company-page posting: available when the user saved a page ID in Settings
  const linkedinOrgId: string = session?.user?.user_metadata?.linkedin_org_id || "";
  const [liPostAs, setLiPostAs] = useState<"personal" | "company">("personal");
  // Reminder email configured in Settings (profiles.email) — preferred over the
  // account's login email for X reminder notifications
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profiles")
      .select("email")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setProfileEmail(data?.email || null));
  }, [session?.user?.id]);

  useEffect(() => {
    setLocalEmailContent(emailContent || null);
  }, [emailContent]);

  const handleEmailCopy = () => {
    if (localEmailContent) {
      navigator.clipboard.writeText(localEmailContent);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    }
  };

  const handleEmailSchedule = async (scheduledFor: string, imageUrl?: string) => {
    if (!session?.access_token) {
      toast.error("Sign in to schedule emails.");
      return;
    }
    setEmailStatus("loading");
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          posts: [
            {
              platform: PLATFORMS.EMAIL,
              content: localEmailContent,
              imageUrl: imageUrl,
              day: 0,
            },
          ],
          scheduledFor,
          campaignId: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to schedule");
      setEmailStatus("success");
      setTimeout(() => setEmailStatus("idle"), 3000);
      if (onStatsChange) onStatsChange();
      toast.success("Email scheduled!");
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule email.");
      setEmailStatus("error");
    }
  };

  const handlePostToX = async (text: string, day: number) => {
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
    setXStatuses((prev) => ({ ...prev, [day]: "success" }));
    setTimeout(() => setXStatuses((prev) => ({ ...prev, [day]: "idle" })), 3000);
  };

  const handlePostToDiscord = async (text: string, day: number, imageUrls?: string[]) => {
    const discordWebhook = session?.user?.user_metadata?.discord_webhook;
    if (!discordWebhook) {
      toast.error("Add your Discord webhook in Settings first.");
      return;
    }
    setDiscordStatuses((prev) => ({ ...prev, [day]: "loading" }));
    try {
      const res = await fetch(getApiEndpoint(PLATFORMS.DISCORD), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          webhookUrl: discordWebhook,
          imageUrl: imageUrls?.[0],
        }),
      });
      if (!res.ok) throw new Error("Discord rejected the webhook payload.");
      setDiscordStatuses((prev) => ({ ...prev, [day]: "success" }));
      setTimeout(() => setDiscordStatuses((prev) => ({ ...prev, [day]: "idle" })), 3000);
      toast.success("Posted to Discord!");
    } catch (error: any) {
      console.error("Discord Error:", error);
      setDiscordStatuses((prev) => ({ ...prev, [day]: "error" }));
      toast.error(`Failed to post to Discord: ${error.message}`);
    }
  };

  const handlePostToLinkedIn = async (
    text: string,
    day: number,
    imageUrls?: string[],
    carouselData?: { documentBase64: string; documentTitle: string }
  ) => {
    if (!session?.access_token) {
      toast.error("Sign in to post to LinkedIn.");
      return;
    }
    setLiStatuses((prev) => ({ ...prev, [day]: "loading" }));
    try {
      const payload: any = { text, userId: session.user.id, imageUrls };
      if (liPostAs === "company" && linkedinOrgId) {
        payload.organizationUrn = `urn:li:organization:${linkedinOrgId}`;
      }
      if (carouselData) {
        payload.documentBase64 = carouselData.documentBase64;
        payload.documentTitle = carouselData.documentTitle;
      }
      const res = await fetch("/api/publish/linkedin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post to LinkedIn");
      setLiStatuses((prev) => ({ ...prev, [day]: "success" }));
      setLiNudgeVisible((prev) => ({ ...prev, [day]: true }));
      setTimeout(() => setLiStatuses((prev) => ({ ...prev, [day]: "idle" })), 3000);
      toast.success("Posted to LinkedIn!");
    } catch (error: any) {
      console.error("LinkedIn Posting Error:", error);
      setLiStatuses((prev) => ({ ...prev, [day]: "error" }));
      toast.error(`Failed to post: ${error.message}`);
    }
  };

  const handlePostToSlack = async (text: string, day: number, imageUrls?: string[]) => {
    const slackWebhook = session?.user?.user_metadata?.slack_webhook;
    if (!slackWebhook) {
      toast.error("Add your Slack webhook in Settings first.");
      return;
    }
    setSlackStatuses((prev) => ({ ...prev, [day]: "loading" }));
    try {
      const res = await fetch(getApiEndpoint(PLATFORMS.SLACK), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          webhookUrl: slackWebhook,
          imageUrl: imageUrls?.[0],
        }),
      });
      if (!res.ok) throw new Error("Slack rejected the webhook payload.");
      setSlackStatuses((prev) => ({ ...prev, [day]: "success" }));
      setTimeout(() => setSlackStatuses((prev) => ({ ...prev, [day]: "idle" })), 3000);
      toast.success("Posted to Slack!");
    } catch (error: any) {
      console.error("Slack Error:", error);
      setSlackStatuses((prev) => ({ ...prev, [day]: "error" }));
      toast.error(`Failed to post to Slack: ${error.message}`);
    }
  };

  const safeCampaign = campaign ?? [];
  const safePlatforms = selectedPlatforms ?? [];

  const hasX = safeCampaign.some((d: CampaignDay) => d.x) && safePlatforms.includes(PLATFORMS.X);
  const hasLinkedIn = safeCampaign.some((d: CampaignDay) => d.linkedin) && safePlatforms.includes(PLATFORMS.LINKEDIN);
  const hasDiscord = safeCampaign.some((d: CampaignDay) => d.discord) && safePlatforms.includes(PLATFORMS.DISCORD);
  const hasEmail = !!localEmailContent && safePlatforms.includes(PLATFORMS.EMAIL);
  const hasSlack = safeCampaign.some((d: CampaignDay) => d.slack) && safePlatforms.includes(PLATFORMS.SLACK);

  return (
    <div className="space-y-12">
      {/* X ROW */}
      {hasX && (
        <section>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex items-center gap-3 mb-5"
          >
            <svg className="w-5 h-5 fill-current text-brand-navy" viewBox="0 0 1200 1227">
              <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" />
            </svg>
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-brand-navy">X Strategy</h3>
          </motion.div>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {safeCampaign.map((dayData: CampaignDay) =>
              dayData.x && (
                <SocialCard
                  key={`x-${dayData.day}`}
                  day={dayData.day}
                  platformName="X"
                  session={session}
                  initialText={dayData.x}
                  imagesGeneratedCount={imagesGeneratedCount}
                  incrementImageCount={incrementImageCount}
                  planStatus={planStatus}
                  onPost={handlePostToX}
                  postStatus={xStatuses[dayData.day]}
                  actionButtonConfig={{
                    idle: "🚀 Post to X",
                    loading: "Posting...",
                    success: "✅ Published!",
                    classes: "bg-black text-white hover:bg-slate-800 active:scale-95",
                  }}
                  onStatsChange={onStatsChange}
                  profileEmail={profileEmail}
                  demoMode={demoMode}
                />
              )
            )}
          </motion.div>
        </section>
      )}

      {/* LINKEDIN ROW */}
      {hasLinkedIn && (
        <section>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex items-center gap-3 mb-5"
          >
            <svg className="w-5 h-5 fill-current text-[#0A66C2]" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-brand-navy">LinkedIn Strategy</h3>
            {linkedinOrgId && (
              <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {(["personal", "company"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setLiPostAs(mode)}
                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors ${
                      liPostAs === mode ? "bg-[#0A66C2] text-white" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {mode === "personal" ? "Personal" : "Company Page"}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {safeCampaign.map((dayData: CampaignDay) =>
              dayData.linkedin && (
                <SocialCard
                  key={`li-${dayData.day}`}
                  day={dayData.day}
                  platformName="LinkedIn"
                  session={session}
                  initialText={dayData.linkedin}
                  imagesGeneratedCount={imagesGeneratedCount}
                  incrementImageCount={incrementImageCount}
                  planStatus={planStatus}
                  onPost={handlePostToLinkedIn}
                  postStatus={liStatuses[dayData.day]}
                  actionButtonConfig={{
                    idle: "Post to LinkedIn",
                    loading: "Posting...",
                    success: "Published!",
                    classes: "bg-[#0A66C2] text-white hover:bg-[#004182] active:scale-95",
                  }}
                  onStatsChange={onStatsChange}
                  profileEmail={profileEmail}
                  showNudge={liNudgeVisible[dayData.day] ?? false}
                  onDismissNudge={() => setLiNudgeVisible((prev) => ({ ...prev, [dayData.day]: false }))}
                  onOpenTips={() => setShowLinkedInTips(true)}
                  showCarouselOption={true}
                  demoMode={demoMode}
                />
              )
            )}
          </motion.div>
        </section>
      )}

      {/* DISCORD ROW */}
      {hasDiscord && (
        <section>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex items-center gap-3 mb-5"
          >
            <svg className="w-5 h-5 fill-current text-[#5865F2]" viewBox="0 0 127.14 96.36">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77.7,77.7,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.2,46,96.12,53,91.08,65.69,84.69,65.69Z" />
            </svg>
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-brand-navy">Discord Strategy</h3>
          </motion.div>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {safeCampaign.map((dayData: CampaignDay) =>
              dayData.discord && (
                <SocialCard
                  key={`disc-${dayData.day}`}
                  day={dayData.day}
                  platformName="Discord"
                  session={session}
                  initialText={dayData.discord}
                  imagesGeneratedCount={imagesGeneratedCount}
                  incrementImageCount={incrementImageCount}
                  planStatus={planStatus}
                  onPost={handlePostToDiscord}
                  postStatus={discordStatuses[dayData.day]}
                  actionButtonConfig={{
                    idle: "👾 Send to Discord",
                    loading: "Posting...",
                    success: "✅ Sent!",
                    classes: "bg-[#5865F2] text-white hover:bg-[#4752C4] active:scale-95",
                  }}
                  onStatsChange={onStatsChange}
                  profileEmail={profileEmail}
                  demoMode={demoMode}
                />
              )
            )}
          </motion.div>
        </section>
      )}

      {/* SLACK ROW */}
      {hasSlack && (
        <section>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex items-center gap-3 mb-5"
          >
            <svg className="w-5 h-5 fill-current text-[#4A154B]" viewBox="0 0 24 24">
              <path d="M5.5 12.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm4-4a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5zm4-4a2 2 0 1 1 0 4h-2V6.5a2 2 0 0 1 2-2zm-4 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
            </svg>
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-brand-navy">Slack Strategy</h3>
          </motion.div>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {safeCampaign.map((dayData: CampaignDay) =>
              dayData.slack && (
                <SocialCard
                  key={`slack-${dayData.day}`}
                  day={dayData.day}
                  platformName="Slack"
                  session={session}
                  initialText={dayData.slack}
                  imagesGeneratedCount={imagesGeneratedCount}
                  incrementImageCount={incrementImageCount}
                  planStatus={planStatus}
                  onPost={handlePostToSlack}
                  postStatus={slackStatuses[dayData.day]}
                  actionButtonConfig={{
                    idle: "💬 Send to Slack",
                    loading: "Posting...",
                    success: "✅ Sent!",
                    classes: "bg-[#4A154B] text-white hover:bg-[#36123b] active:scale-95",
                  }}
                  onStatsChange={onStatsChange}
                  profileEmail={profileEmail}
                  demoMode={demoMode}
                />
              )
            )}
          </motion.div>
        </section>
      )}

      {/* EMAIL NEWSLETTER SECTION */}
      {hasEmail && (
        <section className="mt-12 pt-8 border-t-2 border-slate-100">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex items-center gap-3 mb-5"
          >
            <svg className="w-5 h-5 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-brand-navy">Email Newsletter</h3>
          </motion.div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="max-w-2xl"
          >
            <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm p-5">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <span className="text-xs font-black uppercase tracking-widest text-brand-navy">Campaign Summary</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditingEmail(!isEditingEmail)}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-brand-red bg-slate-50 hover:bg-red-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {isEditingEmail ? "Save" : "Edit"}
                  </button>
                  <button
                    onClick={handleEmailCopy}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-brand-red bg-slate-50 hover:bg-red-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {emailCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {isEditingEmail ? (
                <RichTextEditor
                  content={localEmailContent || ""}
                  onChange={(html) => {
                    setLocalEmailContent(html);
                    if (setEmailContent) setEmailContent(html);
                  }}
                  placeholder="Write your newsletter content..."
                />
              ) : (
                <div
                  className="mb-4 prose prose-sm max-w-none text-sm font-medium text-slate-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: localEmailContent || "" }}
                />
              )}

              {demoMode ? (
                <div className="relative group">
                  <button
                    disabled
                    className="w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    🔒 Sign up to schedule
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-lg">
                    Create a free account to send newsletters
                  </div>
                </div>
              ) : planStatus?.emailSendsLimit !== 0 ? (
                <button
                  onClick={() => setIsScheduleModalOpen(true)}
                  disabled={emailStatus === "loading"}
                  className="w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all bg-brand-red text-white hover:bg-opacity-90 active:scale-95 flex items-center justify-center gap-2"
                >
                  {emailStatus === "loading" ? "Scheduling..." : "📧 Schedule Newsletter"}
                </button>
              ) : (
                <div className="relative group">
                  <button
                    disabled
                    className="w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] bg-slate-200 text-slate-500 cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    🔒 Upgrade to Send
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    Upgrade to Team to send newsletters
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </section>
      )}
      {isScheduleModalOpen && (
        <ScheduleEmailModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSchedule={(isoString) => {
            handleEmailSchedule(isoString, emailImageUrl || undefined);
          }}
        />
      )}

      {showLinkedInTips && (
        <LinkedInTipsModal onClose={() => setShowLinkedInTips(false)} />
      )}
    </div>
  );
}

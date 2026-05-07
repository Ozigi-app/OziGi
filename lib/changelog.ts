export type ChangelogLabel = "Feature" | "Improvement" | "Fix" | "AI" | "Infra";

export type ChangelogEntry = {
  version: string;
  title: string;
  date: string; // ISO e.g. "2026-04-10"
  dateLabel: string; // Human-readable range for display
  summary: string;
  items: { label: ChangelogLabel; text: string }[];
  prLinks?: { number: number; url: string }[];
  accent: "green" | "blue" | "purple";
};

export const changelog: ChangelogEntry[] = [
  {
    version: "v0.7",
    title: "Generation Reliability & Media Support",
    date: "2026-05-07",
    dateLabel: "April 28 – May 7, 2026",
    summary:
      "A full reliability pass on the generation engine — output quality guardrails, faster file handling, three production bug fixes, and Google Ads tracking.",
    items: [
      {
        label: "AI",
        text: "Lexicon quality guard — generated campaigns are now validated against a banned-phrase list (AI clichés, filler structures, weak closers). Flagged drafts are automatically repaired with a second targeted call before being returned to the user.",
      },
      {
        label: "Improvement",
        text: "Faster file & image generation — images, audio, and PDFs are now passed to Vertex AI as direct HTTPS URIs instead of being fetched and base64-encoded, cutting per-file overhead and keeping requests well within the 60s runtime limit.",
      },
      {
        label: "Improvement",
        text: "File upload warning — an amber notice now appears whenever attachments are added, advising users that larger files increase generation time.",
      },
      {
        label: "Fix",
        text: "Composio OAuth redirect — connecting integrations no longer redirects to localhost in production. The callback URL is now derived from the live request origin.",
      },
      {
        label: "Fix",
        text: "Persona manager infinite spinner — the loading state now always resolves, even when the Supabase fetch errors or returns no data.",
      },
      {
        label: "Fix",
        text: "Generation stuck at loading — restored the synchronous generation flow that was silently failing in production due to a misconfigured async worker pipeline.",
      },
      {
        label: "Infra",
        text: "Google Ads conversion tracking (AW-18111303438) wired up across the main app and blog via a shared `gtag` module.",
      },
    ],
    prLinks: [
      { number: 117, url: "https://github.com/Ozigi-app/OziGi/pull/117" },
    ],
    accent: "blue",
  },
  {
    version: "v0.6",
    title: "LinkedIn & Gemini 3 Upgrade",
    date: "2026-04-10",
    dateLabel: "April 10–12, 2026",
    summary:
      "Direct LinkedIn publishing arrives and the generation stack moves to Gemini 3 Flash, with a landing-page demo and a handful of stability fixes.",
    items: [
      {
        label: "Feature",
        text: "LinkedIn engagement — direct LinkedIn publishing and engagement support alongside existing X/Twitter integration.",
      },
      {
        label: "AI",
        text: "Gemini 3 Flash upgrade — generation routes moved from Gemini 2.5 Flash to `gemini-3-flash-preview`. Image generation remains on 2.5 Flash for stability.",
      },
      {
        label: "Infra",
        text: "`getVertexAIClient` moved to global scope to support Gemini 3's initialization requirements.",
      },
      { label: "Fix", text: "Long-form content history now persists correctly." },
      { label: "Feature", text: "Interactive demo added to the landing page." },
    ],
    prLinks: [
      { number: 106, url: "https://github.com/Dumebii/OziGi/pull/106" },
      { number: 107, url: "https://github.com/Dumebii/OziGi/pull/107" },
      { number: 108, url: "https://github.com/Dumebii/OziGi/pull/108" },
    ],
    accent: "purple",
  },
  {
    version: "v0.5",
    title: "Long-Form Content & Marketplace Personas",
    date: "2026-04-09",
    dateLabel: "April 9, 2026",
    summary:
      "Long-form writing lands with full persistence, the persona marketplace is organised for discovery, and the first technical blog post goes live.",
    items: [
      {
        label: "Feature",
        text: "Long-form content generation — blog posts and technical docs with database persistence and word-count tracking.",
      },
      {
        label: "Improvement",
        text: "Marketplace personas — eight pre-built writing personas ordered with `order_index` for consistent display; JSON parsing issues resolved.",
      },
      {
        label: "Feature",
        text: "First technical blog post published to `/blog` — covers Ozigi's retrieval-augmented generation architecture.",
      },
      {
        label: "Feature",
        text: "Subscription management — upgrade and cancel plans from the dashboard; org-level rate limits set to 5 requests / 24h.",
      },
      {
        label: "Improvement",
        text: "Blog SEO — meta tags, structured data, and sitemap improvements across all blog pages.",
      },
      {
        label: "Fix",
        text: "Build path errors resolved using `process.cwd()` for reliable cross-environment deployment.",
      },
    ],
    accent: "green",
  },
  {
    version: "v0.4",
    title: "Blog, Analytics & Landing Page",
    date: "2026-04-06",
    dateLabel: "April 6–8, 2026",
    summary:
      "The blog infrastructure ships, the landing page gains interactive comparisons and a testimonial carousel, and site analytics are in place.",
    items: [
      {
        label: "Feature",
        text: "Blog section launched at `/blog` — five categories (Engineering, Marketing, Content, Tools Roundup, Ozigi Focus) with author, read time, and category metadata.",
      },
      {
        label: "Feature",
        text: "Drag-to-reveal before/after slider on the landing page's \"difference\" section.",
      },
      {
        label: "Feature",
        text: "Testimonial carousel — endless-scrolling with six entries, seamless animations, and edge fade gradients.",
      },
      { label: "Infra", text: "Vercel Web Analytics integrated for site analytics." },
      {
        label: "Improvement",
        text: "All outbound emails now use `hello@ozigi.app` as the sender address.",
      },
      {
        label: "Improvement",
        text: "Dashboard loading states — improved skeleton loaders and confirmation dialogs.",
      },
    ],
    accent: "green",
  },
  {
    version: "v0.3",
    title: "Dashboard Redesign & Payments",
    date: "2026-04-03",
    dateLabel: "April 3–5, 2026",
    summary:
      "A full dashboard redesign, streamlined upgrade flows, and a more polished AI Copilot — plus end-to-end tests for the core journeys.",
    items: [
      {
        label: "Improvement",
        text: "Dashboard redesign — cleaner information hierarchy, revamped auth modals, improved error handling.",
      },
      {
        label: "Improvement",
        text: "AI Copilot — \"thinking\" state, working copy button, better styling and progress indicators during generation.",
      },
      {
        label: "Fix",
        text: "Moved to a stable generation API endpoint — eliminates phantom usage increments and streaming response issues.",
      },
      {
        label: "Improvement",
        text: "Upgrade flows simplified; demo dashboard redesigned for a clearer conversion path.",
      },
      { label: "Infra", text: "Playwright end-to-end tests for core flows." },
      { label: "Improvement", text: "SEO & branding meta improvements across documentation and blog pages." },
      { label: "Infra", text: "Initial Vercel Web Analytics install (superseded by v0.4)." },
    ],
    accent: "blue",
  },
  {
    version: "v0.2",
    title: "Scheduled Publishing, Project Imports & Email",
    date: "2026-04-01",
    dateLabel: "April 1–2, 2026",
    summary:
      "Scheduling, GitHub project imports, and the first email automation workflows land — with fixes to plan limits and Vertex AI auth.",
    items: [
      {
        label: "Feature",
        text: "Scheduled post publishing — pick when content gets published instead of publishing immediately.",
      },
      {
        label: "Feature",
        text: "GitHub project imports — pull in repositories as context for content generation.",
      },
      {
        label: "Feature",
        text: "Email automation — welcome email system and automated email workflows.",
      },
      {
        label: "Fix",
        text: "Free plan monthly counter now resets correctly; trial plan detection fixed to assign correct generation limits.",
      },
      { label: "Fix", text: "Vertex AI authentication resolved in sandbox environments." },
    ],
    accent: "blue",
  },
  {
    version: "v0.1",
    title: "Persona System & Foundation",
    date: "2026-03-05",
    dateLabel: "March 5–8, 2026",
    summary:
      "The persona system — the heart of Ozigi's voice control — ships with custom persona creation, a settings modal, and the foundational schema.",
    items: [
      {
        label: "Feature",
        text: "Persona voice selection — apply writing personas to shape the voice of generated content.",
      },
      { label: "Feature", text: "Custom persona creation beyond the system defaults." },
      { label: "Feature", text: "Settings modal for managing personas and preferences." },
      {
        label: "Infra",
        text: "Database schema — `personas` table renamed to `user_personas` for clarity.",
      },
      {
        label: "Improvement",
        text: "Persona UX refactor — improved select dropdown and management flow in SettingsModal.",
      },
      { label: "Infra", text: "App metadata — page titles, descriptions, and layout foundations." },
    ],
    accent: "green",
  },
];

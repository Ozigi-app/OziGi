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
    version: "v1.0",
    title: "Image Upgrade, Architecture & June Content Push",
    date: "2026-06-01",
    dateLabel: "June 1, 2026",
    summary:
      "Image generation moves to the stable Gemini 3.1 Flash Image model, the architecture page is replaced with current system documentation, the gating system is simplified, and eight long-form GTM articles ship across the blog.",
    items: [
      {
        label: "AI",
        text: "Image generation upgraded from `gemini-3.1-flash-image-preview` to the stable GA model `gemini-3.1-flash-image`. No change to the server-side R2 upload pipeline.",
      },
      {
        label: "Fix",
        text: "Credit bundle return URL (`?checkout=credits`) now fires the Google Ads conversion event, shows a 'Credits added' toast, and cleans the URL param — it previously landed silently with no feedback.",
      },
      {
        label: "Improvement",
        text: "Architecture page rewritten with five current decision records: GTM pipeline, JSON schema enforcement, image generation pipeline, and the Banned Lexicon (including the LinkedIn 360Brew compliance connection). Removed the dated LLM cost-comparison tab.",
      },
      {
        label: "Improvement",
        text: "Trial gating replaced — TrialBanner and TrialGateModal removed. LimitModal is now the single surface for plan-limit nudges, without the time-pressure framing.",
      },
      {
        label: "Feature",
        text: "GTM blog series: eight long-form articles on go-to-market for developer products published across June 1–12. Covers ICP definition, GitHub/Dev.to lead sourcing, email vs LinkedIn, cold email copywriting, daily send limits, and domain warmup.",
      },
      {
        label: "Infra",
        text: "README fully rewritten to reflect the current two-engine product, updated pricing, and accurate tech stack (R2, Dodo Payments, Composio CRM, Gemini 3.1 Flash Image).",
      },
    ],
    accent: "green",
  },
  {
    version: "v0.9",
    title: "Pricing Overhaul & Dodo Payments",
    date: "2026-05-20",
    dateLabel: "May 15–30, 2026",
    summary:
      "The entire pricing model is replaced. The old Team/Organization tiers are retired in favour of a five-tier system built around the two engines. Payments move to Dodo Payments with a full webhook pipeline into Supabase.",
    items: [
      {
        label: "Feature",
        text: "New pricing tiers: Free ($0 · 50 GTM credits + 3 content pieces), Starter ($19 · content engine only), Growth ($29 · GTM engine · 1,000 credits/mo), Pro ($49 · both engines, no limits), Enterprise (custom).",
      },
      {
        label: "Feature",
        text: "Credit bundles for Starter users who want outbound without upgrading: 200 credits for $5, 500 for $10, 1,500 for $25. Credits stack on the monthly plan and never expire.",
      },
      {
        label: "Infra",
        text: "Payments moved to Dodo Payments. `/api/create-checkout` handles subscription plans; `/api/create-bundle-checkout` handles one-time credit bundles. Both call the Dodo live API and return a `checkout_url`.",
      },
      {
        label: "Infra",
        text: "Dodo webhook at `/api/dodo-webhook` processes subscription lifecycle events and writes plan state directly to Supabase.",
      },
      {
        label: "Improvement",
        text: "Multi-inbox rotation added as a Pro-only feature. Campaigns on Pro can spread daily sends across multiple sending accounts to protect domain reputation at higher volumes.",
      },
      {
        label: "Improvement",
        text: "Content entitlements restructured: newsletter sending moved to Starter+, image generation (2/campaign) added to Starter, scheduling moved to Starter+, subscriber list management and campaign analytics gated to Pro+.",
      },
    ],
    accent: "blue",
  },
  {
    version: "v0.8",
    title: "GTM Engine — Lead Sourcing, Scoring & Outreach",
    date: "2026-05-08",
    dateLabel: "May 8–14, 2026",
    summary:
      "The GTM engine ships as a full second product line inside the same dashboard. Source leads from GitHub, Dev.to, and LinkedIn, score them against an ICP with Gemini, run email and LinkedIn sequences from your own accounts, and sync to your CRM — all in one voice.",
    items: [
      {
        label: "Feature",
        text: "Lead sourcing from GitHub: bio-keyword + language + location query against the GitHub user search API. Commit-history email recovery when a profile hides its email address.",
      },
      {
        label: "Feature",
        text: "Lead sourcing from Dev.to: pulls authors by tag, matched against ICP topic keywords.",
      },
      {
        label: "Feature",
        text: "ICP scoring: every sourced lead is scored by Gemini (0.0–1.0) against the ICP defined on the campaign. Leads below threshold are dropped before entering any sequence.",
      },
      {
        label: "Feature",
        text: "Email + LinkedIn sequences: multi-step outreach from your own accounts with configurable step delays and per-channel daily limits. Reply detection pauses the sequence automatically on any inbound response.",
      },
      {
        label: "Feature",
        text: "CRM sync: first-contact write to HubSpot or Zoho via Composio. Available on Growth and Pro.",
      },
      {
        label: "AI",
        text: "GTM outreach copy uses the same Banned Lexicon and persona system as the content engine — the cold email and the blog post read as the same person because they are written by the same engine.",
      },
      {
        label: "Infra",
        text: "GTM cron workers (`/api/gtm/cron/scrape` and `/api/gtm/cron/send`) handle sourcing and sequence delivery on schedules managed by QStash.",
      },
    ],
    accent: "purple",
  },
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

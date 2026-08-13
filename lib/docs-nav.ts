/**
 * Docs navigation — single source of truth.
 *
 * Drives the persistent sidebar, the previous/next footer links, the deep-dive
 * hub, and page metadata. Adding a page means adding one entry here plus the
 * matching MDX file in content/docs/. Nothing else needs touching.
 *
 * Order within this array is the reading order used for prev/next.
 */

export type DocsGroup =
  | 'Getting Started'
  | 'Content Engine'
  | 'Outbound'
  | 'Integrations'
  | 'Deep Dives'
  | 'Help';

export const DOCS_GROUP_ORDER: DocsGroup[] = [
  'Getting Started',
  'Content Engine',
  'Outbound',
  'Integrations',
  'Deep Dives',
  'Help',
];

export interface DocsPage {
  /** URL slug. Empty string is the /docs landing page. */
  slug: string;
  /** Short label for the sidebar. */
  nav: string;
  /** Full page title (h1 / <title>). */
  title: string;
  /** One line, used for meta description and hub cards. */
  description: string;
  group: DocsGroup;
  /** Deep dives get the numbered "Deep Dive N of M" treatment and FAQ schema. */
  type: 'guide' | 'deep-dive';
  icon?: string;
}

export const DOCS_PAGES: DocsPage[] = [
  // ── Getting Started ──────────────────────────────────────────────────────
  {
    slug: '',
    nav: 'Introduction',
    title: 'Ozigi Documentation',
    description: 'What Ozigi does, how the two engines fit together, and where to start.',
    group: 'Getting Started',
    type: 'guide',
  },
  {
    slug: 'quick-start',
    nav: 'Quick Start',
    title: 'Quick Start',
    description: 'Get outbound running and your first content piece live in about ten minutes.',
    group: 'Getting Started',
    type: 'guide',
  },
  {
    slug: 'platform-overview',
    nav: 'Platform Overview',
    title: 'Platform Overview',
    description: 'The two engines, what they share, and which one you actually need.',
    group: 'Getting Started',
    type: 'guide',
  },

  // ── Content Engine ───────────────────────────────────────────────────────
  {
    slug: 'social-posts',
    nav: 'Social Posts',
    title: 'Social Posts',
    description: 'Turn a URL, a brain dump, or a PDF into posts for LinkedIn, X, Discord, and Slack at once.',
    group: 'Content Engine',
    type: 'guide',
  },
  {
    slug: 'newsletter',
    nav: 'Newsletter',
    title: 'Newsletter & Subscribers',
    description: 'Write, schedule, and send email newsletters, and manage the list they go to.',
    group: 'Content Engine',
    type: 'guide',
  },
  {
    slug: 'long-form',
    nav: 'Long-Form Articles',
    title: 'Long-Form Articles',
    description: 'Blog posts and technical articles from 800 to 8,000 words, calibrated to a reader and audited before you see them.',
    group: 'Content Engine',
    type: 'guide',
  },
  {
    slug: 'personas',
    nav: 'Personas',
    title: 'Personas',
    description: 'Voice profiles that shape every post, email, and article. The single highest-leverage thing you can configure.',
    group: 'Content Engine',
    type: 'guide',
  },

  // ── Outbound ─────────────────────────────────────────────────────────────
  {
    slug: 'campaigns',
    nav: 'Campaigns',
    title: 'Campaigns',
    description: 'Define an ICP, source leads from GitHub, Dev.to, npm and Hacker News, and score them before anyone gets emailed.',
    group: 'Outbound',
    type: 'guide',
  },
  {
    slug: 'sequences-and-sending',
    nav: 'Sequences & Sending',
    title: 'Sequences & Sending',
    description: 'Multi-step email and LinkedIn sequences, daily limits, reply detection, and how sends are scheduled.',
    group: 'Outbound',
    type: 'guide',
  },
  {
    slug: 'email-setup',
    nav: 'Email Setup',
    title: 'Email Setup',
    description: 'Connect a Gmail App Password or any SMTP provider. Required before a campaign can send.',
    group: 'Outbound',
    type: 'guide',
  },
  {
    slug: 'linkedin-extension',
    nav: 'LinkedIn Extension',
    title: 'LinkedIn Extension',
    description: 'LinkedIn outreach runs from your own browser tab, at human pace, never from a server.',
    group: 'Outbound',
    type: 'guide',
  },

  // ── Integrations ─────────────────────────────────────────────────────────
  {
    slug: 'integrations',
    nav: 'CRM, Publishing & Webhooks',
    title: 'Integrations',
    description: 'CRM sync, how each social platform publishes, and Discord and Slack webhooks.',
    group: 'Integrations',
    type: 'guide',
  },

  // ── Deep Dives ───────────────────────────────────────────────────────────
  {
    slug: 'multimodal-pipeline',
    nav: '1. Multimodal Ingestion',
    title: 'Multimodal Ingestion',
    description: 'How the Context Engine extracts narrative from unstructured dumps, URLs, and PDFs.',
    group: 'Deep Dives',
    type: 'deep-dive',
    icon: '🧠',
  },
  {
    slug: 'the-banned-lexicon',
    nav: '2. The Banned Lexicon',
    title: 'The Banned Lexicon',
    description: "Curing 'AI-Speak' by enforcing aggressive, API-level token restrictions.",
    group: 'Deep Dives',
    type: 'deep-dive',
    icon: '🚫',
  },
  {
    slug: 'system-personas',
    nav: '3. System Personas',
    title: 'System Personas',
    description: 'Why we abandon standard prompting in favor of strict Editorial Briefs.',
    group: 'Deep Dives',
    type: 'deep-dive',
    icon: '🎭',
  },
  {
    slug: 'human-in-the-loop',
    nav: '4. Human-in-the-Loop',
    title: 'Human-in-the-Loop',
    description: 'The automation fallacy and the 90/10 rule of collaborative content engineering.',
    group: 'Deep Dives',
    type: 'deep-dive',
    icon: '🤝',
  },
  {
    slug: 'the-structural-audit',
    nav: '5. The Structural Audit',
    title: 'The Structural Audit',
    description: "Catching the AI tells a word list can't reach — cadence, repetition, broken code, and content aimed at the wrong reader.",
    group: 'Deep Dives',
    type: 'deep-dive',
    icon: '📐',
  },

  // ── Help ─────────────────────────────────────────────────────────────────
  {
    slug: 'troubleshooting',
    nav: 'Troubleshooting',
    title: 'Troubleshooting',
    description: 'The failures that actually come up, and what to do about each one.',
    group: 'Help',
    type: 'guide',
  },
];

export const DEEP_DIVES = DOCS_PAGES.filter((p) => p.type === 'deep-dive');

export function hrefFor(page: Pick<DocsPage, 'slug'>): string {
  return page.slug ? `/docs/${page.slug}` : '/docs';
}

export function findPage(slug: string): DocsPage | undefined {
  return DOCS_PAGES.find((p) => p.slug === slug);
}

/** Pages bucketed by group, in DOCS_GROUP_ORDER. Empty groups are dropped. */
export function groupedNav(): Array<{ group: DocsGroup; pages: DocsPage[] }> {
  return DOCS_GROUP_ORDER.map((group) => ({
    group,
    pages: DOCS_PAGES.filter((p) => p.group === group),
  })).filter((g) => g.pages.length > 0);
}

/** Previous and next page in reading order, for the page footer. */
export function neighbours(slug: string): { prev: DocsPage | null; next: DocsPage | null } {
  const i = DOCS_PAGES.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? DOCS_PAGES[i - 1] : null,
    next: i < DOCS_PAGES.length - 1 ? DOCS_PAGES[i + 1] : null,
  };
}

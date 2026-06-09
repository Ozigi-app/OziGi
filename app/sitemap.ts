import { MetadataRoute } from "next";
import { changelog } from "@/lib/changelog";
import { TUTORIALS } from "@/lib/tutorials";

const BASE = "https://ozigi.app";

export default function sitemap(): MetadataRoute.Sitemap {
  /* ── Static core pages ─────────────────────────────────────────── */
  const staticRoutes: MetadataRoute.Sitemap = [
    // Highest-value conversion pages
    { url: BASE,                            lastModified: new Date("2026-06-09"), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/pricing`,               lastModified: new Date("2026-06-01"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/demo`,                  lastModified: new Date("2026-05-20"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/content-engine`,        lastModified: new Date("2026-05-20"), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/from-youtube`,          lastModified: new Date("2026-05-20"), changeFrequency: "monthly", priority: 0.8 },

    // Content & tools
    { url: `${BASE}/blog`,                  lastModified: new Date("2026-06-09"), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/write`,                 lastModified: new Date("2026-05-20"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/tutorials`,             lastModified: new Date("2026-05-01"), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/email`,                 lastModified: new Date("2026-06-01"), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/changelog`,             lastModified: new Date("2026-06-01"), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/architecture`,          lastModified: new Date("2026-06-01"), changeFrequency: "monthly", priority: 0.6 },

    // Docs
    { url: `${BASE}/docs`,                          lastModified: new Date("2026-05-20"), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/docs/deep-dives`,               lastModified: new Date("2026-05-20"), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/docs/webhooks`,                 lastModified: new Date("2026-05-08"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs/multimodal-pipeline`,      lastModified: new Date("2026-04-10"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs/the-banned-lexicon`,       lastModified: new Date("2026-05-07"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs/system-personas`,          lastModified: new Date("2026-04-10"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs/human-in-the-loop`,        lastModified: new Date("2026-04-10"), changeFrequency: "monthly", priority: 0.6 },

    // Legal
    { url: `${BASE}/terms`,          lastModified: new Date("2026-01-01"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy-policy`, lastModified: new Date("2026-01-01"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/cookie-policy`,  lastModified: new Date("2026-01-01"), changeFrequency: "yearly", priority: 0.3 },
  ];

  /* ── Changelog versions — one URL per version ──────────────────── */
  // changelog entries don't have their own URL pages yet, so we
  // only include the index. When individual version pages exist,
  // swap to: url: `${BASE}/changelog/${entry.version}`
  // (kept as a ready-to-uncomment block below)
  //
  // const changelogRoutes: MetadataRoute.Sitemap = changelog.map((entry) => ({
  //   url: `${BASE}/changelog/${entry.version}`,
  //   lastModified: new Date(entry.date),
  //   changeFrequency: "never" as const,
  //   priority: 0.5,
  // }));

  /* ── Tutorial pages ─────────────────────────────────────────────── */
  // Tutorials are listed on /tutorials — no individual slug pages exist yet.
  // When /tutorials/[slug] pages go live, uncomment this block:
  //
  // const tutorialRoutes: MetadataRoute.Sitemap = TUTORIALS.map((t) => ({
  //   url: `${BASE}/tutorials/${t.slug}`,
  //   lastModified: new Date(t.publishedAt),
  //   changeFrequency: "monthly" as const,
  //   priority: 0.65,
  // }));

  return [
    ...staticRoutes,
    // ...changelogRoutes,
    // ...tutorialRoutes,
  ];
}

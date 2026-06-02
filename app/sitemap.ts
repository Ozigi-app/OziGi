import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://ozigi.app";
  return [
    // Core — highest priority
    { url: baseUrl,                                   lastModified: new Date("2025-06-01"), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${baseUrl}/pricing`,                      lastModified: new Date("2025-06-01"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/demo`,                         lastModified: new Date("2025-05-01"), changeFrequency: "monthly", priority: 0.8 },

    // Content & tools
    { url: `${baseUrl}/write`,                        lastModified: new Date("2025-05-01"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/tutorials`,                    lastModified: new Date("2025-05-01"), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${baseUrl}/changelog`,                    lastModified: new Date("2025-06-01"), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${baseUrl}/email`,                        lastModified: new Date("2025-06-01"), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${baseUrl}/architecture`,                 lastModified: new Date("2025-04-01"), changeFrequency: "monthly", priority: 0.6 },

    // Docs
    { url: `${baseUrl}/docs`,                         lastModified: new Date("2025-05-01"), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${baseUrl}/docs/deep-dives`,              lastModified: new Date("2025-05-01"), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${baseUrl}/docs/webhooks`,                lastModified: new Date("2025-05-01"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/docs/multimodal-pipeline`,     lastModified: new Date("2025-04-01"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/docs/the-banned-lexicon`,      lastModified: new Date("2025-04-01"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/docs/system-personas`,         lastModified: new Date("2025-04-01"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/docs/human-in-the-loop`,       lastModified: new Date("2025-04-01"), changeFrequency: "monthly", priority: 0.6 },

    // Legal — low priority but indexable
    { url: `${baseUrl}/terms`,                        lastModified: new Date("2025-01-01"), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${baseUrl}/privacy-policy`,               lastModified: new Date("2025-01-01"), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${baseUrl}/cookie-policy`,                lastModified: new Date("2025-01-01"), changeFrequency: "yearly",  priority: 0.3 },
  ];
}

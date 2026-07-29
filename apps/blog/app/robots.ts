import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Blog content is now canonical at ozigi.app/blog — point crawlers at the
  // main sitemap so old blog.ozigi.app URLs don't get indexed as a duplicate.
  const sitemap = 'https://ozigi.app/sitemap.xml';
  const host = 'https://ozigi.app';

  const disallow = ['/admin/', '/api/', '/.'];

  return {
    rules: [
      // ── Search engines ──────────────────────────────────────────
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow,
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow,
      },
      // ── AI crawlers — allowed, no disallow ─────────────────────
      { userAgent: 'GPTBot',        allow: '/' },
      { userAgent: 'ChatGPT-User',  allow: '/' },
      { userAgent: 'CCBot',         allow: '/' },
      { userAgent: 'anthropic-ai',  allow: '/' },
      { userAgent: 'Claude-Web',    allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      // ── Everyone else ───────────────────────────────────────────
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
    ],
    sitemap,
    host,
  };
}

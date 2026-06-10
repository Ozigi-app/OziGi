import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const sitemap = 'https://blog.ozigi.app/sitemap.xml';
  const host = 'https://blog.ozigi.app';

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

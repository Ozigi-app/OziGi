import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    webpackBuildWorker: true,
  },
  // Email templates are read at runtime with fs.readFileSync — Next.js won't
  // trace them automatically because the path is dynamic. Explicitly include
  // them so Vercel bundles the files into the notify serverless functions.
  outputFileTracingIncludes: {
    '/api/gtm/notify/**': ['./emails/**'],
  },
  // Blog migration (ozigi.app/blog/*): proxy to the separate blog.ozigi.app
  // deployment so all blog authority consolidates on the main domain.
  // apps/blog's own canonicals/sitemap/RSS already point at ozigi.app/blog.
  //
  // The `__ozigi_proxy=1` query param marks requests that arrived via this
  // rewrite so apps/blog/middleware.ts can tell them apart from someone
  // hitting blog.ozigi.app directly (who should get redirected instead).
  // We tried detecting this via the `x-forwarded-host` header first, but
  // that isn't reliably set for rewrites to an external domain and caused a
  // redirect loop in production — this query param is fully in our control.
  async rewrites() {
    return [
      { source: '/blog', destination: 'https://blog.ozigi.app?__ozigi_proxy=1' },
      { source: '/blog/feed.xml', destination: 'https://blog.ozigi.app/feed.xml?__ozigi_proxy=1' },
      { source: '/blog/:path*', destination: 'https://blog.ozigi.app/blog/:path*?__ozigi_proxy=1' },
    ];
  },
};

// Only apply Sentry config if auth token is available
const sentryConfig = {
  org: "ozigi",
  project: "javascript-nextjs",
  silent: true,
  widenClientFileUpload: true,
  // tunnelRoute was proxying every client-side Sentry payload (errors, traces,
  // session replay chunks) through a Vercel Function on this project, so all of
  // that browser telemetry was billed as our own compute. Its only benefit is
  // dodging ad blockers; that isn't worth paying serverless CPU for, so the
  // browser now posts straight to Sentry's ingest endpoint.
  automaticVercelMonitors: true,
  hideSourceMaps: false,
  disableLogger: true,
  telemetry: false,
  // Disable source map upload entirely when no auth token
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  release: {
    create: !!process.env.SENTRY_AUTH_TOKEN,
    finalize: !!process.env.SENTRY_AUTH_TOKEN,
  },
};

export default withSentryConfig(nextConfig, sentryConfig);

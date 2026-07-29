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
  async rewrites() {
    return [
      { source: '/blog', destination: 'https://blog.ozigi.app' },
      { source: '/blog/feed.xml', destination: 'https://blog.ozigi.app/feed.xml' },
      { source: '/blog/:path*', destination: 'https://blog.ozigi.app/blog/:path*' },
    ];
  },
};

// Only apply Sentry config if auth token is available
const sentryConfig = {
  org: "ozigi",
  project: "javascript-nextjs",
  silent: true,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
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

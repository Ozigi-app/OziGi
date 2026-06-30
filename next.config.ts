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

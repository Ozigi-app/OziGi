// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://0c22d3ac235eb3968f0b71ffab86dd67@o4511042432270336.ingest.de.sentry.io/4511042438758480",

  // Tracing every server request costs Fluid Active CPU on every invocation.
  // 10% is plenty to spot latency regressions; errors are still captured at
  // 100% regardless of this rate.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

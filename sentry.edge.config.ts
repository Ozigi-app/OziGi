// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://0c22d3ac235eb3968f0b71ffab86dd67@o4511042432270336.ingest.de.sentry.io/4511042438758480",

  // This config loads inside middleware, which runs ahead of matched requests —
  // so a 100% trace rate meant building and serialising a transaction on every
  // one of them. Middleware traces are the highest-volume and least useful
  // thing we send, so production samples them thinly.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.02 : 1,

  // Off in production for the same reason: log capture adds per-request
  // serialisation work in the hottest path we have.
  enableLogs: process.env.NODE_ENV !== "production",

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

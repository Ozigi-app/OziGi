/**
 * Playwright global setup — runs once before all tests.
 *
 * Responsibilities:
 *   1. Create the playwright/.auth directory for stored sessions
 *   2. Pre-authenticate test users and save their storage state to disk
 *      so individual test files can reuse sessions without re-logging in
 *
 * Run order: globalSetup → projects (chromium, mobile) → globalTeardown
 *
 * To skip API-based auth (e.g. when env vars aren't set), the setup
 * exits gracefully — unauthenticated tests will still run.
 */

import { chromium, type FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Load .env.local so SUPABASE vars are available without a .env.test file
const envLocalPath = path.resolve(".env.local");
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

import { signInViaApi, AUTH_STATE_FILE, PRO_AUTH_STATE_FILE, TEST_EMAIL, TEST_PASSWORD, PRO_EMAIL, PRO_PASSWORD } from "./helpers/auth";

/** Pre-warm Next.js dev-server routes so per-test timeouts are not eaten by cold compiles.
 *
 * Fires all requests IN PARALLEL so the dev server compiles routes concurrently
 * (much faster than sequential). Each request waits up to 200s individually.
 */
async function warmRoutes(baseURL: string) {
  const routes = [
    "/",
    "/pricing",
    // Note: /blog has no index page (only /blog/[slug] exists)
    "/blog/the-future-of-ai-powered-gtm",
    "/docs",
    "/dashboard",
    "/dashboard/billing",
    "/dashboard/long-form",
    "/dashboard/gtm",
    "/dashboard/gtm/new",
    "/dashboard/gtm/outreach",
    "/dashboard/gtm/settings",
    "/dashboard/gtm/review",
    "/dashboard/personas/marketplace",
    "/reset-password",
    "/auth-error",
    "/email",
  ];

  console.log(`[global-setup] Pre-warming ${routes.length} routes in parallel on ${baseURL}…`);

  // Fire ALL requests simultaneously — dev server compiles concurrently
  const results = await Promise.allSettled(
    routes.map(async (route) => {
      const url = `${baseURL}${route}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(200_000) });
      console.log(`[global-setup]   ${res.status} ${route}`);
      return { route, status: res.status };
    })
  );

  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  console.log(`[global-setup] Pre-warming complete: ${succeeded} ok, ${failed} timed out (still compiling in dev server).`);
}

export default async function globalSetup(config: FullConfig) {
  // Ensure the .auth directory exists
  const authDir = path.resolve("playwright/.auth");
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
  // Pre-warm routes only on local dev AND only when NOT using a pre-built prod server.
  // With `npm run build && npm start` (USE_PROD_SERVER=1), all routes are already compiled.
  const isLocalDev = baseURL.includes("localhost");
  const isDevServer = !process.env.USE_PROD_SERVER;
  if (isLocalDev && isDevServer) {
    await warmRoutes(baseURL);
  } else if (isLocalDev) {
    console.log("[global-setup] Production build detected — skipping route pre-warming.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[global-setup] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set — " +
      "skipping session pre-auth. Tests requiring authentication will use the fixture-based approach."
    );
    return;
  }

  const browser = await chromium.launch();

  // ── Free-tier test user ──────────────────────────────────────────────────────
  try {
    const freeContext = await browser.newContext();
    await signInViaApi(freeContext, TEST_EMAIL, TEST_PASSWORD);
    const page = await freeContext.newPage();
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000/dashboard");
    await freeContext.storageState({ path: AUTH_STATE_FILE });
    await freeContext.close();
    console.log(`[global-setup] ✓ Free-tier auth state saved to ${AUTH_STATE_FILE}`);
  } catch (err) {
    console.warn(`[global-setup] Could not pre-auth free user (${TEST_EMAIL}):`, err);
  }

  // ── Pro-tier test user ───────────────────────────────────────────────────────
  try {
    const proContext = await browser.newContext();
    await signInViaApi(proContext, PRO_EMAIL, PRO_PASSWORD);
    const page = await proContext.newPage();
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000/dashboard");
    await proContext.storageState({ path: PRO_AUTH_STATE_FILE });
    await proContext.close();
    console.log(`[global-setup] ✓ Pro-tier auth state saved to ${PRO_AUTH_STATE_FILE}`);
  } catch (err) {
    console.warn(`[global-setup] Could not pre-auth pro user (${PRO_EMAIL}):`, err);
  }

  await browser.close();
}

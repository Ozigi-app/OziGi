import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

/**
 * E2E Test Configuration for Ozigi
 *
 * Supports three environments via BASE_URL env var:
 * - Local:   npm run test (uses localhost:3000)
 * - Staging: BASE_URL=https://staging.ozigi.app npm run test
 * - Prod:    BASE_URL=https://ozigi.app npm run test
 *
 * Authentication:
 * Set TEST_USER_EMAIL / TEST_USER_PASSWORD and TEST_PRO_EMAIL / TEST_PRO_PASSWORD
 * to enable authenticated test fixtures. See tests/helpers/auth.ts.
 */
const baseURL = process.env.BASE_URL || 'http://localhost:3000';
const isLocalDev = baseURL.includes('localhost');

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  globalSetup: "./tests/global-setup.ts",

  reporter: [
    ['html'],
    ['list'],
    ...(process.env.CI ? [['github' as const]] : []),
  ],

  /* Timeout settings.
   *
   * On dev server: routes compile on first hit (can take 2-3 min each on this machine).
   * Set per-test timeout to 5 minutes so compilation doesn't cause false failures.
   * On a production build or CI with pre-built artifacts, 60s is sufficient.
   */
  timeout: (process.env.USE_PROD_SERVER || process.env.CI)
    ? 60 * 1000     // 60s on prod build / CI (routes already compiled)
    : 300 * 1000,   // 5 min on dev server (allows for on-demand compilation)
  expect: {
    timeout: 15 * 1000,     // 15s for assertions
  },

  /* Local server configuration.
   *
   * Default (dev mode):  npm run test
   *   Starts `next dev` which compiles routes on demand — slow first run.
   *
   * Recommended (prod mode): npm run build  →  npm run start  →  npm run test
   *   Routes are pre-compiled; tests run in seconds not minutes.
   *   Set USE_PROD_SERVER=1 to prevent Playwright from restarting the server.
   */
  ...(isLocalDev && {
    webServer: {
      command: process.env.USE_PROD_SERVER ? 'npm run start' : 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true, // always reuse if already running
      timeout: process.env.USE_PROD_SERVER ? 30 * 1000 : 180 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  }),

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // ── Desktop browsers ──────────────────────────────────────────────────────
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    // ── Mobile browsers ───────────────────────────────────────────────────────
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],
});

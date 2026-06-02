/**
 * Auth helpers for Ozigi E2E tests.
 *
 * Provides utilities to sign in via Supabase magic link / email+password,
 * store auth state to disk, and reuse it across test files so we don't
 * hit the auth flow on every single test.
 *
 * Environment variables expected:
 *   TEST_USER_EMAIL    – e.g. test@example.com
 *   TEST_USER_PASSWORD – e.g. SuperSecret123!
 *   TEST_PRO_EMAIL     – pro-tier test account (for gated features)
 *   TEST_PRO_PASSWORD
 */

import { type Page, type BrowserContext, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Load .env.local so Supabase URL / anon key are available in fixture contexts
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

export const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "test@ozigi.test";
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "Test1234!";
export const PRO_EMAIL = process.env.TEST_PRO_EMAIL ?? "pro@ozigi.test";
export const PRO_PASSWORD = process.env.TEST_PRO_PASSWORD ?? "ProTest1234!";

// State files so Playwright can reuse sessions between spec files
export const AUTH_STATE_FILE = "playwright/.auth/user.json";
export const PRO_AUTH_STATE_FILE = "playwright/.auth/pro-user.json";

/**
 * Fills the AuthModal sign-in form and completes authentication.
 * Waits for a redirect to /dashboard to confirm success.
 */
export async function signInViaModal(
  page: Page,
  email = TEST_EMAIL,
  password = TEST_PASSWORD
) {
  // Open auth modal if not already open
  const modal = page.locator('[role="dialog"], [data-testid="auth-modal"]');
  if (!(await modal.isVisible().catch(() => false))) {
    // Try clicking any "Sign in" / "Start free" CTA
    const cta = page
      .locator('button')
      .filter({ hasText: /sign in|get started|start free|start your/i })
      .first();
    await cta.click();
    await modal.waitFor({ state: "visible", timeout: 10_000 });
  }

  // Switch to the email/password tab if tabs are present
  const emailTab = page.locator('button, [role="tab"]').filter({ hasText: /email|password/i }).first();
  if (await emailTab.isVisible().catch(() => false)) {
    await emailTab.click();
  }

  await page.fill('input[type="email"]', email);

  const pwInput = page.locator('input[type="password"]').first();
  if (await pwInput.isVisible().catch(() => false)) {
    await pwInput.fill(password);
  }

  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Continue")');

  // Wait for either dashboard redirect or a success indicator
  await Promise.race([
    page.waitForURL("**/dashboard**", { timeout: 20_000 }),
    page.locator('[data-testid="dashboard-loaded"], [data-tour="overview-stats"]').waitFor({ timeout: 20_000 }),
  ]);
}

/**
 * Sign in directly via Supabase REST API (no UI) — much faster for setup.
 * Injects the session cookie so subsequent page loads are authenticated.
 */
export async function signInViaApi(
  context: BrowserContext,
  email = TEST_EMAIL,
  password = TEST_PASSWORD
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for API-based sign-in"
    );
  }

  const res = await context.request.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      data: { email, password },
    }
  );

  if (!res.ok()) {
    throw new Error(`Auth API returned ${res.status()}: ${await res.text()}`);
  }

  const { access_token, refresh_token } = await res.json();

  // Store tokens in localStorage so Supabase SSR picks them up
  await context.addInitScript(
    ({ url, anonKey, accessToken, refreshToken }) => {
      const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: "bearer",
          expires_in: 3600,
        })
      );
    },
    {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      accessToken: access_token,
      refreshToken: refresh_token,
    }
  );

  return { access_token, refresh_token };
}

/** Navigates to /dashboard and asserts that we're actually logged in. */
export async function assertAuthed(page: Page) {
  await page.goto("/dashboard");
  await expect(page).not.toHaveURL(/login|auth-error/, { timeout: 10_000 });
  await expect(page.locator("body")).not.toContainText(/sign in|log in/i);
}

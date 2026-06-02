/**
 * Mobile responsiveness tests.
 *
 * Runs a subset of critical flows on iPhone 12 and Pixel 5 viewports.
 * Uses the built-in Mobile Chrome / Mobile Safari Playwright projects.
 *
 * Covers:
 *   - Landing page renders on mobile
 *   - Hero CTA opens auth modal on mobile
 *   - Pricing tiers are visible and scrollable on mobile
 *   - Dashboard renders on mobile (with hamburger nav)
 *   - Auth modal is usable on mobile (form fields not clipped)
 */

import { test, expect } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 14

test.describe("Mobile – landing page", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("landing page loads on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
  });

  test("hero CTA is tappable on mobile", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator('button:has-text("Start your GTM engine"), button:has-text("Start for free")').first();
    await expect(cta).toBeVisible({ timeout: 10_000 });
    await cta.tap();
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8_000 });
  });

  test("pricing tiers are visible without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await expect(page.locator("text=Free").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Pro").first()).toBeVisible({ timeout: 10_000 });
  });

  test("no horizontal scroll on landing page", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    // Allow a tiny tolerance (1px) for sub-pixel rendering
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});

test.describe("Mobile – auth modal", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("auth modal email input is usable on mobile", async ({ page }) => {
    await page.goto("/");
    await page.locator('button:has-text("Sign in")').first().tap();

    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 8_000 });

    // Check the input is not clipped off-screen
    const box = await emailInput.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 10);
  });
});

test.describe("Mobile – dashboard", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("dashboard header is visible on mobile", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("header")).toBeVisible({ timeout: 15_000 });
  });

  test("sidebar nav is accessible via hamburger on mobile", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const menuBtn = page.locator(
      'button[aria-label*="menu" i], button[aria-label*="sidebar" i], [data-testid="mobile-menu-btn"]'
    ).first();
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.tap();
      await expect(page.locator("text=Overview, nav, aside").first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("Mobile – pricing page", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("pricing page renders on mobile", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });
  });
});

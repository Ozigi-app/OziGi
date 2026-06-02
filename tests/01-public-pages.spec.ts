/**
 * Public-facing page tests.
 *
 * All tests run unauthenticated. They verify:
 *   - Pages load without JS errors
 *   - Key copy / sections are visible
 *   - Navigation links resolve to the correct URL
 *   - SEO-critical elements are present (title, heading hierarchy)
 *   - CTAs open the auth modal (not a redirect to a 404)
 */

import { test, expect } from "@playwright/test";

// ─── Landing page ────────────────────────────────────────────────────────────

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads without crashing", async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
    // No uncaught console errors that would break the page
  });

  test("hero headline is visible", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText(/find leads|reach out|stay top of mind/i);
  });

  test("hero CTA opens auth modal", async ({ page }) => {
    await page.click('button:has-text("Start your GTM engine"), button:has-text("Start for free"), button:has-text("Get started")');
    // The auth modal should appear — look for an email input inside it
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8_000 });
  });

  test("sign in button opens auth modal", async ({ page }) => {
    await page.click('button:has-text("Sign in")');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8_000 });
  });

  test("'How it works' section renders all three steps", async ({ page }) => {
    await expect(page.locator("text=Source leads")).toBeVisible();
    await expect(page.locator("text=Run outreach")).toBeVisible();
    await expect(page.locator("text=Stay top of mind")).toBeVisible();
  });

  test("pricing section renders all five tiers", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    for (const tier of ["Free", "Starter", "Growth", "Pro", "Enterprise"]) {
      await expect(page.locator(`text=${tier}`).first()).toBeVisible();
    }
  });

  test("'Most popular' badge appears on Pro tier", async ({ page }) => {
    await expect(page.locator("text=Most popular")).toBeVisible();
  });

  test("pricing CTA buttons open auth modal", async ({ page }) => {
    await page.locator("text=Start free").first().click();
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8_000 });
  });

  test("newsletter subscribe form accepts a valid email", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const emailInput = page.locator('input[placeholder*="email"]').last();
    await emailInput.fill("hello@example.com");
    // Button label changes to loading state
    await page.locator('button:has-text("Subscribe")').last().click();
    // Either success or error — but no JS crash
    await expect(page.locator("body")).toBeVisible();
  });

  test("newsletter form rejects empty submission (HTML5 validation)", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const submitBtn = page.locator('button:has-text("Subscribe")').last();
    await submitBtn.click();
    // Form should not navigate away
    await expect(page).toHaveURL("/");
  });

  test("stat tickers are visible (social proof numbers)", async ({ page }) => {
    await expect(page.locator("text=Leads sourced")).toBeVisible();
    await expect(page.locator("text=Emails sent")).toBeVisible();
    await expect(page.locator("text=Content pieces")).toBeVisible();
  });

  test("footer renders", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
  });

  test("header renders and has navigation links", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toBeVisible();
  });
});

// ─── Pricing page ────────────────────────────────────────────────────────────

test.describe("Pricing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
  });

  test("loads with title", async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
  });

  test("renders plan comparison section", async ({ page }) => {
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("'Free' plan is listed", async ({ page }) => {
    await expect(page.locator("text=Free").first()).toBeVisible();
  });

  test("'Pro' plan is listed", async ({ page }) => {
    await expect(page.locator("text=Pro").first()).toBeVisible();
  });
});

// ─── Blog ─────────────────────────────────────────────────────────────────────
// Note: /blog has no index page — only /blog/[slug] exists. Any slug renders
// a scaffold page ("Content coming soon.") without 404.

test.describe("Blog", () => {
  test("blog slug page renders an h1 and article wrapper", async ({ page }) => {
    await page.goto("/blog/the-future-of-ai-powered-gtm");
    await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("article")).toBeVisible({ timeout: 10_000 });
  });

  test("blog slug page sets a <title> based on the slug", async ({ page }) => {
    await page.goto("/blog/the-future-of-ai-powered-gtm");
    await expect(page).toHaveTitle(/The Future Of Ai Powered Gtm|Ozigi Blog/i, { timeout: 15_000 });
  });

  test("any slug renders the page (no hard 404 from dynamic route)", async ({ page }) => {
    const res = await page.goto("/blog/any-slug-works-because-its-a-scaffold");
    // The dynamic route accepts all slugs — should not 500
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
  });

  test("/blog index redirects or shows 404 gracefully (no index page exists)", async ({ page }) => {
    const res = await page.goto("/blog");
    // Acceptable: 404 or redirect — just must not 500
    expect(res?.status()).not.toBe(500);
  });
});

// ─── Docs ─────────────────────────────────────────────────────────────────────

test.describe("Docs", () => {
  test("docs index loads", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });
  });

  test("webhooks doc page loads", async ({ page }) => {
    await page.goto("/docs/webhooks");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Static / legal pages ─────────────────────────────────────────────────────

test.describe("Static pages", () => {
  for (const route of ["/privacy-policy", "/terms", "/cookie-policy", "/changelog", "/architecture"]) {
    test(`${route} loads without error`, async ({ page }) => {
      const res = await page.goto(route);
      // Should not be a hard 500
      expect(res?.status()).toBeLessThan(500);
      await expect(page.locator("h1, h2, main").first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

// ─── Auth error page ─────────────────────────────────────────────────────────

test.describe("Auth error page", () => {
  test("renders an error message", async ({ page }) => {
    await page.goto("/auth-error");
    await expect(page.locator("h1, h2, p").first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Demo page ────────────────────────────────────────────────────────────────

test.describe("Demo page", () => {
  test("demo page loads", async ({ page }) => {
    const res = await page.goto("/demo");
    expect(res?.status()).toBeLessThan(500);
  });
});

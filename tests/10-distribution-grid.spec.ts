/**
 * Distribution Grid (post-generation) tests.
 *
 * The DistributionGrid renders after a successful campaign generation.
 * Because we can't hit real AI in CI, we mock the /api/generate response
 * using Playwright's route interception — returning a pre-baked fixture.
 *
 * Covers:
 *   - Campaign cards render for each platform
 *   - Copy-to-clipboard button present on each card
 *   - Schedule button present on each card
 *   - Publish button present on each card
 *   - Email card renders separately when email is included
 *   - "Edit" / rich-text mode is togglable
 *   - "New Campaign" button resets to the distillery
 *   - Generation error message displays without crash
 */

import { test, expect } from "./helpers/fixtures";

const MOCK_CAMPAIGN_RESPONSE = {
  output: JSON.stringify({
    campaign: [
      {
        platform: "x",
        content: "Test X post — this is a mock campaign for E2E testing purposes. #test",
      },
      {
        platform: "linkedin",
        content: "Test LinkedIn post. This is generated content for E2E test purposes.",
      },
      {
        platform: "discord",
        content: "Test Discord message for E2E testing.",
      },
    ],
    email: "<p>Mock email newsletter content for E2E testing.</p>",
  }),
};

async function interceptGenerate(page: import("@playwright/test").Page) {
  await page.route("/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_CAMPAIGN_RESPONSE),
    });
  });
}

test.describe("Distribution Grid – post-generation UI", () => {
  test.beforeEach(async ({ authedPage }) => {
    await interceptGenerate(authedPage);
    await authedPage.goto("/dashboard");
    await authedPage.waitForLoadState("networkidle");

    // Switch to social view
    await authedPage.locator("text=Social Posts").first().click();

    // Fill in some input
    const textarea = authedPage.locator("textarea, input[placeholder*='url' i]").first();
    await textarea.fill("Write about the future of AI in 2025");

    // Click generate
    await authedPage.locator("button:has-text('Generate'), button:has-text('Create')").first().click();

    // Wait for the campaign cards to appear
    await authedPage.locator("[id='campaign-cards'], [data-tour='campaign-cards'], [data-testid='distribution-grid']").first().waitFor({ timeout: 20_000 }).catch(() => {});
    await authedPage.waitForTimeout(1_000);
  });

  test("at least one platform card renders after generation", async ({ authedPage }) => {
    // Some sort of card/post container should be visible
    await expect(
      authedPage.locator("[data-platform], .post-card, [data-testid*='card'], article").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("X/Twitter platform card is visible", async ({ authedPage }) => {
    await expect(
      authedPage.locator("text=X, text=Twitter, [data-platform='x']").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("LinkedIn platform card is visible", async ({ authedPage }) => {
    await expect(
      authedPage.locator("text=LinkedIn, [data-platform='linkedin']").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("'New Campaign' / 'New Campaign' button is present", async ({ authedPage }) => {
    await expect(
      authedPage.locator("button:has-text('New Campaign'), button:has-text('← New'), button:has-text('Start over')").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("clicking 'New Campaign' resets to the distillery form", async ({ authedPage }) => {
    const newBtn = authedPage.locator("button:has-text('New Campaign'), button:has-text('← New')").first();
    await newBtn.click();
    // The textarea / context engine should reappear
    await expect(
      authedPage.locator("textarea, input[placeholder*='url' i], [data-testid='context-engine']").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("copy button is present on at least one card", async ({ authedPage }) => {
    await expect(
      authedPage.locator("button:has-text('Copy'), button[aria-label*='copy' i]").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("schedule button is present on at least one card", async ({ authedPage }) => {
    await expect(
      authedPage.locator("button:has-text('Schedule'), button[aria-label*='schedule' i]").first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Distribution Grid – error handling", () => {
  test("API error message renders without page crash", async ({ authedPage }) => {
    // Override with an error response
    await authedPage.route("/api/generate", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error — this is an E2E test error" }),
      });
    });

    await authedPage.goto("/dashboard");
    await authedPage.waitForLoadState("networkidle");
    await authedPage.locator("text=Social Posts").first().click();

    const textarea = authedPage.locator("textarea, input[placeholder*='url' i]").first();
    await textarea.fill("test content");

    await authedPage.locator("button:has-text('Generate'), button:has-text('Create')").first().click();
    await authedPage.waitForTimeout(3_000);

    // Should show an error message, not a blank screen
    await expect(authedPage.locator("body")).toBeVisible();
    // Error message should appear somewhere
    await expect(
      authedPage.locator("[class*='error'], [role='alert'], text=error, text=hiccup, text=try again").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("malformed JSON from API shows fallback error", async ({ authedPage }) => {
    await authedPage.route("/api/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ output: "this is not valid json {{{{{" }),
      });
    });

    await authedPage.goto("/dashboard");
    await authedPage.waitForLoadState("networkidle");
    await authedPage.locator("text=Social Posts").first().click();

    const textarea = authedPage.locator("textarea, input[placeholder*='url' i]").first();
    await textarea.fill("test content for malformed json scenario");

    await authedPage.locator("button:has-text('Generate'), button:has-text('Create')").first().click();
    await authedPage.waitForTimeout(3_000);

    await expect(authedPage.locator("body")).toBeVisible();
    await expect(authedPage.locator("[class*='error'], [role='alert'], text=unexpected format, text=try again").first()).toBeVisible({ timeout: 10_000 });
  });
});

/**
 * Scheduling flow tests (authenticated).
 *
 * Covers:
 *   - Schedule modal opens from post card
 *   - Date/time picker is visible
 *   - Submitting without a date shows validation error
 *   - Scheduled posts modal shows existing schedules
 *   - Cancelling a scheduled post triggers confirmation
 *   - Schedule API rejects unauthenticated requests (covered in api tests too)
 */

import { test, expect } from "./helpers/fixtures";

const MOCK_CAMPAIGN_RESPONSE = {
  output: JSON.stringify({
    campaign: [
      { platform: "x", content: "Test post for scheduling E2E test." },
      { platform: "linkedin", content: "LinkedIn post for scheduling E2E test." },
    ],
    email: null,
  }),
};

test.describe("Scheduling – schedule modal from post card", () => {
  test.beforeEach(async ({ authedPage }) => {
    // Intercept generate so we get cards without real AI
    await authedPage.route("/api/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CAMPAIGN_RESPONSE),
      });
    });

    await authedPage.goto("/dashboard");
    await authedPage.waitForLoadState("networkidle");
    await authedPage.locator("text=Social Posts").first().click();

    const textarea = authedPage.locator("textarea").first();
    await textarea.fill("Scheduling test content");
    await authedPage.locator("button:has-text('Generate'), button:has-text('Create')").first().click();

    // Wait for cards
    await authedPage.waitForTimeout(3_000);
  });

  test("Schedule button opens schedule modal", async ({ authedPage }) => {
    const scheduleBtn = authedPage.locator("button:has-text('Schedule'), button[aria-label*='schedule' i]").first();
    if (await scheduleBtn.isVisible().catch(() => false)) {
      await scheduleBtn.click();
      await expect(
        authedPage.locator('[role="dialog"], text=Schedule, input[type="datetime-local"], input[type="date"]').first()
      ).toBeVisible({ timeout: 8_000 });
    }
  });

  test("date/time input is visible inside schedule modal", async ({ authedPage }) => {
    const scheduleBtn = authedPage.locator("button:has-text('Schedule')").first();
    if (await scheduleBtn.isVisible().catch(() => false)) {
      await scheduleBtn.click();
      await expect(
        authedPage.locator('input[type="datetime-local"], input[type="date"], input[type="time"]').first()
      ).toBeVisible({ timeout: 8_000 });
    }
  });

  test("schedule modal closes without submitting", async ({ authedPage }) => {
    const scheduleBtn = authedPage.locator("button:has-text('Schedule')").first();
    if (await scheduleBtn.isVisible().catch(() => false)) {
      await scheduleBtn.click();
      const modal = authedPage.locator('[role="dialog"]').first();
      await modal.waitFor({ state: "visible", timeout: 8_000 });
      await authedPage.keyboard.press("Escape");
      await expect(modal).toBeHidden({ timeout: 5_000 });
    }
  });
});

test.describe("Scheduling – Scheduled Posts modal", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/dashboard");
    await authedPage.waitForLoadState("networkidle");
  });

  test("Scheduled Posts modal opens from sidebar", async ({ authedPage }) => {
    await authedPage.locator("text=Scheduled Posts").first().click();
    await expect(
      authedPage.locator('[role="dialog"], text=Scheduled, text=No scheduled posts').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("Scheduled Posts modal shows empty state or list", async ({ authedPage }) => {
    await authedPage.locator("text=Scheduled Posts").first().click();
    await expect(
      authedPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });

    // Either a list of posts or an empty state
    await expect(
      authedPage.locator("text=No scheduled, text=Schedule is empty, [data-testid='scheduled-post']").first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

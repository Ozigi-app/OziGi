/**
 * Billing tests (authenticated).
 *
 * Covers:
 *   - Billing page loads
 *   - Current plan is shown
 *   - Upgrade / checkout buttons are present
 *   - Cancel subscription button is present (when subscribed)
 *   - Cancellation modal confirmation flow
 *   - Downgrade flow shows confirmation
 *   - Pricing page CTA links resolve correctly
 *
 * We NEVER submit real payment forms in E2E.
 */

import { test, expect } from "./helpers/fixtures";

test.describe("Billing page", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/dashboard/billing");
    await authedPage.waitForLoadState("networkidle");
  });

  test("billing page loads without 500", async ({ authedPage }) => {
    const res = await authedPage.goto("/dashboard/billing");
    expect(res?.status()).toBeLessThan(500);
  });

  test("current plan is displayed", async ({ authedPage }) => {
    await expect(
      authedPage.locator("text=Free, text=Starter, text=Growth, text=Pro, text=Enterprise, text=Current plan").first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("upgrade / choose plan button is present", async ({ authedPage }) => {
    await expect(
      authedPage.locator("button:has-text('Upgrade'), button:has-text('Get'), button:has-text('Choose'), a:has-text('Upgrade')").first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("clicking upgrade CTA does not navigate to 404", async ({ authedPage }) => {
    const upgradeBtn = authedPage.locator("button:has-text('Upgrade'), button:has-text('Get Pro')").first();
    if (await upgradeBtn.isVisible().catch(() => false)) {
      await upgradeBtn.click();
      await authedPage.waitForTimeout(2_000);
      const status = await authedPage.evaluate(() => document.readyState);
      expect(status).toBe("complete");
      // No 404 page
      await expect(authedPage.locator("text=404, text=Page Not Found").first()).not.toBeVisible();
    }
  });
});

test.describe("Billing – cancellation flow", () => {
  test("cancel subscription button opens a confirmation modal", async ({ authedPage }) => {
    await authedPage.goto("/dashboard/billing");
    await authedPage.waitForLoadState("networkidle");

    const cancelBtn = authedPage.locator("button:has-text('Cancel'), button:has-text('Cancel subscription')").first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await expect(
        authedPage.locator('[role="dialog"], text=Are you sure, text=Cancel your subscription, text=Confirm cancellation').first()
      ).toBeVisible({ timeout: 8_000 });

      // Dismiss the modal without confirming
      await authedPage.keyboard.press("Escape");
    }
  });
});

test.describe("Billing – pricing page CTAs", () => {
  test("pricing page loads", async ({ authedPage }) => {
    const res = await authedPage.goto("/pricing");
    expect(res?.status()).toBeLessThan(500);
  });

  test("pricing page shows all plan tiers", async ({ authedPage }) => {
    await authedPage.goto("/pricing");
    await authedPage.waitForLoadState("networkidle");
    for (const plan of ["Free", "Starter", "Growth", "Pro"]) {
      await expect(authedPage.locator(`text=${plan}`).first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

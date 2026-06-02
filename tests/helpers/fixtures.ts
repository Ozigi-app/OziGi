/**
 * Shared Playwright fixtures.
 *
 * Extends the base `test` object with:
 *   - `authedPage`   – a Page already signed in as the free-tier test user
 *   - `proPage`      – a Page signed in as the Pro-tier test user
 *
 * Usage:
 *   import { test, expect } from '../helpers/fixtures';
 *   test('something gated', async ({ proPage }) => { ... });
 */

import { test as base, type Page, type BrowserContext } from "@playwright/test";
import { signInViaApi, TEST_EMAIL, TEST_PASSWORD, PRO_EMAIL, PRO_PASSWORD } from "./auth";

type Fixtures = {
  authedPage: Page;
  proPage: Page;
};

export const test = base.extend<Fixtures>({
  authedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    try {
      await signInViaApi(context, TEST_EMAIL, TEST_PASSWORD);
    } catch {
      // env creds not set — tests that need auth will fail with a clear message
    }
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  proPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    try {
      await signInViaApi(context, PRO_EMAIL, PRO_PASSWORD);
    } catch {
      // env creds not set
    }
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";

import { expect, test } from "@playwright/test";

import { clearSession, gotoLogin, loginWithMagicLink } from "./utils/auth";

test.describe("Authentication gates", () => {
  test("redirects anonymous visitors to sign-in", async ({ page }) => {
    await clearSession(page);
    const response = await page.goto("/dashboard/ideas");
    expect(response?.status()).toBeGreaterThanOrEqual(200);
    await expect(page).toHaveURL(/login/);
    await expect(page.getByLabel(/email address/i)).toBeVisible();
  });

  test("expires sessions and forces re-authentication", async ({ page }) => {
    await loginWithMagicLink(page);
    await page.context().clearCookies();
    await page.goto("/dashboard/ideas");
    await expect(page).toHaveURL(/login/);
    await gotoLogin(page);
  });
});

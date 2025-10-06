import { expect, test } from "@playwright/test";

test.describe("Authentication gates", () => {
  test("redirects anonymous visitors to sign-in", async ({ page }) => {
    const response = await page.goto("/dashboard/ideas");
    expect(response?.status()).toBeGreaterThanOrEqual(200);
    await expect(page).toHaveURL(/login/);
    await expect(page.getByText(/pre-provisioned identities/i)).toBeVisible();
  });

  test("expires sessions and forces re-authentication", async ({ page }) => {
    await page.goto("/dashboard/ideas");
    // Simulate session expiry by clearing cookies mid-session once session logic exists.
    await page.context().clearCookies();
    await page.reload();

    await expect(page).toHaveURL(/login/);
  });
});

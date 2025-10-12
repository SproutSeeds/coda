import { expect, test } from "@playwright/test";

import { fetchMagicLinkUrl, generateTestEmail, requestMagicLink } from "./utils/auth";

test.describe("Email magic link authentication", () => {
  test("sends magic link and signs in", async ({ page }) => {
    const email = generateTestEmail();
    await requestMagicLink(page, email);

    const url = await fetchMagicLinkUrl(page, email, { consume: true, maxAttempts: 10, pollIntervalMs: 250 });
    await page.goto(url);
    await expect(page).toHaveURL(/dashboard\/ideas/);
    await expect(page.getByRole("heading", { name: /ideas/i })).toBeVisible();
  });

  test("handles invalid or expired token gracefully", async ({ page }) => {
    const email = generateTestEmail("playwright-invalid");
    await requestMagicLink(page, email);

    const url = await fetchMagicLinkUrl(page, email, { consume: true, maxAttempts: 10, pollIntervalMs: 250 });
    await page.goto(`${url}broken`);
    await expect(page).toHaveURL(/api\/auth\/error\?error=Verification/);
  });

  test("enforces rate limiting on magic link requests", async ({ page }) => {
    const email = generateTestEmail("playwright-rate");
    await requestMagicLink(page, email);
    await fetchMagicLinkUrl(page, email, { consume: true, maxAttempts: 8, pollIntervalMs: 200 });
    await expect(page.getByTestId("magic-link-status")).toHaveText(/check your inbox/i, { timeout: 5_000 });

    await page.getByRole("button", { name: /email me a sign-in link/i }).click();
    await page.getByTestId("magic-link-error").waitFor({ state: "visible" });
    await expect(page.getByTestId("magic-link-error")).toHaveText(/too many requests/i);
    await expect(async () => {
      await fetchMagicLinkUrl(page, email, { consume: true, maxAttempts: 6, pollIntervalMs: 150 });
    }).rejects.toThrow(/Magic link not found/);
  });
});

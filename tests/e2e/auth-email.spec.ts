import { expect, test } from "@playwright/test";

import { fetchMagicLinkUrl, requestMagicLink } from "./utils/auth";

test.describe("Email magic link authentication", () => {
  test("sends magic link and signs in", async ({ page }) => {
    const email = `playwright+${Date.now()}@example.com`;
    await requestMagicLink(page, email);

    const url = await fetchMagicLinkUrl(page, email, { consume: true });
    await page.goto(url);
    await expect(page).toHaveURL(/dashboard\/ideas/);
    await expect(page.getByRole("heading", { name: /ideas/i })).toBeVisible();
  });

  test("handles invalid or expired token gracefully", async ({ page }) => {
    const email = `playwright-invalid+${Date.now()}@example.com`;
    await requestMagicLink(page, email);

    const url = await fetchMagicLinkUrl(page, email, { consume: true });
    await page.goto(`${url}broken`);
    await expect(page).toHaveURL(/api\/auth\/error\?error=Verification/);
  });

  test("enforces rate limiting on magic link requests", async ({ page }) => {
    const email = `playwright-rate+${Date.now()}@example.com`;
    await requestMagicLink(page, email);
    await fetchMagicLinkUrl(page, email, { consume: true });

    await page.getByRole("button", { name: /email me a sign-in link/i }).click();
    await page.getByTestId("magic-link-error").waitFor({ state: "visible" });
    await expect(page.getByTestId("magic-link-error")).toHaveText(/too many requests/i);
    await expect(async () => {
      await fetchMagicLinkUrl(page, email, { consume: true });
    }).rejects.toThrow(/Magic link not found/);
  });
});

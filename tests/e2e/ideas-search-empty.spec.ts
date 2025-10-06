import { expect, test } from "@playwright/test";

import { loginWithOwnerToken } from "./utils/auth";

test.describe("Coda search", () => {
  test("shows empty state and latency guideline", async ({ page }) => {
    await loginWithOwnerToken(page);
    await page.getByTestId("ideas-search-input").waitFor();

    await page.getByTestId("ideas-search-input").fill("nonexistent keyword");
    await expect(page.getByText(/no ideas match your search/i)).toBeVisible();
  });
});

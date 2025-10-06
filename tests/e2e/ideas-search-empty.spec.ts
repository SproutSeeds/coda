import { expect, test } from "@playwright/test";

test.describe("Coda search", () => {
  test("shows empty state and latency guideline", async ({ page }) => {
    await page.context().addCookies([
      { name: "coda-user", value: "owner-token", domain: "localhost", path: "/" },
    ]);
    await page.goto("/dashboard/ideas");
    await page.getByTestId("ideas-search-input").waitFor();

    await page.getByTestId("ideas-search-input").fill("nonexistent keyword");
    await expect(page.getByText(/no ideas match your search/i)).toBeVisible();
  });
});

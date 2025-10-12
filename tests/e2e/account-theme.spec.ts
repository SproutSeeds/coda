import { expect, test } from "@playwright/test";

import { loginWithMagicLink } from "./utils/auth";

test.describe("Account theme preferences", () => {
  test("guides first-time users, persists choice, and allows toggling", async ({ page }) => {
    await loginWithMagicLink(page);
    await page.goto("/dashboard/account?themeTestReset=1");

    const prompt = page.getByTestId("theme-onboarding-banner");
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("Switch to light mode");

    await page.getByRole("button", { name: /switch to light mode/i }).click();
    await expect(prompt).toBeHidden();

    await page.waitForTimeout(200); // allow theme transition
    const classList = await page.evaluate(() => document.documentElement.className);
    expect(classList).toContain("light");

    await page.reload();
    await expect(page.getByTestId("theme-onboarding-banner")).toBeHidden();
    const persistedClassList = await page.evaluate(() => document.documentElement.className);
    expect(persistedClassList).toContain("light");

    await page.getByTestId("theme-toggle-button").click();
    const toggledClassList = await page.evaluate(() => document.documentElement.className);
    expect(toggledClassList).toContain("dark");
  });
});


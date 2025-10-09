import { expect, test } from "@playwright/test";

import { loginWithMagicLink } from "./utils/auth";

async function createIdea(page: import("@playwright/test").Page, title: string, notes: string) {
  await page.getByTestId("idea-launcher-open").click();
  await page.getByTestId("idea-title-input").fill(title);
  await page.getByTestId("idea-notes-input").fill(notes);
  await page.getByRole("button", { name: /^save idea$/i }).click();
  await page.waitForSelector(`text=${title}`, { timeout: 10_000 });
}

test.describe("Idea reordering", () => {
  test("allows keyboard reordering with persistence", async ({ page }) => {
    await loginWithMagicLink(page);
    await page.getByTestId("idea-launcher-open").waitFor();

    const timestamp = Date.now();
    const titles = [
      `Idea A ${timestamp}`,
      `Idea B ${timestamp}`,
      `Idea C ${timestamp}`,
    ];

    for (const title of titles) {
      await createIdea(page, title, "notes");
    }

    const [first, second, third] = titles;

    const firstHandle = page
      .getByTestId("idea-card")
      .filter({ hasText: first })
      .getByRole("button", { name: /reorder idea/i });

    await firstHandle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Space");

    await expect(page.getByTestId("idea-card").first()).toContainText(first);

    await page.reload();
    await expect(page.getByTestId("idea-card").first()).toContainText(first);

    for (const title of titles) {
      const card = page.getByTestId("idea-card").filter({ hasText: title });
      await card.getByRole("button", { name: /delete/i }).click();
      await page.getByTestId("idea-delete-input").fill(title);
      await page.getByTestId("idea-delete-confirm").click();
      await expect(card).toHaveCount(0);
    }
  });
});

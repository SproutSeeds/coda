import { expect, test, type Page } from "@playwright/test";

import { loginWithMagicLink } from "./utils/auth";

async function createIdea(page: Page, title: string, notes: string) {
  await page.getByTestId("idea-launcher-open").click();
  await page.getByTestId("idea-title-input").waitFor();
  await page.getByTestId("idea-title-input").fill(title);
  await page.getByTestId("idea-notes-input").fill(notes);
  await page.getByRole("button", { name: /^save idea$/i }).click();
  const closeComposer = page.getByTestId("idea-composer-minimize");
  if (await closeComposer.count()) {
    await closeComposer.click();
  }
  await page.waitForLoadState("networkidle");
  const newCard = page
    .getByTestId("idea-card")
    .filter({ hasText: title })
    .first();
  await expect(newCard).toBeVisible({ timeout: 10_000 });
}

test.describe("Idea reordering", () => {
  test("allows reordering with persistence", async ({ page }) => {
    await loginWithMagicLink(page);
    await page.getByTestId("idea-launcher-open").waitFor();

    const timestamp = Date.now();
    const titles = [
      `Idea A ${timestamp}`,
      `Idea B ${timestamp}`,
      `Idea C ${timestamp}`,
    ];

    for (const [index, title] of titles.entries()) {
      await createIdea(page, title, "notes");
      if (index < titles.length - 1) {
        await page.waitForTimeout(6_000);
      }
    }

    const initialOrder = [...titles].reverse();
    await expect(page.getByTestId("idea-card").first()).toContainText(initialOrder[0]);

    const cardMeta = await page.getByTestId("idea-card").evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.getAttribute("data-idea-id") ?? "",
        title: (element.querySelector("h3")?.textContent ?? "").trim(),
      })),
    );

    const idByTitle = new Map(cardMeta.map(({ title, id }) => [title, id]));
    const desiredOrderTitles = [initialOrder[1], initialOrder[2], initialOrder[0]];
    const reorderedIds = desiredOrderTitles.map((title) => {
      const id = idByTitle.get(title);
      if (!id) {
        throw new Error(`Missing idea id for title ${title}`);
      }
      return id;
    });

    const response = await page.request.post("/api/testing/ideas/reorder", {
      data: { ids: reorderedIds },
    });
    if (!response.ok()) {
      throw new Error(`Failed to reorder ideas: ${response.status()} ${await response.text()}`);
    }

    await page.reload();
    await expect(page.getByTestId("idea-card").first()).toContainText(initialOrder[1], { timeout: 10_000 });
    await expect(page.getByTestId("idea-card").last()).toContainText(initialOrder[0], { timeout: 10_000 });

    for (const title of titles) {
      const card = page.getByTestId("idea-card").filter({ hasText: title });
      await card.getByRole("button", { name: /delete/i }).click();
      await page.getByTestId("idea-delete-input").fill(title);
      await page.getByTestId("idea-delete-confirm").click();
      await expect(card).toHaveCount(0);
    }
  });
});

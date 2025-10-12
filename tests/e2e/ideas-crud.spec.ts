import { expect, test } from "@playwright/test";

import { loginWithMagicLink } from "./utils/auth";

test.describe("Coda CRUD flow", () => {
  test("allows authenticated user to create, edit, search, delete, and undo", async ({ page }) => {
    await loginWithMagicLink(page);
    await page.getByTestId("idea-launcher-open").click();
    await page.getByTestId("idea-title-input").waitFor();

    await page.getByTestId("idea-title-input").fill("Build realtime undo");
    await page.getByTestId("idea-notes-input").fill("Undo window should be 10 seconds");
    await page.getByRole("button", { name: /^save idea$/i }).click();

    await page.waitForSelector("text=Build realtime undo", { timeout: 10_000 });

    await page
      .getByTestId("idea-card")
      .filter({ hasText: "Build realtime undo" })
      .first()
      .click();

    await page.getByTestId("idea-edit-toggle").click();
    await page.getByTestId("idea-edit-title-input").fill("Refined realtime undo");
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForSelector("text=Refined realtime undo", { timeout: 10_000 });

    await page.getByTestId("feature-launcher-open").click();
    await page.getByTestId("feature-title-input").fill("Timeline preview");
    await page.getByTestId("feature-notes-input").fill("Show recent undo actions in a timeline.");
    await page.getByTestId("feature-save-button").click();
    const timelineFeature = page
      .getByTestId("feature-card")
      .filter({ hasText: "Timeline preview" })
      .first();
    await timelineFeature.waitFor({ state: "visible", timeout: 10_000 });

    await timelineFeature.click();
    await page.getByTestId("feature-edit-notes-input").fill("Display undo events with timestamps and actors.");
    await timelineFeature.getByTestId("feature-save-button").click();
    await page.waitForSelector("text=Display undo events with timestamps and actors.", { timeout: 10_000 });

    await timelineFeature.getByTestId("feature-delete-button").click();
    await page.getByTestId("feature-delete-input").fill("Timeline preview");
    await page.getByTestId("feature-delete-confirm").click();
    await timelineFeature.waitFor({ state: "detached", timeout: 10_000 });

    await page.getByRole("button", { name: /back to ideas/i }).click();
    await page.waitForURL(/\/dashboard\/ideas$/);

    await page.getByTestId("ideas-search-input").fill("undo");
    await page.waitForSelector("text=Refined realtime undo", { timeout: 10_000 });

    const refinedCard = page
      .getByTestId("idea-card")
      .filter({ hasText: "Refined realtime undo" })
      .first();
    await refinedCard.getByRole("button", { name: /delete idea/i }).click();
    await expect(refinedCard.getByTestId("idea-delete-input")).toBeVisible({ timeout: 5_000 });
    await refinedCard.getByTestId("idea-delete-input").fill("Refined realtime undo");
    const deleteConfirm = page.getByTestId("idea-delete-confirm");
    await expect(deleteConfirm).toBeEnabled({ timeout: 5_000 });
    await deleteConfirm.click({ force: true });
    await page.waitForSelector("text=Idea deleted", { timeout: 5_000 });
    await page.locator('button:has-text("Undo")').last().click();
    await expect(refinedCard).toBeVisible();
  });
});

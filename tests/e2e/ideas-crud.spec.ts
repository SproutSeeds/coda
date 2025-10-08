import { expect, test } from "@playwright/test";

import { loginWithMagicLink } from "./utils/auth";

test.describe("Coda CRUD flow", () => {
  test("allows authenticated user to create, edit, search, delete, and undo", async ({ page }) => {
    await loginWithMagicLink(page);
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

    await page.getByRole("button", { name: /edit/i }).click();
    await page.getByTestId("idea-edit-title-input").fill("Refined realtime undo");
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForSelector("text=Refined realtime undo", { timeout: 10_000 });

    await page.getByTestId("feature-notes-input").fill("Show recent undo actions in a timeline.");
    await page.getByTestId("feature-add-button").click();
    await page.getByTestId("feature-name-input").fill("Timeline preview");
    await page.getByTestId("feature-save-button").click();
    await page.waitForSelector("text=Timeline preview", { timeout: 10_000 });

    await page.getByTestId("feature-edit-toggle").first().click();
    await page.getByTestId("feature-edit-notes-input").fill("Display undo events with timestamps and actors.");
    await page.getByTestId("feature-save-button").click();
    await page.waitForSelector("text=Display undo events with timestamps and actors.", { timeout: 10_000 });

    await page.getByTestId("feature-delete-button").first().click();
    await page.waitForSelector("text=Timeline preview", { timeout: 10_000, state: "detached" });

    await page.getByRole("button", { name: /back to ideas/i }).click();
    await page.waitForURL(/\/dashboard\/ideas$/);

    await page.getByTestId("ideas-search-input").fill("undo");
    await page.waitForSelector("text=Refined realtime undo", { timeout: 10_000 });

    await page.getByRole("button", { name: /delete idea/i }).first().click();
    await page.waitForSelector("text=Idea deleted", { timeout: 5_000 });
    await page.getByRole("button", { name: /undo/i }).click();
    const restoredCard = page
      .getByTestId("idea-card")
      .filter({ hasText: "Refined realtime undo" })
      .first();
    await expect(restoredCard).toBeVisible();
  });
});

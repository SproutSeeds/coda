import { expect, test } from "@playwright/test";

import { loginWithMagicLink } from "./utils/auth";
import { importFixturePath } from "./fixtures/import";

test.describe("Ideas JSON import", () => {
  test("walks through preview, conflict resolution, and commit", async ({ page }) => {
    await loginWithMagicLink(page);

    const importButton = page.getByTestId("ideas-import-button");
    await expect(importButton).toBeVisible();

    const fileInput = page.getByTestId("ideas-import-input");
    await fileInput.setInputFiles(importFixturePath("valid"));

    const dialog = page.getByTestId("import-dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });

    await expect(dialog.getByTestId("import-summary-new-ideas")).toHaveText(/1/i);
    await expect(dialog.getByTestId("import-summary-updated-ideas")).toHaveText(/1/i);

    const conflictCard = dialog.getByTestId("import-conflict-existing-idea");
    await expect(conflictCard).toBeVisible();
    await conflictCard.getByLabel(/update existing idea/i).check();

    const confirmButton = dialog.getByTestId("import-confirm");
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    const toast = page.getByTestId("import-toast-success");
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(toast).toContainText(/Imported 1 idea/i);

    await expect(page.getByText("New Idea From Import")).toBeVisible({ timeout: 10_000 });
  });

  test("surfaces validation errors for malformed JSON", async ({ page }) => {
    await loginWithMagicLink(page);

    const fileInput = page.getByTestId("ideas-import-input");
    await fileInput.setInputFiles(importFixturePath("invalid"));

    const errorToast = page.getByTestId("import-toast-error");
    await expect(errorToast).toBeVisible({ timeout: 10_000 });
    await expect(errorToast).toContainText(/invalid import file/i);
  });
});

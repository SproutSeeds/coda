import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { loginWithMagicLink } from "./utils/auth";

async function ensureOnIdeasDashboard(page: Page) {
  await page.waitForURL(/\/dashboard\/ideas/, { timeout: 10_000 });
  await expect(page.getByTestId("idea-launcher-open")).toBeVisible({ timeout: 10_000 });
}

async function openIdeaComposer(page: Page) {
  const launcher = page.getByTestId("idea-launcher-open");
  if (await launcher.isVisible()) {
    await launcher.click();
    return;
  }

  const minimizeButton = page.getByTestId("idea-composer-minimize");
  if (await minimizeButton.isVisible()) {
    await minimizeButton.click();
    await expect(page.getByTestId("idea-launcher-open")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("idea-launcher-open").click();
    return;
  }

  await page.getByTestId("idea-launcher-open").click();
}

async function createIdea(page: Page, title: string, notes: string) {
  await openIdeaComposer(page);

  await page.getByTestId("idea-title-input").fill(title);
  await page.getByTestId("idea-notes-input").fill(notes);
  await page.getByRole("button", { name: /save idea/i }).click();

  const ideaCard = page.getByTestId("idea-card").filter({ hasText: title }).first();
  await expect(ideaCard).toBeVisible({ timeout: 10_000 });

  await expect(page.getByTestId("idea-launcher-open")).toBeVisible({ timeout: 5_000 });
}

async function inviteCollaborator(page: Page, email: string) {
  const emailInput = page.getByPlaceholder("teammate@example.com");
  await emailInput.fill(email);

  const sendInviteButton = page.getByRole("button", { name: /send invite/i });
  await expect(sendInviteButton).toBeEnabled({ timeout: 7_000 });
  await sendInviteButton.click();

  await expect(page.getByText(email, { exact: false })).toBeVisible({ timeout: 10_000 });
}

test.describe("Usage limits", () => {
  test("warns and blocks when plan limits are reached", async ({ page }) => {
    await loginWithMagicLink(page);
    await ensureOnIdeasDashboard(page);

    const primaryIdeaTitle = "Limit Plan Idea 1";
    await createIdea(page, primaryIdeaTitle, "Foundational idea for limit tests.");

    const primaryIdeaCard = page.getByTestId("idea-card").filter({ hasText: primaryIdeaTitle }).first();
    await primaryIdeaCard.click();
    await page.waitForURL(/\/dashboard\/ideas\//, { timeout: 10_000 });
    const ideaDetailUrl = new URL(page.url());
    const ideaId = ideaDetailUrl.pathname.split("/").pop();
    expect(ideaId).toBeTruthy();

    await page.getByTestId("idea-share-button").click();
    await expect(page.getByTestId("idea-share-button")).toHaveAttribute("aria-expanded", "true");

    await inviteCollaborator(page, "teammate+one@example.com");
    await inviteCollaborator(page, "teammate+two@example.com");
    await inviteCollaborator(page, "teammate+three@example.com");

    const limitAlert = page.getByRole("alert").filter({ hasText: "Collaborator limit reached" }).first();
    await expect(limitAlert).toBeVisible({ timeout: 10_000 });

    const viewUpgradeButton = limitAlert.getByRole("button", { name: /view upgrade options/i });
    await viewUpgradeButton.click();

    const limitDialog = page.getByRole("dialog", { name: "Collaborator limit reached" });
    await expect(limitDialog).toBeVisible({ timeout: 10_000 });
    await expect(limitDialog.getByRole("button", { name: "View plans" })).toBeVisible();
    await expect(limitDialog.getByRole("button", { name: "Not now" })).toBeVisible();
    await limitDialog.getByRole("button", { name: "Not now" }).click();
    await expect(limitDialog).toBeHidden();

    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("idea-share-button")).toHaveAttribute("aria-expanded", "false");

    await page.getByRole("button", { name: /back to ideas/i }).click();
    await ensureOnIdeasDashboard(page);

    for (let index = 2; index <= 5; index += 1) {
      const title = `Limit Plan Idea ${index}`;
      await createIdea(page, title, `Idea ${index} created to exercise lifetime limit controls.`);
    }

    await page.goto("/dashboard/account");
    await expect(page.getByRole("heading", { name: "Usage & limits" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Ideas created", { exact: false })).toBeVisible();
    await expect(page.getByText("5 / 5", { exact: false })).toBeVisible();
    await expect(page.getByText("Approaching limit", { exact: false })).toBeVisible();

    await page.goto("/dashboard/ideas");
    await ensureOnIdeasDashboard(page);

    await openIdeaComposer(page);
    await page.getByTestId("idea-title-input").fill("Limit Plan Idea 6");
    await page.getByTestId("idea-notes-input").fill("Attempting to exceed the allowed idea quota.");
    await page.getByRole("button", { name: /save idea/i }).click();

    await expect(
      page.getByText("You’ve reached the maximum number of ideas allowed on your current plan.")
    ).toBeVisible({ timeout: 10_000 });

    const minimizeButton = page.getByTestId("idea-composer-minimize");
    if (await minimizeButton.isVisible()) {
      await minimizeButton.click();
    }
  });
});

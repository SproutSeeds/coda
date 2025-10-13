import { expect, test } from "@playwright/test";

import { generateTestEmail, loginWithMagicLink } from "./utils/auth";

test("submitter can append updates to their own suggestion thread", async ({ page }) => {
  const submitterEmail = generateTestEmail("suggestions");
  await loginWithMagicLink(page, submitterEmail);

  await page.goto("/dashboard/suggestions");
  await expect(page.getByRole("heading", { name: /suggestion box/i })).toBeVisible();

  await page.getByRole("button", { name: /share a suggestion/i }).click();

  const suggestionTitle = `Submitter thread test ${Date.now().toString(36)}`;
  const suggestionNotes = "Initial suggestion details for submitter thread coverage.";

  await page.getByPlaceholder(/give your suggestion a title/i).fill(suggestionTitle);
  await page.getByPlaceholder(/describe the experience/i).fill(suggestionNotes);
  await page.getByRole("button", { name: /submit suggestion/i }).click();

  const suggestionCard = page.getByTestId("suggestion-card").filter({ hasText: suggestionTitle });
  await expect(suggestionCard).toBeVisible();

  await suggestionCard.first().click();
  await expect(page).toHaveURL(/dashboard\/suggestions\//);
  await expect(page.getByRole("heading", { name: suggestionTitle })).toBeVisible();

  const followUpMessage = "Follow-up details shared by the original submitter.";
  const updateTextarea = page.getByPlaceholder(/add more details or ask a follow-up/i);
  await expect(updateTextarea).toBeVisible();
  await updateTextarea.fill(followUpMessage);
  await page.getByRole("button", { name: /add to thread/i }).click();

  await expect(page.getByText(followUpMessage).first()).toBeVisible();
  await expect(page.getByText(submitterEmail).first()).toBeVisible();
});

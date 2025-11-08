import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";

export function generateTestEmail(label = "playwright") {
  const unique = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  return `${label}+${unique}@example.com`;
}

export async function clearSession(page: Page) {
  await page.context().clearCookies();
}

export async function gotoLogin(page: Page) {
  await page.goto("/login?tab=sign-in");
  await expect(page).toHaveURL(/\/login/);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Escape");
  const tabNav = page.locator('nav[aria-label="Workspace sections"]');
  if ((await tabNav.count()) > 0) {
    await tabNav.first().waitFor({ state: "visible", timeout: 7000 }).catch(() => {});
    const signInTab = tabNav.getByRole("button", { name: /^Sign in$/i });
    if ((await signInTab.count()) > 0) {
      await signInTab.first().click();
    }
  }
  const form = page.getByTestId("magic-link-form");
  await form.waitFor({ state: "visible", timeout: 7000 });
}

export async function requestMagicLink(page: Page, email: string) {
  await clearSession(page);
  await gotoLogin(page);
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole("button", { name: /email me a sign-in link/i }).click();
  await expect(page.getByTestId("magic-link-status")).toBeVisible();
}

const MAX_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 300;

export async function fetchMagicLinkUrl(page: Page, email: string, options?: { consume?: boolean; maxAttempts?: number; pollIntervalMs?: number }) {
  const encoded = encodeURIComponent(email);
  const consumeParam = options?.consume ? "&consume=true" : "";
  const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS;
  const pollInterval = options?.pollIntervalMs ?? POLL_INTERVAL_MS;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await page.request.get(`/api/testing/magic-link?email=${encoded}${consumeParam}`);
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.url).toBeTruthy();
      return body.url as string;
    }
    await page.waitForTimeout(pollInterval);
  }

  const finalResponse = await page.request.get(`/api/testing/magic-link?email=${encoded}${consumeParam}`);
  if (finalResponse.status() === 200) {
    const body = await finalResponse.json();
    expect(body.url).toBeTruthy();
    return body.url as string;
  }

  const text = await finalResponse.text();
  throw new Error(`Magic link not found for ${email}: ${finalResponse.status()} ${text}`);
}

export async function loginWithMagicLink(page: Page, email = generateTestEmail("playwright-user")) {
  await requestMagicLink(page, email);
  const url = await fetchMagicLinkUrl(page, email, { consume: true });
  await page.goto(url);
  await expect(page).toHaveURL(/dashboard\/ideas/);
  return email;
}

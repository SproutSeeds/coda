import { expect, type Page } from "@playwright/test";

export async function clearSession(page: Page) {
  await page.context().clearCookies();
}

export async function gotoLogin(page: Page) {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);
}

export async function requestMagicLink(page: Page, email: string) {
  await clearSession(page);
  await gotoLogin(page);
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole("button", { name: /email me a sign-in link/i }).click();
  await expect(page.getByTestId("magic-link-status")).toBeVisible();
}

export async function fetchMagicLinkUrl(page: Page, email: string, options?: { consume?: boolean }) {
  const encoded = encodeURIComponent(email);
  const consumeParam = options?.consume ? "&consume=true" : "";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await page.request.get(`/api/testing/magic-link?email=${encoded}${consumeParam}`);
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.url).toBeTruthy();
      return body.url as string;
    }
    await page.waitForTimeout(300);
  }
  const finalResponse = await page.request.get(`/api/testing/magic-link?email=${encoded}${consumeParam}`);
  const text = await finalResponse.text();
  throw new Error(`Magic link not found for ${email}: ${finalResponse.status()} ${text}`);
}

export async function loginWithMagicLink(page: Page, email = `playwright-user+${Date.now()}@example.com`) {
  await requestMagicLink(page, email);
  const url = await fetchMagicLinkUrl(page, email, { consume: true });
  await page.goto(url);
  await expect(page).toHaveURL(/dashboard\/ideas/);
  return email;
}

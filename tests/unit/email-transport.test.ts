import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { clearTestInbox, getTestInbox, sendMagicLinkEmail } from "@/lib/auth/email";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.EMAIL_FROM = "noreply@example.com";
  process.env.EMAIL_SERVER = "stream";
  process.env.EMAIL_PORT = "587";
  clearTestInbox();
});

afterEach(() => {
  Object.assign(process.env, originalEnv);
});

describe("sendMagicLinkEmail", () => {
  test("queues message in stream transport inbox", async () => {
    await sendMagicLinkEmail({ email: "user@example.com", url: "https://app.local/auth" });

    const inbox = getTestInbox();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ email: "user@example.com", url: "https://app.local/auth" });
    expect(inbox[0].raw).toContain("user@example.com");
  });

  test("throws when EMAIL_FROM missing", async () => {
    delete process.env.EMAIL_FROM;

    await expect(
      sendMagicLinkEmail({ email: "user@example.com", url: "https://app.local/auth" }),
    ).rejects.toThrow(/EMAIL_FROM is not set/);
  });
});

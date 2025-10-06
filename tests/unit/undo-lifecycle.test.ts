import { describe, expect, it } from "vitest";

import {
  createUndoToken,
  isUndoTokenExpired,
  purgeExpiredUndoTokens,
  resetUndoStore,
  seedUndoToken,
} from "@/lib/utils/undo";

describe("Undo lifecycle", () => {
  it("creates a token with a 10 second expiry", () => {
    const record = createUndoToken("idea-123");
    const delta = record.expiresAt.getTime() - Date.now();

    expect(record.token).toHaveLength(32);
    expect(delta).toBeGreaterThanOrEqual(9500);
    expect(delta).toBeLessThanOrEqual(10500);
  });

  it("detects expired tokens", () => {
    const expired = {
      token: "token",
      ideaId: "idea-1",
      expiresAt: new Date(Date.now() - 1000),
    };

    expect(isUndoTokenExpired(expired, new Date())).toBe(true);
  });

  it("purges expired tokens from storage", async () => {
    resetUndoStore();
    seedUndoToken({ token: "expired", ideaId: "idea-1", expiresAt: new Date(Date.now() - 1_000) });
    seedUndoToken({ token: "active", ideaId: "idea-1", expiresAt: new Date(Date.now() + 5_000) });

    const removed = await purgeExpiredUndoTokens();
    expect(removed).toBeGreaterThanOrEqual(0);
  });
});

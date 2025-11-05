import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerWithPasswordAction } from "@/app/(public)/login/actions";

const { trackEventMock, consumeRateLimitMock, sendPasswordEmailMock, logUsageCostMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
  consumeRateLimitMock: vi.fn().mockResolvedValue({ success: true }),
  sendPasswordEmailMock: vi.fn().mockResolvedValue(undefined),
  logUsageCostMock: vi.fn().mockResolvedValue(undefined),
}));

const dbRef = vi.hoisted(() => {
  const buildStub = () => {
    const noop = vi.fn();
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn() })) })) }));
    const insert = vi.fn(() => ({ values: vi.fn() }));
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }));
    const del = vi.fn(() => ({ where: vi.fn() }));
    return {
      select,
      insert,
      update,
      delete: del,
      transaction: async (callback: (tx: any) => Promise<any>) =>
        callback({ select, insert, update, delete: del }),
    } as any;
  };
  return { current: buildStub(), buildStub };
});
let selectResult: Array<{ id: string; email: string; passwordHash: string | null; emailVerified: Date | null }> = [];
let insertValuesMock: ReturnType<typeof vi.fn>;
let deleteWhereMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/utils/analytics", () => ({
  trackEvent: trackEventMock,
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock("@/lib/auth/email", () => ({
  sendPasswordVerificationEmail: sendPasswordEmailMock,
}));

vi.mock("@/lib/usage/log-cost", () => ({
  logUsageCost: logUsageCostMock,
}));

vi.mock("@/lib/auth/adapter", () => ({
  createAuthAdapter: vi.fn(() => ({})),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => dbRef.current,
}));

const buildFormData = (email: string, password = "Password12345") => {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  form.set("confirmPassword", password);
  return form;
};

describe("registerWithPasswordAction", () => {
  beforeEach(() => {
    trackEventMock.mockClear();
    consumeRateLimitMock.mockClear();
    sendPasswordEmailMock.mockClear();
    logUsageCostMock.mockClear();
    consumeRateLimitMock.mockResolvedValue({ success: true });
    selectResult = [];

    const limitMock = vi.fn(() => Promise.resolve(selectResult));
    const whereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: whereMock }));
    const selectMock = vi.fn(() => ({ from: fromMock }));

    insertValuesMock = vi.fn(() => Promise.resolve());
    const insertMock = vi.fn(() => ({ values: insertValuesMock }));

    deleteWhereMock = vi.fn(() => Promise.resolve());
    const deleteMock = vi.fn(() => ({ where: deleteWhereMock }));

    const updateSetMock = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));
    const updateMock = vi.fn(() => ({ set: updateSetMock }));

    dbRef.current = {
      select: selectMock,
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
      transaction: async (callback: (tx: any) => Promise<any>) =>
        callback({
          select: selectMock,
          insert: insertMock,
          delete: deleteMock,
          update: updateMock,
        }),
    };
  });

  it("queues verification for a new account and records analytics", async () => {
    const result = await registerWithPasswordAction({ status: "idle" }, buildFormData("NewUser@Example.com"));

    expect(result).toEqual({ status: "pending", email: "newuser@example.com" });
    expect(consumeRateLimitMock).toHaveBeenCalledWith("auth:password-signup:newuser@example.com");
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    const inserted = insertValuesMock.mock.calls[0]?.[0];
    expect(inserted.email).toBe("newuser@example.com");
    expect(inserted.userId).toBeNull();
    expect(typeof inserted.passwordHash).toBe("string");
    expect(typeof inserted.tokenHash).toBe("string");
    expect(sendPasswordEmailMock).toHaveBeenCalledWith({
      email: "newuser@example.com",
      url: expect.stringContaining("/login/verify"),
    });
    expect(logUsageCostMock).toHaveBeenCalledWith({
      payerType: "user",
      payerId: "newuser@example.com",
      action: "auth.email",
      metadata: { type: "password_verification", existingUser: false },
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "auth_password_created",
      properties: {
        mode: "signup_pending",
      },
    });
  });

  it("queues verification when attaching a password to an existing user", async () => {
    selectResult = [
      {
        id: "user-1",
        email: "existing@example.com",
        passwordHash: null,
        emailVerified: null,
      },
    ];

    const result = await registerWithPasswordAction({ status: "idle" }, buildFormData("existing@example.com"));

    expect(result).toEqual({ status: "pending", email: "existing@example.com" });
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    const inserted = insertValuesMock.mock.calls[0]?.[0];
    expect(inserted.userId).toBe("user-1");
    expect(logUsageCostMock).toHaveBeenCalledWith({
      payer: {
        primary: { type: "user", id: "user-1" },
        fallback: null,
        strategy: "actor",
        metadata: { source: "password-verification" },
      },
      action: "auth.email",
      metadata: { type: "password_verification", existingUser: true },
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "auth_password_created",
      properties: {
        mode: "attach_pending",
        userId: "user-1",
      },
    });
  });

  it("returns an error when the account already has a password", async () => {
    selectResult = [
      {
        id: "user-2",
        email: "existing@example.com",
        passwordHash: "some-hash",
        emailVerified: new Date(),
      },
    ];

    const result = await registerWithPasswordAction({ status: "idle" }, buildFormData("existing@example.com"));

    expect(result).toEqual({ status: "error", message: "An account with this email already exists. Sign in instead." });
    expect(insertValuesMock).not.toHaveBeenCalled();
    expect(sendPasswordEmailMock).not.toHaveBeenCalled();
  });

  it("surfaces send failures gracefully", async () => {
    sendPasswordEmailMock.mockRejectedValueOnce(new Error("smtp error"));

    const result = await registerWithPasswordAction({ status: "idle" }, buildFormData("fails@example.com"));

    expect(result).toEqual({
      status: "error",
      message: "We couldn't send the verification email. Please try again in a moment.",
    });
    expect(deleteWhereMock).toHaveBeenCalled();
  });
});

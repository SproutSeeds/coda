import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));
vi.mock("@/lib/utils/analytics", () => ({
  trackEvent: vi.fn(async () => undefined),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
const cookieSetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSetMock })),
}));

import { updateThemePreferenceAction } from "@/app/dashboard/account/actions";
import { themePreferences } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { trackEvent } from "@/lib/utils/analytics";
import { revalidatePath } from "next/cache";

describe("updateThemePreferenceAction", () => {
beforeEach(() => {
  vi.resetAllMocks();
  cookieSetMock.mockReset();
});

  it("rejects when user is not authenticated", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("redirect"));

    await expect(updateThemePreferenceAction({ theme: "dark" })).rejects.toThrow("redirect");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects invalid themes", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" });

    await expect(updateThemePreferenceAction({ theme: "blue" as any })).rejects.toThrow();
    expect(getDb).not.toHaveBeenCalled();
  });

  it("persists preference and fires analytics", async () => {
    const valuesMock = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "pref-1", theme: "light" }]),
      }),
    });
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    vi.mocked(getDb).mockReturnValue({
      insert: insertMock,
      update: vi.fn(),
    } as any);
    vi.mocked(requireUser).mockResolvedValue({ id: "user-42", email: "demo@example.com" });

    const result = await updateThemePreferenceAction({ theme: "light", source: "explicit" });

    expect(result).toEqual({ success: true, theme: "light", effectiveSource: "explicit" });
    expect(insertMock).toHaveBeenCalledWith(themePreferences);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-42",
        theme: "light",
        source: "explicit",
      }),
    );
    expect(trackEvent).toHaveBeenCalledWith({
      name: "theme_preference.updated",
      properties: { userId: "user-42", theme: "light", source: "explicit" },
    });
    expect(cookieSetMock).toHaveBeenCalledWith("coda-theme", "light", expect.any(Object));
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/account");
  });
});

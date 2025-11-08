import { describe, expect, it, vi } from "vitest";

import { withMutationBudget } from "@/lib/utils/mutation-budget";

const { enforceLimitMock, actorPaysMock } = vi.hoisted(() => ({
  enforceLimitMock: vi.fn(),
  actorPaysMock: vi.fn(),
}));

vi.mock("@/lib/limits/guard", () => ({
  enforceLimit: enforceLimitMock,
}));

vi.mock("@/lib/limits/payer", () => ({
  actorPays: actorPaysMock,
}));

describe("withMutationBudget", () => {
  it("enforces the mutation limit before executing work", async () => {
    enforceLimitMock.mockResolvedValue(undefined);
    actorPaysMock.mockReturnValue({ primary: { type: "user", id: "user-1" }, strategy: "actor" });

    const work = vi.fn().mockResolvedValue("ok");
    const result = await withMutationBudget({ userId: "user-1", weight: 2 }, work);

    expect(enforceLimitMock).toHaveBeenCalledWith(expect.objectContaining({
      scope: { type: "user", id: "user-1" },
      metric: "mutations.per_user.daily",
      increment: 2,
    }));
    expect(work).toHaveBeenCalled();
    expect(result).toBe("ok");
  });
});

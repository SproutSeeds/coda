import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/utils/analytics", () => ({
  trackEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db/ideas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/ideas")>();
  return {
    ...actual,
    cycleIdeaStarState: vi.fn(),
  };
});

import { cycleIdeaStarAction } from "@/app/dashboard/ideas/actions";
import { cycleIdeaStarState } from "@/lib/db/ideas";
import { SuperStarLimitError } from "@/lib/errors/super-star-limit";
import { requireUser } from "@/lib/auth/session";
import { trackEvent } from "@/lib/utils/analytics";

describe("cycleIdeaStarAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as any);
  });

  it("emits idea_starred when transitioning to the starred state", async () => {
    vi.mocked(cycleIdeaStarState).mockResolvedValue({
      id: "idea-1",
      starred: true,
      superStarred: false,
    } as any);

    const result = await cycleIdeaStarAction("idea-1");

    expect(result).toMatchObject({ id: "idea-1", starred: true, superStarred: false });
    expect(trackEvent).toHaveBeenCalledWith({
      name: "idea_starred",
      properties: { ideaId: "idea-1" },
    });
  });

  it("emits idea_super_starred when transitioning to the super state", async () => {
    vi.mocked(cycleIdeaStarState).mockResolvedValue({
      id: "idea-2",
      starred: true,
      superStarred: true,
    } as any);

    await cycleIdeaStarAction("idea-2");

    expect(trackEvent).toHaveBeenCalledWith({
      name: "idea_super_starred",
      properties: { ideaId: "idea-2" },
    });
  });

  it("emits idea_unstarred when clearing all star state", async () => {
    vi.mocked(cycleIdeaStarState).mockResolvedValue({
      id: "idea-3",
      starred: false,
      superStarred: false,
    } as any);

    await cycleIdeaStarAction("idea-3");

    expect(trackEvent).toHaveBeenCalledWith({
      name: "idea_unstarred",
      properties: { ideaId: "idea-3" },
    });
  });

  it("surfaces a helpful error when the super star limit is hit", async () => {
    vi.mocked(cycleIdeaStarState).mockRejectedValue(new SuperStarLimitError());

    await expect(cycleIdeaStarAction("idea-4")).rejects.toThrow("super star up to three ideas");
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

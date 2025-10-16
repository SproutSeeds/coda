import { describe, expect, it } from "vitest";

import { ensureSuperStarPlacement } from "@/lib/utils/super-star-ordering";

describe("ensureSuperStarPlacement", () => {
  it("allows orders where super stars occupy the top positions", () => {
    expect(() =>
      ensureSuperStarPlacement(["a", "b", "c", "d"], ["b", "a"]),
    ).not.toThrow();
  });

  it("throws when a super starred idea falls outside the allowed range", () => {
    expect(() =>
      ensureSuperStarPlacement(["a", "b", "c", "d"], ["c", "b"]),
    ).toThrow(/first 2 positions/i);
  });

  it("returns silently when there are no super starred ideas", () => {
    expect(() => ensureSuperStarPlacement(["a", "b"], [])).not.toThrow();
  });

  it("treats duplicated super star ids safely", () => {
    expect(() =>
      ensureSuperStarPlacement(["a", "b", "c"], ["a", "a", "b"]),
    ).not.toThrow();
  });
});

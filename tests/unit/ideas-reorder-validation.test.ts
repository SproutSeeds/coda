import { describe, expect, it } from "vitest";

import { validateIdeaReorder } from "@/lib/validations/ideas";

describe("validateIdeaReorder", () => {
  it("accepts a list of unique ids", () => {
    const ids = ["a", "b", "c"];
    expect(validateIdeaReorder(ids)).toEqual(ids);
  });

  it("throws when ids are missing", () => {
    expect(() => validateIdeaReorder([])).toThrow(/Provide at least one idea id/i);
  });

  it("throws when ids repeat", () => {
    expect(() => validateIdeaReorder(["a", "a"])).toThrow(/must be unique/i);
  });
});

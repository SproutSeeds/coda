import { describe, expect, it } from "vitest";

import { themePreferenceInputSchema } from "@/lib/validations/theme-preference";

describe("themePreferenceInputSchema", () => {
  it("accepts valid theme and applies default source", () => {
    const parsed = themePreferenceInputSchema.parse({ theme: "dark" });
    expect(parsed).toEqual({ theme: "dark", source: "explicit" });
  });

  it("rejects invalid themes", () => {
    expect(() => themePreferenceInputSchema.parse({ theme: "lavender" })).toThrow();
  });

  it("allows explicit source overrides", () => {
    const parsed = themePreferenceInputSchema.parse({ theme: "light", source: "restored" });
    expect(parsed.source).toBe("restored");
  });
});


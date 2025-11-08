import { describe, expect, it } from "vitest";

import { formatUsageDayLabel, parseUsageDate } from "@/lib/utils/date";

describe("formatUsageDayLabel", () => {
  it("formats YYYY-MM-DD strings without timezone shifts", () => {
    expect(formatUsageDayLabel("2024-03-01", "en-US")).toBe("Mar 1");
  });

  it("returns the original value when parsing fails", () => {
    expect(formatUsageDayLabel("not-a-date")).toBe("not-a-date");
  });

  it("accepts Date objects", () => {
    const parsed = parseUsageDate("2024-05-15");
    expect(parsed).not.toBeNull();
    expect(formatUsageDayLabel(parsed as Date, "en-US")).toBe("May 15");
  });
});

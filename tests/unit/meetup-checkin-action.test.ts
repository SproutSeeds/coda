import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkInToMeetupAction } from "@/app/(public)/login/actions";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const recordMeetupCheckInMock = vi.hoisted(() => vi.fn());
const trackEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/lib/db/meetup", () => ({
  recordMeetupCheckIn: recordMeetupCheckInMock,
  getUserMeetupAttendance: vi.fn(),
  hasUserCheckedInForEvent: vi.fn(),
}));

vi.mock("@/lib/utils/analytics", () => ({
  trackEvent: trackEventMock,
}));

describe("checkInToMeetupAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Saturday, June 29 2024 12:00:00 PM Central (UTC-5) -> 17:00:00 UTC
    vi.setSystemTime(new Date("2024-06-29T17:00:00.000Z"));
    getCurrentUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    recordMeetupCheckInMock.mockResolvedValue({ alreadyCheckedIn: false });
    trackEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("requires authentication before recording a check-in", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const result = await checkInToMeetupAction("guest@example.com");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Sign in to Coda to check in to the meetings.");
    expect(recordMeetupCheckInMock).not.toHaveBeenCalled();
  });

  it("records a check-in for authenticated users", async () => {
    const result = await checkInToMeetupAction();

    expect(result.success).toBe(true);
    expect(recordMeetupCheckInMock).toHaveBeenCalledWith({
      userId: "user-1",
      email: "user@example.com",
      eventDate: "2024-06-29",
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "meetup_checkin",
      properties: { userId: "user-1", eventDate: "2024-06-29" },
    });
  });
});

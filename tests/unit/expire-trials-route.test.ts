import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/expire-trials/route";

const { expireTrialsBatchMock } = vi.hoisted(() => ({
  expireTrialsBatchMock: vi.fn(),
}));

vi.mock("@/lib/plans/trial-expiry", () => ({
  expireTrialsBatch: expireTrialsBatchMock,
}));

describe("/api/cron/expire-trials", () => {
  beforeEach(() => {
    expireTrialsBatchMock.mockReset();
    expireTrialsBatchMock.mockResolvedValue({ scanned: 0, expired: 0 });
    delete process.env.CRON_SECRET;
  });

  it("rejects unauthorized requests", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const request = new Request("http://example.com/api/cron/expire-trials", {
      headers: { Authorization: "Bearer nope" },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(expireTrialsBatchMock).not.toHaveBeenCalled();
  });

  it("expires trials when authorized", async () => {
    process.env.CRON_SECRET = "cron-secret";
    expireTrialsBatchMock.mockResolvedValue({ scanned: 5, expired: 3 });
    const request = new Request("http://example.com/api/cron/expire-trials", {
      headers: { Authorization: "Bearer cron-secret" },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ processed: 5, expired: 3 });
    expect(expireTrialsBatchMock).toHaveBeenCalled();
  });
});

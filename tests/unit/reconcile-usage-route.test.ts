import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/reconcile-usage/route";

const { reconcileUsageCountersMock } = vi.hoisted(() => ({
  reconcileUsageCountersMock: vi.fn(),
}));

vi.mock("@/lib/limits/reconcile", () => ({
  reconcileUsageCounters: reconcileUsageCountersMock,
}));

describe("/api/cron/reconcile-usage", () => {
  beforeEach(() => {
    reconcileUsageCountersMock.mockReset();
    reconcileUsageCountersMock.mockResolvedValue({ updated: 5 });
    delete process.env.CRON_SECRET;
  });

  it("rejects requests with invalid secret", async () => {
    process.env.CRON_SECRET = "super-secret";
    const request = new Request("http://example.com/api/cron/reconcile-usage", {
      headers: { Authorization: "Bearer nope" },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(reconcileUsageCountersMock).not.toHaveBeenCalled();
  });

  it("processes reconciliation when secret matches", async () => {
    process.env.CRON_SECRET = "super-secret";
    const request = new Request("http://example.com/api/cron/reconcile-usage", {
      headers: { Authorization: "Bearer super-secret" },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, processed: { updated: 5 } });
    expect(reconcileUsageCountersMock).toHaveBeenCalled();
  });
});

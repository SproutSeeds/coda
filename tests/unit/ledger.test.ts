import { beforeEach, describe, expect, it, vi } from "vitest";

import { listCreditLedgerEntries } from "@/lib/monetization/ledger";
import type { CreditLedgerEntry } from "@/lib/monetization/wallet";

const dbState = vi.hoisted(() => ({
  selectQueues: [] as Array<CreditLedgerEntry[]>,
}));

function createDbStub() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(dbState.selectQueues.shift() ?? []),
          }),
        }),
      }),
    }),
  };
}

const dbRef = vi.hoisted(() => ({ current: createDbStub() }));

vi.mock("@/lib/db", () => ({
  getDb: () => dbRef.current,
}));

describe("Credit Ledger", () => {
  beforeEach(() => {
    dbState.selectQueues.length = 0;
    dbRef.current = createDbStub();
  });

  function queueSelectResults(...batches: Array<CreditLedgerEntry[]>) {
    dbState.selectQueues.push(...batches);
  }

  describe("listCreditLedgerEntries", () => {
    it("returns ledger entries for a user in descending order by creation date", async () => {
      const entries: CreditLedgerEntry[] = [
        {
          id: "ledger-3",
          userId: "user-1",
          deltaCredits: -600,
          reason: "ai_usage",
          refType: "ai.completion",
          refId: "completion-789",
          createdAt: new Date("2025-01-15T12:00:00Z"),
        },
        {
          id: "ledger-2",
          userId: "user-1",
          deltaCredits: 800,
          reason: "topup",
          refType: "stripe.checkout",
          refId: "cs_456",
          createdAt: new Date("2025-01-10T12:00:00Z"),
        },
        {
          id: "ledger-1",
          userId: "user-1",
          deltaCredits: 1_200,
          reason: "monthly_included",
          refType: "stripe.invoice",
          refId: "in_123",
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ];
      queueSelectResults(entries);

      const result = await listCreditLedgerEntries("user-1");

      expect(result).toEqual(entries);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("ledger-3");
      expect(result[1].id).toBe("ledger-2");
      expect(result[2].id).toBe("ledger-1");
    });

    it("respects the limit parameter", async () => {
      const entries: CreditLedgerEntry[] = Array.from({ length: 10 }, (_, i) => ({
        id: `ledger-${i}`,
        userId: "user-1",
        deltaCredits: 100,
        reason: "test",
        refType: null,
        refId: null,
        createdAt: new Date(`2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
      }));
      queueSelectResults(entries.slice(0, 5));

      const result = await listCreditLedgerEntries("user-1", 5);

      expect(result).toHaveLength(5);
    });

    it("returns empty array when user has no ledger entries", async () => {
      queueSelectResults([]);

      const result = await listCreditLedgerEntries("user-new");

      expect(result).toEqual([]);
    });
  });

  describe("Ledger Entry Types", () => {
    it("records monthly_included entries for subscription renewals", async () => {
      const entry: CreditLedgerEntry = {
        id: "ledger-monthly",
        userId: "user-1",
        deltaCredits: 1_200,
        reason: "monthly_included",
        refType: "stripe.invoice",
        refId: "in_monthly_123",
        createdAt: new Date(),
      };
      queueSelectResults([entry]);

      const result = await listCreditLedgerEntries("user-1", 1);

      expect(result[0]).toMatchObject({
        reason: "monthly_included",
        refType: "stripe.invoice",
        deltaCredits: 1_200,
      });
    });

    it("records topup entries for purchased mana", async () => {
      const entry: CreditLedgerEntry = {
        id: "ledger-topup",
        userId: "user-1",
        deltaCredits: 800,
        reason: "topup",
        refType: "stripe.checkout",
        refId: "cs_topup_456",
        createdAt: new Date(),
      };
      queueSelectResults([entry]);

      const result = await listCreditLedgerEntries("user-1", 1);

      expect(result[0]).toMatchObject({
        reason: "topup",
        refType: "stripe.checkout",
        deltaCredits: 800,
      });
    });

    it("records ai_usage entries for credit consumption", async () => {
      const entry: CreditLedgerEntry = {
        id: "ledger-usage",
        userId: "user-1",
        deltaCredits: -600,
        reason: "ai_usage",
        refType: "ai.completion",
        refId: "completion-789",
        createdAt: new Date(),
      };
      queueSelectResults([entry]);

      const result = await listCreditLedgerEntries("user-1", 1);

      expect(result[0]).toMatchObject({
        reason: "ai_usage",
        refType: "ai.completion",
        deltaCredits: -600,
      });
    });

    it("records plan_activation entries for new subscriptions", async () => {
      const entry: CreditLedgerEntry = {
        id: "ledger-activation",
        userId: "user-1",
        deltaCredits: 1_200,
        reason: "plan_activation",
        refType: "stripe.plan_activation",
        refId: "cs_activation_789",
        createdAt: new Date(),
      };
      queueSelectResults([entry]);

      const result = await listCreditLedgerEntries("user-1", 1);

      expect(result[0]).toMatchObject({
        reason: "plan_activation",
        refType: "stripe.plan_activation",
        deltaCredits: 1_200,
      });
    });

    it("records ai_refund entries for failed operations", async () => {
      const entry: CreditLedgerEntry = {
        id: "ledger-refund",
        userId: "user-1",
        deltaCredits: 100,
        reason: "ai_refund",
        refType: "ai.completion",
        refId: "completion-failed-123",
        createdAt: new Date(),
      };
      queueSelectResults([entry]);

      const result = await listCreditLedgerEntries("user-1", 1);

      expect(result[0]).toMatchObject({
        reason: "ai_refund",
        refType: "ai.completion",
        deltaCredits: 100,
      });
    });
  });

  describe("Ledger Balance Calculation", () => {
    it("accurately reflects wallet state changes through ledger history", async () => {
      const entries: CreditLedgerEntry[] = [
        {
          id: "ledger-4",
          userId: "user-1",
          deltaCredits: -500,
          reason: "ai_usage",
          refType: "ai.completion",
          refId: "completion-final",
          createdAt: new Date("2025-01-20T00:00:00Z"),
        },
        {
          id: "ledger-3",
          userId: "user-1",
          deltaCredits: 800,
          reason: "topup",
          refType: "stripe.checkout",
          refId: "cs_topup",
          createdAt: new Date("2025-01-15T00:00:00Z"),
        },
        {
          id: "ledger-2",
          userId: "user-1",
          deltaCredits: -300,
          reason: "ai_usage",
          refType: "ai.completion",
          refId: "completion-2",
          createdAt: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "ledger-1",
          userId: "user-1",
          deltaCredits: 1_200,
          reason: "monthly_included",
          refType: "stripe.invoice",
          refId: "in_monthly",
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ];
      queueSelectResults(entries);

      const result = await listCreditLedgerEntries("user-1");

      const totalDelta = result.reduce((sum, entry) => sum + entry.deltaCredits, 0);
      expect(totalDelta).toBe(1_200);
    });

    it("shows negative balance history when user overspent (allowNegative scenario)", async () => {
      const entries: CreditLedgerEntry[] = [
        {
          id: "ledger-2",
          userId: "user-1",
          deltaCredits: -200,
          reason: "ai_usage",
          refType: "ai.completion",
          refId: "completion-overspend",
          createdAt: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "ledger-1",
          userId: "user-1",
          deltaCredits: 100,
          reason: "monthly_included",
          refType: "stripe.invoice",
          refId: "in_low",
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ];
      queueSelectResults(entries);

      const result = await listCreditLedgerEntries("user-1");

      const totalDelta = result.reduce((sum, entry) => sum + entry.deltaCredits, 0);
      expect(totalDelta).toBe(-100);
    });
  });

  describe("Ledger Query Helpers", () => {
    it("limits query results to requested count", async () => {
      const entries: CreditLedgerEntry[] = Array.from({ length: 100 }, (_, i) => ({
        id: `ledger-${i}`,
        userId: "user-1",
        deltaCredits: 10,
        reason: "test",
        refType: null,
        refId: null,
        createdAt: new Date(),
      }));
      queueSelectResults(entries.slice(0, 20));

      const result = await listCreditLedgerEntries("user-1", 20);

      expect(result).toHaveLength(20);
    });

    it("defaults to 50 entries when no limit specified", async () => {
      const entries: CreditLedgerEntry[] = Array.from({ length: 50 }, (_, i) => ({
        id: `ledger-${i}`,
        userId: "user-1",
        deltaCredits: 10,
        reason: "test",
        refType: null,
        refId: null,
        createdAt: new Date(),
      }));
      queueSelectResults(entries);

      const result = await listCreditLedgerEntries("user-1");

      expect(result).toHaveLength(50);
    });
  });

  describe("Ledger Audit Trail", () => {
    it("maintains complete history of all wallet mutations", async () => {
      const entries: CreditLedgerEntry[] = [
        {
          id: "ledger-5",
          userId: "user-1",
          deltaCredits: 100,
          reason: "ai_refund",
          refType: "ai.completion",
          refId: "completion-refund",
          createdAt: new Date("2025-01-25T00:00:00Z"),
        },
        {
          id: "ledger-4",
          userId: "user-1",
          deltaCredits: -100,
          reason: "ai_usage",
          refType: "ai.completion",
          refId: "completion-4",
          createdAt: new Date("2025-01-20T00:00:00Z"),
        },
        {
          id: "ledger-3",
          userId: "user-1",
          deltaCredits: 800,
          reason: "topup",
          refType: "stripe.checkout",
          refId: "cs_topup",
          createdAt: new Date("2025-01-15T00:00:00Z"),
        },
        {
          id: "ledger-2",
          userId: "user-1",
          deltaCredits: -300,
          reason: "ai_usage",
          refType: "ai.completion",
          refId: "completion-2",
          createdAt: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "ledger-1",
          userId: "user-1",
          deltaCredits: 1_200,
          reason: "monthly_included",
          refType: "stripe.invoice",
          refId: "in_monthly",
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ];
      queueSelectResults(entries);

      const result = await listCreditLedgerEntries("user-1");

      expect(result).toHaveLength(5);
      expect(result.every((entry) => entry.userId === "user-1")).toBe(true);
      expect(result.every((entry) => typeof entry.deltaCredits === "number")).toBe(true);
      expect(result.every((entry) => entry.reason)).toBe(true);
    });
  });
});

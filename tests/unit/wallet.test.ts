import { beforeEach, describe, expect, it, vi } from "vitest";

import { adjustCredits, getCreditBalance, recordCreditTopUp, recordCreditUsage, InsufficientCreditsError } from "@/lib/monetization/wallet";

const dbState = vi.hoisted(() => ({
  selectQueues: [] as Array<unknown[]>,
  insertCalls: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  updateCalls: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  executeCalls: [] as Array<{ query: string }>,
  executeResults: [] as Array<{ rows: unknown[] }>,
  transactionCallback: null as ((tx: unknown) => Promise<unknown>) | null,
}));

function createDbStub() {
  const createFromChain = () => ({
    leftJoin: () => ({
      where: () => Promise.resolve(dbState.selectQueues.shift() ?? []),
    }),
    where: () => ({
      limit: () => Promise.resolve(dbState.selectQueues.shift() ?? []),
    }),
  });

  return {
    select: (fields?: unknown) => ({
      from: createFromChain,
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        dbState.insertCalls.push({ table, values });
        return {
          onConflictDoNothing: () => Promise.resolve(),
          returning: () => Promise.resolve([{
            id: "ledger-1",
            userId: values.userId,
            deltaCredits: values.deltaCredits,
            reason: values.reason,
            refType: values.refType ?? null,
            refId: values.refId ?? null,
            createdAt: new Date(),
          }]),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          dbState.updateCalls.push({ table, values });
          return Promise.resolve();
        },
      }),
    }),
    execute: (query: unknown) => {
      const result = dbState.executeResults.shift();
      return Promise.resolve(result ?? { rows: [] });
    },
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      dbState.transactionCallback = callback;
      return callback(createDbStub());
    },
  };
}

const dbRef = vi.hoisted(() => ({ current: createDbStub() }));

vi.mock("@/lib/db", () => ({
  getDb: () => dbRef.current,
}));

describe("Wallet Operations", () => {
  beforeEach(() => {
    dbState.selectQueues.length = 0;
    dbState.insertCalls.length = 0;
    dbState.updateCalls.length = 0;
    dbState.executeCalls.length = 0;
    dbState.executeResults.length = 0;
    dbState.transactionCallback = null;
    dbRef.current = createDbStub();
  });

  function queueSelectResults(...batches: Array<unknown[]>) {
    dbState.selectQueues.push(...batches);
  }

  function queueExecuteResults(...results: Array<{ rows: unknown[] }>) {
    dbState.executeResults.push(...results);
  }

  describe("getCreditBalance", () => {
    it("returns wallet balance with separate base and boost buckets", async () => {
      // First query is from ensureBucketSetup (leftJoin path)
      // Second query is the actual balance query (where().limit() path)
      queueSelectResults([], [{ balance: 4_200, base: 1_200, boost: 3_000 }]);

      const result = await getCreditBalance("user-1");

      expect(result).toEqual({
        balance: 4_200,
        base: 1_200,
        boost: 3_000,
      });
    });

    it("returns zero balance when wallet does not exist", async () => {
      // First query is from ensureBucketSetup (leftJoin path)
      // Second query is the actual balance query (where().limit() path)
      queueSelectResults([], []);

      const result = await getCreditBalance("user-new");

      expect(result).toEqual({
        balance: 0,
        base: 0,
        boost: 0,
      });
    });
  });

  describe("adjustCredits - Credit Consumption Order", () => {
    it("consumes base_credits first when using auto bucket", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 4_200, base_credits: 1_200, boost_credits: 3_000 }] });

      const result = await adjustCredits({
        userId: "user-1",
        delta: -600,
        reason: "ai_usage",
        bucket: "auto",
      });

      expect(result.base).toBe(600);
      expect(result.boost).toBe(3_000);
      expect(result.balance).toBe(3_600);
      expect(result.bucketDelta.base).toBe(-600);
      expect(result.bucketDelta.boost).toBe(0);
    });

    it("falls back to boost_credits when base_credits is exhausted", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 3_500, base_credits: 500, boost_credits: 3_000 }] });

      const result = await adjustCredits({
        userId: "user-1",
        delta: -800,
        reason: "ai_usage",
        bucket: "auto",
      });

      expect(result.base).toBe(0);
      expect(result.boost).toBe(2_700);
      expect(result.balance).toBe(2_700);
      expect(result.bucketDelta.base).toBe(-500);
      expect(result.bucketDelta.boost).toBe(-300);
    });

    it("consumes only boost_credits when base is already at zero", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 3_000, base_credits: 0, boost_credits: 3_000 }] });

      const result = await adjustCredits({
        userId: "user-1",
        delta: -500,
        reason: "ai_usage",
        bucket: "auto",
      });

      expect(result.base).toBe(0);
      expect(result.boost).toBe(2_500);
      expect(result.balance).toBe(2_500);
      expect(result.bucketDelta.base).toBe(0);
      expect(result.bucketDelta.boost).toBe(-500);
    });

    it("throws InsufficientCreditsError when both buckets are exhausted", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 100, base_credits: 50, boost_credits: 50 }] });

      await expect(
        adjustCredits({
          userId: "user-1",
          delta: -200,
          reason: "ai_usage",
          bucket: "auto",
        }),
      ).rejects.toThrow(InsufficientCreditsError);
    });
  });

  describe("adjustCredits - Adding Credits", () => {
    it("adds to base_credits by default when delta is positive", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 1_000, base_credits: 500, boost_credits: 500 }] });

      const result = await adjustCredits({
        userId: "user-1",
        delta: 1_200,
        reason: "monthly_included",
        bucket: "base",
      });

      expect(result.base).toBe(1_700);
      expect(result.boost).toBe(500);
      expect(result.balance).toBe(2_200);
      expect(result.bucketDelta.base).toBe(1_200);
      expect(result.bucketDelta.boost).toBe(0);
    });

    it("adds to boost_credits when bucket is boost", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 1_200, base_credits: 1_200, boost_credits: 0 }] });

      const result = await adjustCredits({
        userId: "user-1",
        delta: 800,
        reason: "topup",
        bucket: "boost",
      });

      expect(result.base).toBe(1_200);
      expect(result.boost).toBe(800);
      expect(result.balance).toBe(2_000);
      expect(result.bucketDelta.base).toBe(0);
      expect(result.bucketDelta.boost).toBe(800);
    });
  });

  describe("recordCreditTopUp", () => {
    it("adds credits to boost bucket for purchased mana", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 1_200, base_credits: 1_200, boost_credits: 0 }] });

      const result = await recordCreditTopUp("user-1", 800, {
        refType: "stripe.checkout",
        refId: "cs_123",
      });

      expect(result.base).toBe(1_200);
      expect(result.boost).toBe(800);
      expect(result.balance).toBe(2_000);
    });

    it("throws error when top-up credits are negative", async () => {
      await expect(recordCreditTopUp("user-1", -100)).rejects.toThrow("Top-up credits must be positive");
    });

    it("throws error when top-up credits are zero", async () => {
      await expect(recordCreditTopUp("user-1", 0)).rejects.toThrow("Top-up credits must be positive");
    });
  });

  describe("recordCreditUsage", () => {
    it("deducts credits starting from base bucket", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 4_200, base_credits: 1_200, boost_credits: 3_000 }] });

      const result = await recordCreditUsage("user-1", 600, "ai_usage", {
        refType: "ai.completion",
        refId: "completion-123",
      });

      expect(result.base).toBe(600);
      expect(result.boost).toBe(3_000);
      expect(result.balance).toBe(3_600);
    });

    it("throws error when usage credits are negative", async () => {
      await expect(recordCreditUsage("user-1", -100, "ai_usage")).rejects.toThrow("Usage credits must be positive");
    });

    it("throws error when usage credits are zero", async () => {
      await expect(recordCreditUsage("user-1", 0, "ai_usage")).rejects.toThrow("Usage credits must be positive");
    });
  });

  describe("Monthly Credit Reset Behavior", () => {
    it("resets base_credits to plan amount without affecting boost_credits", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 3_500, base_credits: 500, boost_credits: 3_000 }] });

      const result = await adjustCredits({
        userId: "user-1",
        delta: 700,
        reason: "monthly_included",
        refType: "stripe.invoice",
        refId: "in_123",
        bucket: "base",
        allowNegative: true,
      });

      expect(result.base).toBe(1_200);
      expect(result.boost).toBe(3_000);
      expect(result.balance).toBe(4_200);
      expect(result.bucketDelta.base).toBe(700);
      expect(result.bucketDelta.boost).toBe(0);
    });

    it("reduces base_credits on downgrade without affecting boost_credits", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 4_200, base_credits: 1_200, boost_credits: 3_000 }] });

      const result = await adjustCredits({
        userId: "user-1",
        delta: -1_200,
        reason: "monthly_included",
        refType: "stripe.invoice",
        refId: "in_downgrade",
        bucket: "base",
        allowNegative: true,
      });

      expect(result.base).toBe(0);
      expect(result.boost).toBe(3_000);
      expect(result.balance).toBe(3_000);
      expect(result.bucketDelta.base).toBe(-1_200);
      expect(result.bucketDelta.boost).toBe(0);
    });
  });

  describe("Wallet Transactions", () => {
    it("creates a ledger entry for every credit adjustment", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 1_000, base_credits: 500, boost_credits: 500 }] });

      await adjustCredits({
        userId: "user-1",
        delta: 100,
        reason: "test_credit",
        refType: "test",
        refId: "test-123",
        bucket: "base",
      });

      const ledgerInsert = dbState.insertCalls.find((call) => call.values.reason === "test_credit");
      expect(ledgerInsert).toBeDefined();
      expect(ledgerInsert?.values).toMatchObject({
        userId: "user-1",
        deltaCredits: 100,
        reason: "test_credit",
        refType: "test",
        refId: "test-123",
      });
    });

    it("executes wallet and ledger updates atomically in a transaction", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 1_000, base_credits: 500, boost_credits: 500 }] });

      await adjustCredits({
        userId: "user-1",
        delta: -100,
        reason: "ai_usage",
        bucket: "auto",
      });

      expect(dbState.transactionCallback).not.toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("throws error when delta is zero", async () => {
      await expect(
        adjustCredits({
          userId: "user-1",
          delta: 0,
          reason: "invalid",
          bucket: "auto",
        }),
      ).rejects.toThrow("Credit delta must be a non-zero integer");
    });

    it("throws error when delta is not a finite number", async () => {
      await expect(
        adjustCredits({
          userId: "user-1",
          delta: Number.POSITIVE_INFINITY,
          reason: "invalid",
          bucket: "auto",
        }),
      ).rejects.toThrow("Credit delta must be a non-zero integer");
    });

    it("allows negative balance when allowNegative is true", async () => {
      queueExecuteResults({ rows: [{ balance_credits: 100, base_credits: 50, boost_credits: 50 }] });

      const result = await adjustCredits({
        userId: "user-1",
        delta: -200,
        reason: "ai_usage",
        bucket: "auto",
        allowNegative: true,
      });

      expect(result.balance).toBe(-100);
    });
  });
});

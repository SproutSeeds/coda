import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleStripeEvent } from "@/lib/stripe/webhook-handler";
import { PLAN_IDS } from "@/lib/plans/constants";
import { users } from "@/lib/db/schema";

const {
  getStripeSubscriptionMock,
  assignUserPlanMock,
  trackEventMock,
  ensureCreditWalletRowMock,
  adjustCreditsMock,
  hasLedgerEntryMock,
} = vi.hoisted(() => ({
  getStripeSubscriptionMock: vi.fn(),
  assignUserPlanMock: vi.fn(),
  trackEventMock: vi.fn(),
  ensureCreditWalletRowMock: vi.fn(),
  adjustCreditsMock: vi.fn(),
  hasLedgerEntryMock: vi.fn(),
}));

const dbState = vi.hoisted(() => ({
  selectQueues: [] as Array<unknown[]>,
  updateCalls: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
}));

function createDbStub() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(dbState.selectQueues.shift() ?? []),
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          dbState.updateCalls.push({ table, values });
          return Promise.resolve();
        },
      }),
    }),
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(createDbStub()),
  };
}

const dbRef = vi.hoisted(() => ({ current: createDbStub() }));

vi.mock("@/lib/stripe/subscriptions", () => ({
  getStripeSubscription: getStripeSubscriptionMock,
}));

vi.mock("@/lib/db/limits", () => ({
  assignUserPlan: assignUserPlanMock,
}));

vi.mock("@/lib/utils/analytics", () => ({
  trackEvent: trackEventMock,
}));

vi.mock("@/lib/monetization/wallet", () => ({
  ensureCreditWalletRow: ensureCreditWalletRowMock,
  adjustCredits: adjustCreditsMock,
  hasLedgerEntry: hasLedgerEntryMock,
}));

vi.mock("@/lib/stripe/config", () => ({
  stripeEnv: {
    prices: {
      get basic() {
        return "price_basic";
      },
      get pro() {
        return "price_pro";
      },
    },
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => dbRef.current,
}));

describe("handleStripeEvent invoice.paid", () => {
  beforeEach(() => {
    dbState.selectQueues.length = 0;
    dbState.updateCalls.length = 0;
    dbRef.current = createDbStub();
    getStripeSubscriptionMock.mockReset();
    assignUserPlanMock.mockReset();
    trackEventMock.mockReset();
    ensureCreditWalletRowMock.mockReset();
    adjustCreditsMock.mockReset();
    hasLedgerEntryMock.mockReset();
    hasLedgerEntryMock.mockResolvedValue(false);
    ensureCreditWalletRowMock.mockResolvedValue(undefined);
    adjustCreditsMock.mockResolvedValue({
      base: 0,
      balance: 0,
      boost: 0,
      bucketDelta: { base: 0, boost: 0 },
      ledgerEntry: {
        id: "ledger-1",
        userId: "user-1",
        deltaCredits: 0,
        reason: "monthly_included",
        refType: "stripe.invoice",
        refId: "in_123",
        createdAt: new Date(),
      },
    });
  });

  function queueSelectResults(...batches: Array<unknown[]>) {
    dbState.selectQueues.push(...batches);
  }

  function buildInvoice(priceId: string) {
    return {
      id: "in_123",
      subscription: "sub_123",
      lines: {
        data: [
          {
            period: { start: 1_700_000_000, end: 1_700_086_400 },
            price: { id: priceId },
          },
        ],
      },
    };
  }

  function buildEvent(invoice: Record<string, unknown>) {
    return {
      id: "evt_1",
      type: "invoice.paid",
      created: 0,
      data: { object: invoice },
    } as const;
  }

  it("syncs plan from subscription and refreshes Pro credits", async () => {
    queueSelectResults([{ id: "user-1", planId: PLAN_IDS.BASIC }], [{ base: 0 }]);
    getStripeSubscriptionMock.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ price: { id: "price_pro" } }] },
      pause_collection: null,
    });
    adjustCreditsMock.mockResolvedValueOnce({
      base: 1_200,
      balance: 1_200,
      boost: 0,
      bucketDelta: { base: 1_200, boost: 0 },
      ledgerEntry: {
        id: "ledger-1",
        userId: "user-1",
        deltaCredits: 1_200,
        reason: "monthly_included",
        refType: "stripe.invoice",
        refId: "in_123",
        createdAt: new Date(),
      },
    });

    await handleStripeEvent(buildEvent(buildInvoice("price_pro")));

    expect(getStripeSubscriptionMock).toHaveBeenCalledWith("sub_123");
    expect(dbState.updateCalls.find((call) => call.table === users)?.values).toMatchObject({
      planId: PLAN_IDS.PRO,
      currentPeriodStart: new Date(1_700_000_000 * 1000),
      currentPeriodEnd: new Date(1_700_086_400 * 1000),
    });
    expect(assignUserPlanMock).toHaveBeenCalledWith({
      userId: "user-1",
      planId: PLAN_IDS.PRO,
      startsAt: new Date(1_700_000_000 * 1000),
      db: expect.any(Object),
    });
    expect(adjustCreditsMock).toHaveBeenCalledWith({
      userId: "user-1",
      delta: 1_200,
      reason: "monthly_included",
      refType: "stripe.invoice",
      refId: "in_123",
      allowNegative: true,
      bucket: "base",
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "billing_plan_synced",
      properties: expect.objectContaining({
        userId: "user-1",
        previousPlanId: PLAN_IDS.BASIC,
        nextPlanId: PLAN_IDS.PRO,
        source: "invoice.paid",
      }),
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "billing_invoice_paid",
      properties: expect.objectContaining({
        userId: "user-1",
        planId: PLAN_IDS.PRO,
        subscriptionPaused: false,
        planChanged: true,
      }),
    });
  });

  it("downgrades to Basic when the subscription is paused", async () => {
    queueSelectResults([{ id: "user-1", planId: PLAN_IDS.PRO }], [{ base: 300 }]);
    getStripeSubscriptionMock.mockResolvedValue({
      id: "sub_456",
      items: { data: [{ price: { id: "price_pro" } }] },
      pause_collection: { behavior: "keep_as_draft" },
    });

    await handleStripeEvent(buildEvent(buildInvoice("price_pro")));

    expect(dbState.updateCalls.find((call) => call.table === users)?.values).toMatchObject({
      planId: PLAN_IDS.BASIC,
    });
    expect(assignUserPlanMock).toHaveBeenCalledWith({
      userId: "user-1",
      planId: PLAN_IDS.BASIC,
      startsAt: expect.any(Date),
      db: expect.any(Object),
    });
    expect(adjustCreditsMock).toHaveBeenCalledWith({
      userId: "user-1",
      delta: -300,
      reason: "monthly_included",
      refType: "stripe.invoice",
      refId: "in_123",
      allowNegative: true,
      bucket: "base",
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "billing_invoice_paid",
      properties: expect.objectContaining({
        planId: PLAN_IDS.BASIC,
        subscriptionPaused: true,
      }),
    });
  });

  it("resets base_credits on monthly renewal without touching boost_credits", async () => {
    queueSelectResults([{ id: "user-1", planId: PLAN_IDS.PRO }], [{ base: 500 }]);
    getStripeSubscriptionMock.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ price: { id: "price_pro" } }] },
      pause_collection: null,
    });
    adjustCreditsMock.mockResolvedValueOnce({
      base: 1_200,
      balance: 4_200,
      boost: 3_000,
      bucketDelta: { base: 700, boost: 0 },
      ledgerEntry: {
        id: "ledger-2",
        userId: "user-1",
        deltaCredits: 700,
        reason: "monthly_included",
        refType: "stripe.invoice",
        refId: "in_123",
        createdAt: new Date(),
      },
    });

    await handleStripeEvent(buildEvent(buildInvoice("price_pro")));

    expect(adjustCreditsMock).toHaveBeenCalledWith({
      userId: "user-1",
      delta: 700,
      reason: "monthly_included",
      refType: "stripe.invoice",
      refId: "in_123",
      allowNegative: true,
      bucket: "base",
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "credits_monthly_refresh",
      properties: expect.objectContaining({
        userId: "user-1",
        includedCredits: 1_200,
        delta: 700,
        baseAfter: 1_200,
        balanceAfter: 4_200,
      }),
    });
  });

  it("is idempotent when replaying the same invoice.paid event", async () => {
    queueSelectResults([{ id: "user-1", planId: PLAN_IDS.PRO }], [{ base: 500 }]);
    hasLedgerEntryMock.mockResolvedValue(true);
    getStripeSubscriptionMock.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ price: { id: "price_pro" } }] },
      pause_collection: null,
    });

    await handleStripeEvent(buildEvent(buildInvoice("price_pro")));

    expect(hasLedgerEntryMock).toHaveBeenCalledWith("stripe.invoice", "in_123");
    expect(adjustCreditsMock).not.toHaveBeenCalled();
  });

  it("handles plan change mid-cycle (Basic to Pro upgrade)", async () => {
    queueSelectResults([{ id: "user-1", planId: PLAN_IDS.BASIC }], [{ base: 0 }]);
    getStripeSubscriptionMock.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ price: { id: "price_pro" } }] },
      pause_collection: null,
    });
    adjustCreditsMock.mockResolvedValueOnce({
      base: 1_200,
      balance: 1_200,
      boost: 0,
      bucketDelta: { base: 1_200, boost: 0 },
      ledgerEntry: {
        id: "ledger-3",
        userId: "user-1",
        deltaCredits: 1_200,
        reason: "monthly_included",
        refType: "stripe.invoice",
        refId: "in_123",
        createdAt: new Date(),
      },
    });

    await handleStripeEvent(buildEvent(buildInvoice("price_pro")));

    expect(dbState.updateCalls.find((call) => call.table === users)?.values).toMatchObject({
      planId: PLAN_IDS.PRO,
    });
    expect(assignUserPlanMock).toHaveBeenCalledWith({
      userId: "user-1",
      planId: PLAN_IDS.PRO,
      startsAt: expect.any(Date),
      db: expect.any(Object),
    });
    expect(adjustCreditsMock).toHaveBeenCalledWith({
      userId: "user-1",
      delta: 1_200,
      reason: "monthly_included",
      refType: "stripe.invoice",
      refId: "in_123",
      allowNegative: true,
      bucket: "base",
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "billing_plan_synced",
      properties: expect.objectContaining({
        userId: "user-1",
        previousPlanId: PLAN_IDS.BASIC,
        nextPlanId: PLAN_IDS.PRO,
      }),
    });
  });

  it("handles plan change mid-cycle (Pro to Basic downgrade)", async () => {
    queueSelectResults([{ id: "user-1", planId: PLAN_IDS.PRO }], [{ base: 800 }]);
    getStripeSubscriptionMock.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ price: { id: "price_basic" } }] },
      pause_collection: null,
    });
    adjustCreditsMock.mockResolvedValueOnce({
      base: 0,
      balance: 0,
      boost: 0,
      bucketDelta: { base: -800, boost: 0 },
      ledgerEntry: {
        id: "ledger-4",
        userId: "user-1",
        deltaCredits: -800,
        reason: "monthly_included",
        refType: "stripe.invoice",
        refId: "in_123",
        createdAt: new Date(),
      },
    });

    await handleStripeEvent(buildEvent(buildInvoice("price_basic")));

    expect(dbState.updateCalls.find((call) => call.table === users)?.values).toMatchObject({
      planId: PLAN_IDS.BASIC,
    });
    expect(assignUserPlanMock).toHaveBeenCalledWith({
      userId: "user-1",
      planId: PLAN_IDS.BASIC,
      startsAt: expect.any(Date),
      db: expect.any(Object),
    });
    expect(adjustCreditsMock).toHaveBeenCalledWith({
      userId: "user-1",
      delta: -800,
      reason: "monthly_included",
      refType: "stripe.invoice",
      refId: "in_123",
      allowNegative: true,
      bucket: "base",
    });
  });

  it("skips credit reset when delta is zero", async () => {
    queueSelectResults([{ id: "user-1", planId: PLAN_IDS.PRO }], [{ base: 1_200 }]);
    getStripeSubscriptionMock.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ price: { id: "price_pro" } }] },
      pause_collection: null,
    });

    await handleStripeEvent(buildEvent(buildInvoice("price_pro")));

    expect(adjustCreditsMock).not.toHaveBeenCalled();
  });

  it("returns early when invoice has no subscription", async () => {
    const invoice = { id: "in_no_sub", subscription: null };
    await handleStripeEvent(buildEvent(invoice));
    expect(dbState.selectQueues.length).toBe(0);
  });

  it("returns early when no user found with subscription", async () => {
    queueSelectResults([]);
    await handleStripeEvent(buildEvent(buildInvoice("price_pro")));
    expect(getStripeSubscriptionMock).not.toHaveBeenCalled();
  });
});

describe("handleStripeEvent customer.subscription.deleted", () => {
  beforeEach(() => {
    dbState.selectQueues.length = 0;
    dbState.updateCalls.length = 0;
    dbRef.current = createDbStub();
    assignUserPlanMock.mockReset();
    trackEventMock.mockReset();
    adjustCreditsMock.mockReset();
    hasLedgerEntryMock.mockReset();
    hasLedgerEntryMock.mockResolvedValue(false);
    adjustCreditsMock.mockResolvedValue({
      base: 0,
      balance: 0,
      boost: 3_000,
      bucketDelta: { base: -1_200, boost: 0 },
      ledgerEntry: {
        id: "ledger-5",
        userId: "user-1",
        deltaCredits: -1_200,
        reason: "monthly_included",
        refType: "stripe.invoice",
        refId: "downgrade-reset",
        createdAt: new Date(),
      },
    });
  });

  function queueSelectResults(...batches: Array<unknown[]>) {
    dbState.selectQueues.push(...batches);
  }

  function buildSubscriptionDeletedEvent(subscriptionId: string) {
    return {
      id: "evt_sub_deleted",
      type: "customer.subscription.deleted",
      created: 0,
      data: {
        object: {
          id: subscriptionId,
          customer: "cus_123",
        },
      },
    } as const;
  }

  it("downgrades user to Basic plan and preserves boost_credits", async () => {
    queueSelectResults([{ id: "user-1", planId: PLAN_IDS.PRO }]);

    await handleStripeEvent(buildSubscriptionDeletedEvent("sub_123"));

    expect(dbState.updateCalls.find((call) => call.table === users)?.values).toMatchObject({
      planId: PLAN_IDS.BASIC,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });
    expect(assignUserPlanMock).toHaveBeenCalledWith({
      userId: "user-1",
      planId: PLAN_IDS.BASIC,
      startsAt: expect.any(Date),
      db: expect.any(Object),
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "billing_subscription_cancelled",
      properties: {
        userId: "user-1",
        subscriptionId: "sub_123",
        previousPlanId: PLAN_IDS.PRO,
      },
    });
  });

  it("handles subscription deletion when user not found", async () => {
    queueSelectResults([]);

    await handleStripeEvent(buildSubscriptionDeletedEvent("sub_nonexistent"));

    expect(assignUserPlanMock).not.toHaveBeenCalled();
  });

  it("returns early when subscription ID is missing", async () => {
    const event = {
      id: "evt_invalid",
      type: "customer.subscription.deleted",
      created: 0,
      data: { object: { id: null } },
    } as const;

    await handleStripeEvent(event);

    expect(dbState.selectQueues.length).toBe(0);
  });
});

describe("handleStripeEvent checkout.session.completed", () => {
  beforeEach(() => {
    dbState.selectQueues.length = 0;
    dbState.updateCalls.length = 0;
    dbRef.current = createDbStub();
    assignUserPlanMock.mockReset();
    trackEventMock.mockReset();
    adjustCreditsMock.mockReset();
    hasLedgerEntryMock.mockReset();
    hasLedgerEntryMock.mockResolvedValue(false);
    adjustCreditsMock.mockResolvedValue({
      base: 1_200,
      balance: 1_200,
      boost: 0,
      bucketDelta: { base: 1_200, boost: 0 },
      ledgerEntry: {
        id: "ledger-checkout",
        userId: "user-1",
        deltaCredits: 1_200,
        reason: "plan_activation",
        refType: "stripe.plan_activation",
        refId: "cs_123",
        createdAt: new Date(),
      },
    });
  });

  function buildCheckoutEvent(session: Record<string, unknown>) {
    return {
      id: "evt_checkout",
      type: "checkout.session.completed",
      created: 0,
      data: { object: session },
    } as const;
  }

  it("grants immediate Pro credits on new subscription checkout", async () => {
    const session = {
      id: "cs_123",
      mode: "subscription",
      metadata: { user_id: "user-1", plan_id: PLAN_IDS.PRO },
      customer: "cus_123",
      subscription: "sub_new",
      status: "complete",
      payment_status: "paid",
    };

    await handleStripeEvent(buildCheckoutEvent(session));

    expect(dbState.updateCalls.find((call) => call.table === users)?.values).toMatchObject({
      planId: PLAN_IDS.PRO,
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_new",
      trialEndsAt: null,
    });
    expect(adjustCreditsMock).toHaveBeenCalledWith({
      userId: "user-1",
      delta: 1_200,
      reason: "plan_activation",
      refType: "stripe.plan_activation",
      refId: "cs_123",
      allowNegative: true,
      bucket: "base",
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "billing_checkout_completed",
      properties: {
        userId: "user-1",
        mode: "subscription",
        planId: PLAN_IDS.PRO,
        checkoutSessionId: "cs_123",
        subscriptionId: "sub_new",
      },
    });
  });

  it("does not grant credits for Basic plan checkout", async () => {
    const session = {
      id: "cs_basic",
      mode: "subscription",
      metadata: { user_id: "user-1", plan_id: PLAN_IDS.BASIC },
      customer: "cus_123",
      subscription: "sub_basic",
    };

    await handleStripeEvent(buildCheckoutEvent(session));

    expect(adjustCreditsMock).not.toHaveBeenCalled();
  });

  it("returns early when checkout session has no user_id metadata", async () => {
    const session = {
      id: "cs_no_user",
      mode: "subscription",
      metadata: {},
    };

    await handleStripeEvent(buildCheckoutEvent(session));

    expect(dbState.selectQueues.length).toBe(0);
  });
});

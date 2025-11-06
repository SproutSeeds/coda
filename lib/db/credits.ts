import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { creditBalances, creditLedgerEntries, creditLedgerEntryTypeEnum, creditPurchaseStatusEnum, creditPurchases } from "@/lib/db/schema/credits";
import { usagePayerEnum } from "@/lib/db/schema/usage";

type DbClient = ReturnType<typeof getDb>;
type TransactionCallback = Parameters<DbClient["transaction"]>[0];
type TransactionClient = TransactionCallback extends (tx: infer Tx, ...args: unknown[]) => unknown ? Tx : never;
export type DbOrTx = DbClient | TransactionClient;

export type CreditPayerType = (typeof usagePayerEnum.enumValues)[number];
export type CreditLedgerEntryType = (typeof creditLedgerEntryTypeEnum.enumValues)[number];
export type CreditPurchaseStatus = (typeof creditPurchaseStatusEnum.enumValues)[number];

export type CreditPayer = {
  type: CreditPayerType;
  id: string;
};

export type CreditBalanceRow = typeof creditBalances.$inferSelect;
export type CreditLedgerEntryRow = typeof creditLedgerEntries.$inferSelect;
export type CreditPurchaseRow = typeof creditPurchases.$inferSelect;

const CREDIT_DECIMALS = 6;
export const CREDIT_PRICE_USD_PER_UNIT = 0.05;

function formatAmount(value: number) {
  return value.toFixed(CREDIT_DECIMALS);
}

function parseAmount(value: unknown) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveDb(db?: DbOrTx): DbOrTx {
  return db ?? getDb();
}

async function ensureBalanceRow(payer: CreditPayer, db: DbOrTx) {
  await db
    .insert(creditBalances)
    .values({
      payerType: payer.type,
      payerId: payer.id,
    })
    .onConflictDoNothing({
      target: [creditBalances.payerType, creditBalances.payerId],
    });
}

export type CreditBalanceSummary = {
  payer: CreditPayer;
  available: number;
  onHold: number;
  autoTopUpEnabled: boolean;
  autoTopUpCredits: number;
  autoTopUpThreshold: number;
  autoTopUpPaymentMethodId: string | null;
  updatedAt: Date;
};

export async function getCreditBalance(payer: CreditPayer, options: { db?: DbOrTx } = {}): Promise<CreditBalanceSummary> {
  const db = resolveDb(options.db);
  await ensureBalanceRow(payer, db);
  const [row] = await db
    .select()
    .from(creditBalances)
    .where(and(eq(creditBalances.payerType, payer.type), eq(creditBalances.payerId, payer.id)))
    .limit(1);

  const available = parseAmount(row?.availableCredits);
  const onHold = parseAmount(row?.onHoldCredits);
  const autoTopUpCredits = parseAmount(row?.autoTopUpCredits);
  const autoTopUpThreshold = parseAmount(row?.autoTopUpThreshold);

  return {
    payer,
    available,
    onHold,
    autoTopUpEnabled: row?.autoTopUpEnabled ?? false,
    autoTopUpCredits,
    autoTopUpThreshold,
    autoTopUpPaymentMethodId: row?.autoTopUpPaymentMethodId ?? null,
    updatedAt: row?.updatedAt ?? new Date(),
  };
}

export type AdjustCreditBalanceOptions = {
  payer: CreditPayer;
  delta: number;
  entryType: CreditLedgerEntryType;
  referenceId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  allowNegative?: boolean;
  occurredAt?: Date;
  db?: DbOrTx;
};

export type AdjustCreditBalanceResult = {
  balance: CreditBalanceSummary;
  entry: CreditLedgerEntryRow;
};

export class CreditInsufficientBalanceError extends Error {
  constructor(public readonly balance: CreditBalanceSummary, message = "Insufficient credits") {
    super(message);
    this.name = "CreditInsufficientBalanceError";
  }
}

export async function adjustCreditBalance(options: AdjustCreditBalanceOptions): Promise<AdjustCreditBalanceResult> {
  const db = resolveDb(options.db);
  const delta = Number(options.delta);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("Credit delta must be a non-zero finite number.");
  }

  return db.transaction(async (tx) => {
    await ensureBalanceRow(options.payer, tx);

    const lock = await tx.execute(
      sql`
        SELECT available_credits, on_hold_credits, auto_top_up_enabled, auto_top_up_credits,
               auto_top_up_threshold, auto_top_up_payment_method_id, updated_at
        FROM credit_balances
        WHERE payer_type = ${options.payer.type} AND payer_id = ${options.payer.id}
        FOR UPDATE
      `,
    );

    const lockedRow = (Array.isArray(lock) ? lock[0] : lock[0]) as {
      available_credits?: unknown;
      on_hold_credits?: unknown;
      auto_top_up_enabled?: boolean;
      auto_top_up_credits?: unknown;
      auto_top_up_threshold?: unknown;
      auto_top_up_payment_method_id?: string | null;
      updated_at?: Date;
    } | undefined;

    const currentAvailable = parseAmount(lockedRow?.available_credits);
    const newAvailable = currentAvailable + delta;

    if (!options.allowNegative && newAvailable < -0.000001) {
      const balance = await getCreditBalance(options.payer, { db: tx });
      throw new CreditInsufficientBalanceError(balance);
    }

    await tx
      .update(creditBalances)
      .set({
        availableCredits: formatAmount(newAvailable),
        updatedAt: new Date(),
      })
      .where(and(eq(creditBalances.payerType, options.payer.type), eq(creditBalances.payerId, options.payer.id)));

    const [entry] = await tx
      .insert(creditLedgerEntries)
      .values({
        payerType: options.payer.type,
        payerId: options.payer.id,
        entryType: options.entryType,
        delta: formatAmount(delta),
        balanceAfter: formatAmount(newAvailable),
        referenceId: options.referenceId ?? null,
        source: options.source ?? null,
        metadata: options.metadata ?? {},
        createdBy: options.createdBy ?? null,
        occurredAt: options.occurredAt ?? new Date(),
      })
      .returning();

    const balance = await getCreditBalance(options.payer, { db: tx });

    return { balance, entry };
  });
}

export type CreditPurchaseCreateInput = {
  payer: CreditPayer;
  credits: number;
  amountUsd: number;
  provider: string;
  providerReference?: string | null;
  initiatedBy?: string | null;
  metadata?: Record<string, unknown> | null;
  db?: DbOrTx;
};

export async function createCreditPurchase(input: CreditPurchaseCreateInput): Promise<CreditPurchaseRow> {
  const db = resolveDb(input.db);
  const credits = Number(input.credits);
  const amountUsd = Number(input.amountUsd);

  if (!Number.isFinite(credits) || credits <= 0) {
    throw new Error("Credits purchased must be a positive number.");
  }
  if (!Number.isFinite(amountUsd) || amountUsd < 0) {
    throw new Error("Purchase amount must be a non-negative number.");
  }

  const [row] = await db
    .insert(creditPurchases)
    .values({
      payerType: input.payer.type,
      payerId: input.payer.id,
      provider: input.provider,
      providerReference: input.providerReference ?? null,
      credits: formatAmount(credits),
      amountUsd: amountUsd.toFixed(2),
      initiatedBy: input.initiatedBy ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();

  return row;
}

export type CreditPurchaseStatusUpdate = {
  purchaseId: string;
  status: CreditPurchaseStatus;
  referenceCredits?: number;
  failureReason?: string | null;
  providerReference?: string | null;
  db?: DbOrTx;
};

export async function updateCreditPurchaseStatus(update: CreditPurchaseStatusUpdate): Promise<CreditPurchaseRow | null> {
  const db = resolveDb(update.db);

  const updates: Partial<typeof creditPurchases.$inferInsert> = {
    status: update.status,
    updatedAt: new Date(),
  };

  if (update.providerReference !== undefined) {
    updates.providerReference = update.providerReference;
  }

  if (update.status === "completed") {
    updates.completedAt = new Date();
    if (typeof update.referenceCredits === "number" && Number.isFinite(update.referenceCredits) && update.referenceCredits > 0) {
      updates.credits = formatAmount(update.referenceCredits);
    }
  }

  if (update.status === "failed") {
    updates.failedAt = new Date();
    updates.failureReason = update.failureReason ?? null;
  }

  const [row] = await db
    .update(creditPurchases)
    .set(updates)
    .where(eq(creditPurchases.id, update.purchaseId))
    .returning();

  return row ?? null;
}

export function calculateUsdAmountForCredits(credits: number) {
  const value = Number(credits);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * CREDIT_PRICE_USD_PER_UNIT * 100) / 100;
}

export type CompleteCreditPurchaseResult = {
  purchase: CreditPurchaseRow;
  balance: CreditBalanceSummary;
};

export async function completeCreditPurchase(options: {
  purchaseId: string;
  providerReference?: string | null;
  referenceCredits?: number;
  metadata?: Record<string, unknown> | null;
  triggeredBy?: string | null;
  db?: DbOrTx;
  expectedPayer?: CreditPayer;
}): Promise<CompleteCreditPurchaseResult | null> {
  const db = resolveDb(options.db);

  return db.transaction(async (tx) => {
    const lock = await tx.execute(
      sql`
        SELECT *
        FROM credit_purchases
        WHERE id = ${options.purchaseId}
        FOR UPDATE
      `,
    );

    const purchase = (Array.isArray(lock) ? lock[0] : lock[0]) as CreditPurchaseRow | undefined;
    if (!purchase) {
      return null;
    }

    if (
      options.expectedPayer &&
      (purchase.payerType !== options.expectedPayer.type || purchase.payerId !== options.expectedPayer.id)
    ) {
      throw new Error("Credit purchase does not belong to the expected payer.");
    }

    if (purchase.status === "failed" || purchase.status === "canceled") {
      return {
        purchase,
        balance: await getCreditBalance(
          { type: purchase.payerType, id: purchase.payerId },
          { db: tx },
        ),
      };
    }

    let credits = options.referenceCredits ?? parseAmount(purchase.credits);
    if (!Number.isFinite(credits) || credits <= 0) {
      credits = 0;
    }

    if (purchase.status === "completed") {
      const balance = await getCreditBalance(
        { type: purchase.payerType, id: purchase.payerId },
        { db: tx },
      );
      return { purchase, balance };
    }

    if (credits <= 0) {
      throw new Error("Completed credit purchase must grant a positive number of credits.");
    }

    const now = new Date();
    const payloadMetadata = {
      ...(purchase.metadata ?? {}),
      ...(options.metadata ?? {}),
    };

    await ensureBalanceRow({ type: purchase.payerType, id: purchase.payerId }, tx);

    const { balance } = await adjustCreditBalance({
      payer: { type: purchase.payerType, id: purchase.payerId },
      delta: credits,
      entryType: "purchase",
      referenceId: purchase.id,
      source: purchase.provider,
      metadata: {
        ...payloadMetadata,
        purchaseId: purchase.id,
      },
      createdBy: options.triggeredBy ?? purchase.initiatedBy ?? null,
      allowNegative: true,
      occurredAt: now,
      db: tx,
    });

    const [updated] = await tx
      .update(creditPurchases)
      .set({
        status: "completed",
        credits: formatAmount(credits),
        providerReference: options.providerReference ?? purchase.providerReference ?? null,
        metadata: payloadMetadata,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(creditPurchases.id, purchase.id))
      .returning();

    return {
      purchase: updated ?? purchase,
      balance,
    };
  });
}

export async function updateAutoTopUpSettings(options: {
  payer: CreditPayer;
  enabled: boolean;
  credits?: number;
  threshold?: number;
  paymentMethodId?: string | null;
  db?: DbOrTx;
}) {
  const db = resolveDb(options.db);
  const current = await getCreditBalance(options.payer, { db });

  const nextCredits = options.credits ?? current.autoTopUpCredits;
  const nextThreshold = options.threshold ?? current.autoTopUpThreshold;
  const nextPaymentMethod = options.paymentMethodId ?? current.autoTopUpPaymentMethodId;

  await db
    .update(creditBalances)
    .set({
      autoTopUpEnabled: options.enabled,
      autoTopUpCredits: formatAmount(Math.max(0, nextCredits)),
      autoTopUpThreshold: formatAmount(Math.max(0, nextThreshold)),
      autoTopUpPaymentMethodId: options.enabled ? nextPaymentMethod ?? null : null,
      updatedAt: new Date(),
    })
    .where(and(eq(creditBalances.payerType, options.payer.type), eq(creditBalances.payerId, options.payer.id)));

  return getCreditBalance(options.payer, { db });
}

type AutoTopUpTriggerOptions = {
  payer: CreditPayer;
  balance: CreditBalanceSummary;
  requiredAmount: number;
  source?: string | null;
  initiatedBy?: string | null;
  db?: DbOrTx;
};

async function maybeTriggerAutoTopUp(options: AutoTopUpTriggerOptions) {
  const { balance } = options;
  if (!balance.autoTopUpEnabled) return null;
  if (!balance.autoTopUpPaymentMethodId) return null;

  const creditsToPurchase = Math.max(balance.autoTopUpCredits || 0, options.requiredAmount);
  if (!Number.isFinite(creditsToPurchase) || creditsToPurchase <= 0) {
    return null;
  }

  if (balance.available + creditsToPurchase < options.requiredAmount) {
    // Nothing to do yet; we'll still proceed but ensure re-run covers insufficient grants.
  }

  const amountUsd = calculateUsdAmountForCredits(creditsToPurchase);
  const db = resolveDb(options.db);

  const purchase = await createCreditPurchase({
    payer: options.payer,
    credits: creditsToPurchase,
    amountUsd,
    provider: "auto_top_up",
    providerReference: balance.autoTopUpPaymentMethodId,
    initiatedBy: options.initiatedBy ?? null,
    metadata: {
      trigger: "auto_top_up",
      source: options.source ?? null,
      threshold: balance.autoTopUpThreshold,
      availableBefore: balance.available,
    },
    db,
  });

  return completeCreditPurchase({
    purchaseId: purchase.id,
    providerReference: balance.autoTopUpPaymentMethodId,
    triggeredBy: options.initiatedBy ?? null,
    db,
    expectedPayer: options.payer,
  });
}

export type ChargeCreditsOptions = {
  payer: CreditPayer;
  amount: number;
  source?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  allowNegative?: boolean;
  triggerAutoTopUp?: boolean;
  db?: DbOrTx;
};

export async function chargeCredits(options: ChargeCreditsOptions): Promise<AdjustCreditBalanceResult> {
  const amount = Number(options.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Credit charge amount must be a positive number.");
  }

  async function debit(allowAutoTopUp: boolean): Promise<AdjustCreditBalanceResult> {
    try {
      return await adjustCreditBalance({
        payer: options.payer,
        delta: -amount,
        entryType: "usage",
        referenceId: options.referenceId ?? null,
        source: options.source ?? null,
        metadata: {
          ...(options.metadata ?? {}),
          chargeAmount: amount,
        },
        createdBy: options.createdBy ?? null,
        allowNegative: options.allowNegative ?? false,
        db: options.db,
      });
    } catch (error) {
      if (error instanceof CreditInsufficientBalanceError && allowAutoTopUp) {
        const auto = await maybeTriggerAutoTopUp({
          payer: options.payer,
          balance: error.balance,
          requiredAmount: amount,
          initiatedBy: options.createdBy ?? null,
          source: options.source ?? null,
          db: options.db,
        });

        if (!auto) {
          throw error;
        }

        return debit(false);
      }
      throw error;
    }
  }

  return debit(options.triggerAutoTopUp ?? true);
}

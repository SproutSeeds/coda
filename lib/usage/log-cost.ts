import { getDb } from "@/lib/db";
import { usageCosts } from "@/lib/db/schema/usage";
import { getCostModel, type UsageAction } from "@/lib/pricing/cost-model";
import type { LimitPayerResolution } from "@/lib/limits/types";

type PayerType = "user" | "workspace";

type BaseUsageOptions = {
  action: UsageAction;
  quantity?: number;
  unitCostOverride?: number;
  creditsDebited?: number;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
};

type SimplePayerOptions = BaseUsageOptions & {
  payerType: PayerType;
  payerId: string;
  payer?: never;
};

type ResolutionPayerOptions = BaseUsageOptions & {
  payer: LimitPayerResolution;
  payerType?: never;
  payerId?: never;
};

export type LogUsageCostOptions = SimplePayerOptions | ResolutionPayerOptions;

const DECIMAL_PRECISION = 6;

function formatNumber(value: number) {
  return value.toFixed(DECIMAL_PRECISION);
}

type ResolvedPayer = {
  type: PayerType;
  id: string;
  strategy: string;
  fallbackType: PayerType | null;
  fallbackId: string | null;
  metadata: Record<string, unknown> | null;
};

function resolvePayer(options: LogUsageCostOptions): ResolvedPayer {
  if ("payer" in options && options.payer) {
    return {
      type: options.payer.primary.type,
      id: options.payer.primary.id,
      strategy: options.payer.strategy,
      fallbackType: options.payer.fallback?.type ?? null,
      fallbackId: options.payer.fallback?.id ?? null,
      metadata: options.payer.metadata ?? null,
    };
  }

  return {
    type: options.payerType,
    id: options.payerId,
    strategy: "actor",
    fallbackType: null,
    fallbackId: null,
    metadata: null,
  };
}

export async function logUsageCost(options: LogUsageCostOptions) {
  const definition = getCostModel(options.action);
  if (!definition) return;

  const quantity = options.quantity ?? 1;
  if (quantity <= 0) return;

  const unitCost = options.unitCostOverride ?? definition.unitCost;
  const totalCost = unitCost * quantity;
  const payer = resolvePayer(options);

  let db;
  try {
    db = getDb();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("usage: unable to log cost (database unavailable)", { action: options.action, error });
    }
    return;
  }
  await db.insert(usageCosts).values({
    payerType: payer.type,
    payerId: payer.id,
    action: options.action,
    vendor: definition.vendor,
    unit: definition.unit,
    quantity: formatNumber(quantity),
    unitCost: formatNumber(unitCost),
    totalCost: formatNumber(totalCost),
    creditsDebited: formatNumber(options.creditsDebited ?? 0),
    metadata: {
      ...(options.metadata ?? {}),
      payer: {
        strategy: payer.strategy,
        fallbackType: payer.fallbackType,
        fallbackId: payer.fallbackId,
        metadata: payer.metadata ?? null,
      },
    },
    occurredAt: options.occurredAt ?? new Date(),
  });
}

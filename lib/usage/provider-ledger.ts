import "server-only";

import { getDb } from "@/lib/db";
import {
  ProviderAdapter,
  ProviderAdapterContext,
  ProviderMetricReading,
} from "@/lib/providers/types";
import { getProviderAdapters } from "@/lib/providers";
import {
  ProviderCostEventInput,
  ProviderCostSnapshotInput,
  createProviderReconciliation,
  recordProviderCostEvents,
  upsertProviderCostSnapshot,
  ProviderMetricWindow,
} from "@/lib/db/provider-costs";

type SyncOptions = {
  window?: ProviderMetricWindow;
  adapters?: ProviderAdapter[];
  now?: Date;
};

type SyncResult = {
  provider: string;
  metric: string;
  quantity: number;
  costUsd: number;
  varianceUsd: number;
  varianceRatio: number;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addUtcHours(date: Date, hours: number) {
  const result = new Date(date.getTime());
  result.setUTCHours(result.getUTCHours() + hours);
  return result;
}

function resolveWindowRange(now: Date, window: ProviderMetricWindow) {
  switch (window) {
    case "hour":
      const hourStart = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        0,
        0,
        0,
      ));
      return {
        windowStart: hourStart,
        windowEnd: addUtcHours(hourStart, 1),
      };
    case "week": {
      const dayStart = startOfUtcDay(now);
      const dayOfWeek = dayStart.getUTCDay();
      const diff = (dayOfWeek + 6) % 7; // start week on Monday
      const windowStart = addUtcDays(dayStart, -diff);
      const windowEnd = addUtcDays(windowStart, 7);
      return { windowStart, windowEnd };
    }
    case "month": {
      const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return { windowStart, windowEnd };
    }
    case "day":
    default: {
      const windowStart = startOfUtcDay(now);
      const windowEnd = addUtcDays(windowStart, 1);
      return { windowStart, windowEnd };
    }
  }
}

async function persistReadings(
  readings: ProviderMetricReading[],
  window: ProviderMetricWindow,
  windowStart: Date,
  windowEnd: Date,
) {
  const db = getDb();
  const events: ProviderCostEventInput[] = [];
  const reconResults: SyncResult[] = [];

  for (const reading of readings) {
    events.push({
      provider: reading.provider,
      metric: reading.metric,
      windowStart,
      windowEnd,
      quantity: reading.quantity,
      costUsd: reading.costUsd,
      currency: reading.currency ?? "usd",
      metadata: reading.metadata ?? {},
    });

    const snapshot: ProviderCostSnapshotInput = {
      provider: reading.provider,
      metric: reading.metric,
      window,
      windowStart,
      windowEnd,
      quantity: reading.quantity,
      costUsd: reading.costUsd,
      currency: reading.currency ?? "usd",
      metadata: reading.metadata ?? {},
      sampleCount: 1,
    };

    await upsertProviderCostSnapshot(db, snapshot);
    const reconciliation = await createProviderReconciliation(db, {
      provider: reading.provider,
      metric: reading.metric,
      window,
      windowStart,
      windowEnd,
      providerQuantity: reading.quantity,
      providerCostUsd: reading.costUsd,
      metadata: reading.metadata ?? {},
    });

    reconResults.push({
      provider: reading.provider,
      metric: reading.metric,
      quantity: reading.quantity,
      costUsd: reading.costUsd,
      varianceUsd: reconciliation.varianceUsd,
      varianceRatio: reconciliation.varianceRatio,
    });
  }

  await recordProviderCostEvents(db, events);
  return reconResults;
}

async function collectFromAdapters(
  adapters: ProviderAdapter[],
  context: ProviderAdapterContext,
): Promise<ProviderMetricReading[]> {
  const allReadings: ProviderMetricReading[] = [];
  const errors: Array<{ adapterId: string; error: unknown }> = [];

  for (const adapter of adapters) {
    try {
      console.log(`[provider-sync] Collecting from adapter: ${adapter.id}`);
      const readings = await adapter.collect(context);
      console.log(`[provider-sync] ${adapter.id} returned ${readings.length} readings`);
      allReadings.push(...readings);
    } catch (error) {
      console.error(`[provider-sync] ❌ Adapter ${adapter.id} failed:`, error);
      errors.push({ adapterId: adapter.id, error });
    }
  }

  if (errors.length > 0) {
    console.error(`[provider-sync] Failed adapters:`, errors.map(e => e.adapterId).join(', '));
  }

  console.log(`[provider-sync] Total readings collected: ${allReadings.length}`);
  return allReadings;
}

export async function syncProviderCosts(options?: SyncOptions) {
  const now = options?.now ?? new Date();
  const window = options?.window ?? "day";
  const { windowStart, windowEnd } = resolveWindowRange(now, window);

  const adapters = options?.adapters ?? getProviderAdapters();
  const context: ProviderAdapterContext = {
    now,
    windowStart,
    windowEnd,
    fetchImpl: typeof fetch !== "undefined" ? fetch : undefined,
  };

  const readings = await collectFromAdapters(adapters, context);
  if (readings.length === 0) {
    return [] as SyncResult[];
  }

  return persistReadings(readings, window, windowStart, windowEnd);
}

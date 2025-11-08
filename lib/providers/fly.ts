import { ProviderAdapter, ProviderAdapterContext, ProviderMetricReading } from "@/lib/providers/types";

const FLY_GRAPHQL_ENDPOINT = "https://api.fly.io/graphql";

function getEnv(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

type FlyUsageResponse = {
  data?: {
    app?: {
      usage?: {
        totalMemoryGbSeconds?: number;
        totalCpuCoreSeconds?: number;
        totalBandwidthGb?: number;
        totalVolumeGbHours?: number;
        creditCost?: number;
      };
    };
  };
};

async function fetchFlyUsage(context: ProviderAdapterContext): Promise<ProviderMetricReading[]> {
  const token = getEnv("FLY_API_TOKEN");
  const appId = getEnv("FLY_APP_ID") ?? getEnv("FLY_APP_NAME");

  if (!token || !appId) {
    console.log("[fly.io] Skipping: missing FLY_API_TOKEN or FLY_APP_ID");
    return [];
  }

  const payload = {
    query: `query AppUsage($appId: ID!, $from: Time!, $to: Time!) {
      app(id: $appId) {
        usage(start: $from, end: $to) {
          totalMemoryGbSeconds
          totalCpuCoreSeconds
          totalBandwidthGb
          totalVolumeGbHours
          creditCost
        }
      }
    }`,
    variables: {
      appId,
      from: context.windowStart.toISOString(),
      to: context.windowEnd.toISOString(),
    },
  };

  const res = await (context.fetchImpl ?? fetch)(FLY_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "coda-cost-ledger/1.0",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.warn("fly.io: failed to fetch usage", res.status, await res.text());
    return [];
  }

  const body = (await res.json()) as FlyUsageResponse;
  const usage = body.data?.app?.usage;
  if (!usage) return [];

  const readings: ProviderMetricReading[] = [];
  const metadata: Record<string, unknown> = {};

  if (typeof usage.totalMemoryGbSeconds === "number") {
    readings.push({
      provider: "devmode_compute",
      metric: "memory_gb_seconds",
      windowStart: context.windowStart,
      windowEnd: context.windowEnd,
      quantity: usage.totalMemoryGbSeconds ?? 0,
      costUsd: 0,
      currency: "usd",
      metadata,
    });
  }

  if (typeof usage.totalCpuCoreSeconds === "number") {
    readings.push({
      provider: "devmode_compute",
      metric: "cpu_core_seconds",
      windowStart: context.windowStart,
      windowEnd: context.windowEnd,
      quantity: usage.totalCpuCoreSeconds ?? 0,
      costUsd: 0,
      currency: "usd",
      metadata,
    });
  }

  if (typeof usage.totalBandwidthGb === "number") {
    readings.push({
      provider: "devmode_bandwidth",
      metric: "bandwidth_gb",
      windowStart: context.windowStart,
      windowEnd: context.windowEnd,
      quantity: usage.totalBandwidthGb ?? 0,
      costUsd: 0,
      currency: "usd",
      metadata,
    });
  }

  if (typeof usage.creditCost === "number") {
    readings.push({
      provider: "fly_io",
      metric: "credits",
      windowStart: context.windowStart,
      windowEnd: context.windowEnd,
      quantity: usage.creditCost ?? 0,
      costUsd: usage.creditCost ?? 0,
      currency: "usd",
      metadata,
    });
  }

  return readings;
}

export const flyAdapter: ProviderAdapter = {
  id: "fly_io",
  label: "Fly.io",
  async collect(context) {
    return fetchFlyUsage(context);
  },
};

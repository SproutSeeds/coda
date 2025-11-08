import { ProviderAdapter, ProviderAdapterContext, ProviderMetricReading } from "@/lib/providers/types";

function getEnv(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

type UpstashMetric = {
  metric?: string;
  usage?: number;
  cost?: number;
  unit?: string;
};

type UpstashResponse = {
  metrics?: UpstashMetric[];
};

async function fetchUpstashUsage(context: ProviderAdapterContext): Promise<ProviderMetricReading[]> {
  const restUrl = getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN");

  if (!restUrl || !token) {
    return [];
  }

  const metricsUrl = `${restUrl.replace(/\/$/, "")}/metrics`;
  const res = await (context.fetchImpl ?? fetch)(metricsUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "coda-cost-ledger/1.0",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.warn("upstash: failed to fetch metrics", res.status, await res.text());
    return [];
  }

  const body = (await res.json()) as UpstashResponse;
  const metrics = body.metrics ?? [];

  return metrics.map<ProviderMetricReading>((item) => ({
    provider: "upstash_redis",
    metric: item.metric ?? "aggregate",
    windowStart: context.windowStart,
    windowEnd: context.windowEnd,
    quantity: item.usage ?? 0,
    costUsd: item.cost ?? 0,
    currency: "usd",
    metadata: {
      unit: item.unit ?? null,
    },
  }));
}

export const upstashAdapter: ProviderAdapter = {
  id: "upstash_redis",
  label: "Upstash Redis",
  async collect(context) {
    return fetchUpstashUsage(context);
  },
};

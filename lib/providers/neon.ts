import { ProviderAdapter, ProviderAdapterContext, ProviderMetricReading } from "@/lib/providers/types";

function getEnv(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

type NeonUsageResponse = {
  projects?: Array<{
    project_id: string;
    period_start: string;
    period_end: string;
    total_usd?: number;
    items?: Array<{
      resource?: string;
      usage?: number;
      cost_usd?: number;
      metadata?: Record<string, unknown>;
    }>;
  }>;
};

async function fetchNeonUsage(context: ProviderAdapterContext): Promise<ProviderMetricReading[]> {
  const apiKey = getEnv("NEON_API_KEY") ?? getEnv("NEON_API_TOKEN");
  const projectId = getEnv("NEON_PROJECT_ID");

  if (!apiKey || !projectId) {
    console.log("[neon] Skipping: missing NEON_API_KEY or NEON_PROJECT_ID");
    return [];
  }

  const url = new URL(`https://console.neon.tech/api/v2/projects/${projectId}/billing/usage`);
  url.searchParams.set("period_start", context.windowStart.toISOString());
  url.searchParams.set("period_end", context.windowEnd.toISOString());

  const res = await (context.fetchImpl ?? fetch)(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "coda-cost-ledger/1.0",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.warn("neon: failed to fetch usage", res.status, await res.text());
    return [];
  }

  const body = (await res.json()) as NeonUsageResponse;
  const projectUsage = body.projects?.[0];
  if (!projectUsage) return [];

  const readings: ProviderMetricReading[] = [];
  if (projectUsage.items && projectUsage.items.length > 0) {
    for (const item of projectUsage.items) {
      readings.push({
        provider: "neon_postgres",
        metric: item.resource ?? "unknown",
        windowStart: new Date(projectUsage.period_start ?? context.windowStart),
        windowEnd: new Date(projectUsage.period_end ?? context.windowEnd),
        quantity: item.usage ?? 0,
        costUsd: item.cost_usd ?? 0,
        currency: "usd",
        metadata: item.metadata ?? {},
      });
    }
  } else {
    readings.push({
      provider: "neon_postgres",
      metric: "aggregate",
      windowStart: new Date(projectUsage.period_start ?? context.windowStart),
      windowEnd: new Date(projectUsage.period_end ?? context.windowEnd),
      quantity: 0,
      costUsd: projectUsage.total_usd ?? 0,
      currency: "usd",
      metadata: {},
    });
  }

  return readings;
}

export const neonAdapter: ProviderAdapter = {
  id: "neon_postgres",
  label: "Neon",
  async collect(context) {
    return fetchNeonUsage(context);
  },
};

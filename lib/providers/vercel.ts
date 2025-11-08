import { ProviderAdapter, ProviderAdapterContext, ProviderMetricReading } from "@/lib/providers/types";

function getEnv(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

const DEFAULT_USAGE_TYPES = [
  "requests",
  "monitoring",
  "builds",
  "edge",
  "edge_group_by_project",
  "artifacts",
  "edge_config",
  "log_drains",
  "storage_postgres",
  "storage_redis",
  "storage_blob",
  "cron_jobs",
  "data_cache",
] as const;

async function fetchVercelUsage(context: ProviderAdapterContext): Promise<ProviderMetricReading[]> {
  const token = getEnv("VERCEL_API_TOKEN") ?? getEnv("VERCEL_AUTH_TOKEN");
  const projectId = getEnv("VERCEL_PROJECT_ID");
  const teamId = getEnv("VERCEL_TEAM_ID");

  if (!token || !projectId) {
    console.log("[vercel] Skipping: missing VERCEL_API_TOKEN or VERCEL_PROJECT_ID");
    return [];
  }

  const fromIso = new Date(context.windowStart).toISOString();
  const toIso = new Date(context.windowEnd).toISOString();

  const usageTypes = (process.env.VERCEL_USAGE_TYPES ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const typesToFetch = usageTypes.length > 0 ? usageTypes : DEFAULT_USAGE_TYPES;

  const readings: ProviderMetricReading[] = [];

  await Promise.all(
    typesToFetch.map(async (type) => {
      const url = new URL("https://api.vercel.com/v2/usage");
      url.searchParams.set("from", fromIso);
      url.searchParams.set("to", toIso);
      url.searchParams.set("projectId", projectId);
      url.searchParams.set("type", type);
      if (teamId) {
        url.searchParams.set("teamId", teamId);
      }

      const res = await (context.fetchImpl ?? fetch)(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "coda-cost-ledger/1.0",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        console.warn("vercel: failed to fetch usage", type, res.status, await res.text());
        return;
      }

      const body = (await res.json()) as {
        resources?: Array<{
          resource: string;
          usage?: number;
          cost?: number;
          unit?: string;
        }>;
      };

      const resources = body.resources ?? [];
      for (const entry of resources) {
        readings.push({
          provider: `vercel_${type}` as ProviderMetricReading['provider'],
          metric: entry.resource ?? type,
          windowStart: context.windowStart,
          windowEnd: context.windowEnd,
          quantity: entry.usage ?? 0,
          costUsd: entry.cost ?? 0,
          currency: "usd",
          metadata: {
            unit: entry.unit ?? null,
            type,
          },
        });
      }
    }),
  );

  return readings;
}

export const vercelAdapter: ProviderAdapter = {
  id: "vercel_analytics",
  label: "Vercel",
  async collect(context) {
    return fetchVercelUsage(context);
  },
};

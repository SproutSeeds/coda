import { ProviderAdapter, ProviderAdapterContext, ProviderMetricReading } from "@/lib/providers/types";

function getEnv(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

async function fetchNeonUsage(context: ProviderAdapterContext): Promise<ProviderMetricReading[]> {
  const apiKey = getEnv("NEON_API_KEY") ?? getEnv("NEON_API_TOKEN");
  const projectId = getEnv("NEON_PROJECT_ID");

  if (!apiKey || !projectId) {
    console.log("[neon] Skipping: missing NEON_API_KEY or NEON_PROJECT_ID");
    return [];
  }

  // Launch plan only has access to project-level metrics, not consumption_history
  const url = new URL(`https://console.neon.tech/api/v2/projects/${projectId}`);

  const res = await (context.fetchImpl ?? fetch)(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "coda-cost-ledger/1.0",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.warn("neon: failed to fetch project", res.status, await res.text());
    return [];
  }

  const body = (await res.json()) as { project?: {
    active_time_seconds?: number;
    compute_time_seconds?: number;
    written_data_bytes?: number;
    data_storage_bytes_hour?: number;
    data_transfer_bytes?: number;
    consumption_period_start?: string;
    consumption_period_end?: string;
  }};

  const project = body.project;
  if (!project) return [];

  const readings: ProviderMetricReading[] = [];
  const periodStart = project.consumption_period_start
    ? new Date(project.consumption_period_start)
    : context.windowStart;
  const periodEnd = project.consumption_period_end
    ? new Date(project.consumption_period_end)
    : context.windowEnd;

  // Active time (hours)
  if (typeof project.active_time_seconds === "number" && project.active_time_seconds > 0) {
    readings.push({
      provider: "neon_postgres",
      metric: "active_time_hours",
      windowStart: periodStart,
      windowEnd: periodEnd,
      quantity: project.active_time_seconds / 3600,
      costUsd: 0, // Neon doesn't provide costs in this endpoint
      currency: "usd",
      metadata: { unit: "hours" },
    });
  }

  // Compute time (hours)
  if (typeof project.compute_time_seconds === "number" && project.compute_time_seconds > 0) {
    readings.push({
      provider: "neon_postgres",
      metric: "compute_time_hours",
      windowStart: periodStart,
      windowEnd: periodEnd,
      quantity: project.compute_time_seconds / 3600,
      costUsd: 0,
      currency: "usd",
      metadata: { unit: "hours" },
    });
  }

  // Written data (GB)
  if (typeof project.written_data_bytes === "number" && project.written_data_bytes > 0) {
    readings.push({
      provider: "neon_postgres",
      metric: "written_data_gb",
      windowStart: periodStart,
      windowEnd: periodEnd,
      quantity: project.written_data_bytes / (1024 ** 3),
      costUsd: 0,
      currency: "usd",
      metadata: { unit: "GB" },
    });
  }

  // Storage (GB-hours)
  if (typeof project.data_storage_bytes_hour === "number" && project.data_storage_bytes_hour > 0) {
    readings.push({
      provider: "neon_postgres",
      metric: "storage_gb_hours",
      windowStart: periodStart,
      windowEnd: periodEnd,
      quantity: project.data_storage_bytes_hour / (1024 ** 3),
      costUsd: 0,
      currency: "usd",
      metadata: { unit: "GB-hours" },
    });
  }

  // Data transfer (GB)
  if (typeof project.data_transfer_bytes === "number" && project.data_transfer_bytes > 0) {
    readings.push({
      provider: "neon_postgres",
      metric: "data_transfer_gb",
      windowStart: periodStart,
      windowEnd: periodEnd,
      quantity: project.data_transfer_bytes / (1024 ** 3),
      costUsd: 0,
      currency: "usd",
      metadata: { unit: "GB" },
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

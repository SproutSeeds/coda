export type ProviderId =
  | "neon_postgres"
  | "vercel_bandwidth"
  | "vercel_analytics"
  | "upstash_redis"
  | "fly_io"
  | "email_delivery"
  | "devmode_compute"
  | "devmode_bandwidth"
  | "liveblocks";

export type ProviderMetricReading = {
  provider: ProviderId;
  metric: string;
  windowStart: Date;
  windowEnd: Date;
  quantity: number;
  costUsd: number;
  currency?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderAdapterContext = {
  now: Date;
  windowStart: Date;
  windowEnd: Date;
  fetchImpl?: typeof fetch;
};

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  collect(context: ProviderAdapterContext): Promise<ProviderMetricReading[]>;
}

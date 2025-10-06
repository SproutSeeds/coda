import { track } from "@vercel/analytics";

export type AnalyticEvent = {
  name: string;
  properties?: Record<string, unknown>;
};

export async function trackEvent(event: AnalyticEvent): Promise<void> {
  try {
    await track(event.name, sanitize(event.properties) as Record<string, never>);
  } catch {
    // Ignore analytics failures during local development/tests.
  }
}

function sanitize(props?: Record<string, unknown>) {
  if (!props) return {} as Record<string, string | number | boolean | null | undefined>;
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [key, normalizeValue(value)]),
  ) as Record<string, string | number | boolean | null | undefined>;
}

function normalizeValue(value: unknown): string | number | boolean | null | undefined {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

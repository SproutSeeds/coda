import { track } from "@vercel/analytics/server";

import { actorPays } from "@/lib/limits/payer";
import { logUsageCost } from "@/lib/usage/log-cost";

const ANALYTICS_EVENT_NAMES = [
  "auth_magic_link_requested",
  "auth_password_created",
  "auth_password_updated",
  "auth_magic_link_verified",
  "meetup_checkin",
  "idea_created",
  "idea_updated",
  "idea_deleted",
  "idea_restored",
  "idea_searched",
  "idea_reordered",
  "idea_purged",
  "idea_starred",
  "idea_unstarred",
  "idea_super_starred",
  "idea_converted_to_feature",
  "feature_updated",
  "feature_deleted",
  "feature_reordered",
  "feature_created",
  "feature_restored",
  "feature_starred",
  "feature_super_starred",
  "feature_unstarred",
  "feature_completed",
  "feature_reopened",
  "feature_converted_to_idea",
  "suggestion_created",
  "suggestion_updated",
  "suggestion_deleted",
  "suggestion_restored",
  "suggestion_purged",
  "suggestion_starred",
  "suggestion_unstarred",
  "suggestion_reordered",
  "suggestion_completed",
  "suggestion_reopened",
  "suggestion_update_created",
  "theme_preference.updated",
  "ideas_import_attempt",
  "ideas_import_complete",
  "ideas_import_error",
  "idea_collaborator_invited",
  "idea_collaborator_role_updated",
  "idea_collaborator_removed",
  "idea_collaborator_invite_revoked",
  "idea_collaborator_left",
  "idea_collaborator_joined",
  "idea_join_requests_viewed",
  "idea_join_requests_marked_seen",
  "idea_join_request_resolved",
  "idea_join_request_reacted",
  "idea_join_request_archived",
  "idea_join_request_created",
  "limit.warned",
  "limit.blocked",
  "credits_purchase.initiated",
  "credits_purchase.completed",
  "credits_autotopup.updated",
] as const;

export type AnalyticEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

const KNOWN_EVENTS = new Set<AnalyticEventName>(ANALYTICS_EVENT_NAMES);

export type AnalyticEvent = {
  name: AnalyticEventName;
  properties?: Record<string, unknown>;
};

export async function trackEvent(event: AnalyticEvent): Promise<void> {
  if (!KNOWN_EVENTS.has(event.name)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`analytics: attempted to emit unknown event "${event.name}"`);
    }
    return;
  }
  const properties = sanitize(event.properties);
  await Promise.allSettled([
    (async () => {
      try {
        await track(event.name, properties as Record<string, never>);
      } catch {
        // Ignore analytics failures during local development/tests.
      }
    })(),
    logAnalyticsUsage(event, properties),
  ]);
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

async function logAnalyticsUsage(event: AnalyticEvent, properties: Record<string, unknown>) {
  try {
    const userId = typeof properties.userId === "string" ? properties.userId : null;
    const metadata: Record<string, unknown> = { event: event.name, hasUserId: Boolean(userId) };
    if (userId) {
      await logUsageCost({
        payer: actorPays(userId, { source: "analytics.event" }),
        action: "analytics.event",
        metadata,
      });
      return;
    }
    await logUsageCost({
      payerType: "workspace",
      payerId: "analytics:global",
      action: "analytics.event",
      metadata,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("analytics: failed to log usage cost", { event: event.name, error });
    }
  }
}

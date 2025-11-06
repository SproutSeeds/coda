import { sql } from "drizzle-orm";
import { pgEnum, pgTable, text, uuid, numeric, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

export const providerMetricWindowEnum = pgEnum("provider_metric_window", ["hour", "day", "week", "month"]);

export const providerCostEvents = pgTable("provider_cost_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  metric: text("metric").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  quantity: numeric("quantity").notNull().default("0"),
  costUsd: numeric("cost_usd").notNull().default("0"),
  currency: text("currency").notNull().default("usd"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  providerMetricWindowIdx: index("idx_provider_cost_events_provider_metric_window").on(
    table.provider,
    table.metric,
    table.windowStart,
    table.windowEnd,
  ),
}));

export const providerCostSnapshots = pgTable("provider_cost_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  metric: text("metric").notNull(),
  window: providerMetricWindowEnum("window").notNull().default("day"),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  quantity: numeric("quantity").notNull().default("0"),
  costUsd: numeric("cost_usd").notNull().default("0"),
  currency: text("currency").notNull().default("usd"),
  sampleCount: numeric("sample_count").notNull().default("0"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  providerWindowUnique: uniqueIndex("uniq_provider_cost_snapshots_window").on(
    table.provider,
    table.metric,
    table.window,
    table.windowStart,
  ),
}));

export const providerCostReconciliations = pgTable("provider_cost_reconciliations", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  metric: text("metric").notNull(),
  window: providerMetricWindowEnum("window").notNull().default("day"),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  providerQuantity: numeric("provider_quantity").notNull().default("0"),
  providerCostUsd: numeric("provider_cost_usd").notNull().default("0"),
  internalQuantity: numeric("internal_quantity").notNull().default("0"),
  internalCostUsd: numeric("internal_cost_usd").notNull().default("0"),
  varianceUsd: numeric("variance_usd").notNull().default("0"),
  varianceRatio: numeric("variance_ratio").notNull().default("0"),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
}, (table) => ({
  providerWindowIdx: index("idx_provider_cost_reconciliations_window").on(
    table.provider,
    table.metric,
    table.window,
    table.windowStart,
  ),
}));

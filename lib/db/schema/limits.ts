import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, integer, jsonb, primaryKey, pgEnum, bigint, index } from "drizzle-orm/pg-core";
import { users } from "../schema";
import { plans } from "./plans";

export const limitScopeTypeEnum = pgEnum("limit_scope_type", ["user", "idea", "org"]);
export const limitPeriodEnum = pgEnum("limit_period", ["lifetime", "daily", "monthly"]);
export const limitEventTypeEnum = pgEnum("limit_event_type", ["warn", "block"]);
export const limitOverrideStatusEnum = pgEnum("limit_override_status", ["pending", "approved", "rejected"]);

export const limitOverrides = pgTable("limit_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  scopeType: limitScopeTypeEnum("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  metric: text("metric").notNull(),
  limitValue: integer("limit_value").notNull(),
  planId: text("plan_id").references(() => plans.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  reason: text("reason"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  status: limitOverrideStatusEnum("status").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  scopeMetricIdx: index("idx_limit_overrides_scope_metric").on(table.scopeType, table.scopeId, table.metric),
  statusIdx: index("idx_limit_overrides_status").on(table.status, table.createdAt),
}));

export const usageCounters = pgTable("usage_counters", {
  scopeType: limitScopeTypeEnum("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  metric: text("metric").notNull(),
  period: limitPeriodEnum("period").notNull(),
  periodKey: text("period_key").notNull(),
  count: bigint("count", { mode: "number" }).notNull().default(sql`0`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  usagePk: primaryKey({
    columns: [table.scopeType, table.scopeId, table.metric, table.period, table.periodKey],
    name: "usage_counters_pk",
  }),
}));

export const auditLimitEvents = pgTable("audit_limit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  scopeType: limitScopeTypeEnum("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  planId: text("plan_id").references(() => plans.id, { onDelete: "set null" }),
  metric: text("metric").notNull(),
  event: limitEventTypeEnum("event").notNull(),
  value: integer("value").notNull(),
  limit: integer("limit").notNull(),
  action: text("action"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  scopeEventIdx: index("idx_audit_limit_events_scope").on(table.scopeType, table.scopeId, table.metric),
}));

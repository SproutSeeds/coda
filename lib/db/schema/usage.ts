import { pgEnum, pgTable, text, uuid, jsonb, numeric, timestamp } from "drizzle-orm/pg-core";

export const usagePayerEnum = pgEnum("usage_payer_type", ["user", "workspace"]);
export const usageUnitEnum = pgEnum("usage_unit", ["units", "minutes", "bytes", "emails", "requests", "rows", "credits"]);

export const usageCosts = pgTable("usage_costs", {
  id: uuid("id").defaultRandom().primaryKey(),
  payerType: usagePayerEnum("payer_type").notNull(),
  payerId: text("payer_id").notNull(),
  action: text("action").notNull(),
  vendor: text("vendor").notNull(),
  unit: usageUnitEnum("unit").notNull(),
  quantity: numeric("quantity").notNull(),
  unitCost: numeric("unit_cost").notNull(),
  totalCost: numeric("total_cost").notNull(),
  creditsDebited: numeric("credits_debited").notNull().default("0"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});


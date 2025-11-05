import { sql } from "drizzle-orm";
import { boolean, index, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "../schema";
import { usagePayerEnum } from "./usage";

export const creditLedgerEntryTypeEnum = pgEnum("credit_ledger_entry_type", [
  "purchase",
  "debit",
  "refund",
  "adjustment",
  "top_up",
  "usage",
]);

export const creditPurchaseStatusEnum = pgEnum("credit_purchase_status", ["pending", "completed", "failed", "canceled"]);

export const creditBalances = pgTable(
  "credit_balances",
  {
    payerType: usagePayerEnum("payer_type").notNull(),
    payerId: text("payer_id").notNull(),
    availableCredits: numeric("available_credits").notNull().default(sql`0`),
    onHoldCredits: numeric("on_hold_credits").notNull().default(sql`0`),
    autoTopUpEnabled: boolean("auto_top_up_enabled").notNull().default(false),
    autoTopUpCredits: numeric("auto_top_up_credits").notNull().default(sql`0`),
    autoTopUpThreshold: numeric("auto_top_up_threshold").notNull().default(sql`0`),
    autoTopUpPaymentMethodId: text("auto_top_up_payment_method_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    creditBalancesPk: primaryKey({
      columns: [table.payerType, table.payerId],
      name: "credit_balances_pk",
    }),
  }),
);

export const creditLedgerEntries = pgTable(
  "credit_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payerType: usagePayerEnum("payer_type").notNull(),
    payerId: text("payer_id").notNull(),
    entryType: creditLedgerEntryTypeEnum("entry_type").notNull(),
    delta: numeric("delta").notNull(),
    balanceAfter: numeric("balance_after").notNull(),
    referenceId: text("reference_id"),
    source: text("source"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    payerCreatedIdx: index("idx_credit_ledger_payer_created_at").on(table.payerType, table.payerId, table.createdAt),
    referenceIdx: index("idx_credit_ledger_reference").on(table.referenceId),
  }),
);

export const creditPurchases = pgTable(
  "credit_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payerType: usagePayerEnum("payer_type").notNull(),
    payerId: text("payer_id").notNull(),
    provider: text("provider").notNull(),
    providerReference: text("provider_reference"),
    status: creditPurchaseStatusEnum("status").notNull().default("pending"),
    credits: numeric("credits").notNull(),
    amountUsd: numeric("amount_usd").notNull(),
    initiatedBy: text("initiated_by").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    payerStatusIdx: index("idx_credit_purchases_payer_status").on(table.payerType, table.payerId, table.status),
    providerRefIdx: index("idx_credit_purchases_provider_ref").on(table.provider, table.providerReference),
  }),
);

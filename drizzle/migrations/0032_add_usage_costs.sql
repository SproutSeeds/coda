CREATE TYPE "usage_payer_type" AS ENUM ('user', 'workspace');
CREATE TYPE "usage_unit" AS ENUM ('units', 'minutes', 'bytes', 'emails', 'requests', 'rows', 'credits');

CREATE TABLE "usage_costs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "payer_type" "usage_payer_type" NOT NULL,
    "payer_id" text NOT NULL,
    "action" text NOT NULL,
    "vendor" text NOT NULL,
    "unit" "usage_unit" NOT NULL,
    "quantity" numeric NOT NULL,
    "unit_cost" numeric NOT NULL,
    "total_cost" numeric NOT NULL,
    "credits_debited" numeric NOT NULL DEFAULT 0,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "occurred_at" timestamptz NOT NULL DEFAULT now(),
    "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_usage_costs_payer" ON "usage_costs" ("payer_type", "payer_id", "occurred_at");
CREATE INDEX "idx_usage_costs_action" ON "usage_costs" ("action", "occurred_at");

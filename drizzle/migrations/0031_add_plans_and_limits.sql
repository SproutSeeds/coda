CREATE TYPE "limit_scope_type" AS ENUM ('user', 'idea', 'org');
CREATE TYPE "limit_period" AS ENUM ('lifetime', 'daily', 'monthly');
CREATE TYPE "limit_event_type" AS ENUM ('warn', 'block');

CREATE TABLE "plans" (
    "id" text PRIMARY KEY,
    "name" text NOT NULL,
    "description" text,
    "is_default" boolean NOT NULL DEFAULT false,
    "features" jsonb NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "user_plans" (
    "user_id" text NOT NULL REFERENCES "auth_user"("id") ON DELETE cascade,
    "plan_id" text NOT NULL REFERENCES "plans"("id") ON DELETE restrict,
    "org_id" uuid,
    "starts_at" timestamptz NOT NULL DEFAULT now(),
    "ends_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "uniq_user_plan_scope" UNIQUE ("user_id")
);

CREATE TABLE "limit_overrides" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "scope_type" "limit_scope_type" NOT NULL,
    "scope_id" uuid NOT NULL,
    "metric" text NOT NULL,
    "limit_value" integer NOT NULL,
    "plan_id" text REFERENCES "plans"("id") ON DELETE set null,
    "expires_at" timestamptz,
    "reason" text,
    "created_by" text REFERENCES "auth_user"("id") ON DELETE set null,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_limit_overrides_scope_metric" ON "limit_overrides" ("scope_type", "scope_id", "metric");

CREATE TABLE "usage_counters" (
    "scope_type" "limit_scope_type" NOT NULL,
    "scope_id" uuid NOT NULL,
    "metric" text NOT NULL,
    "period" "limit_period" NOT NULL,
    "period_key" text NOT NULL,
    "count" bigint NOT NULL DEFAULT 0,
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "usage_counters_pk" PRIMARY KEY ("scope_type", "scope_id", "metric", "period", "period_key")
);

CREATE TABLE "audit_limit_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "scope_type" "limit_scope_type" NOT NULL,
    "scope_id" uuid NOT NULL,
    "plan_id" text REFERENCES "plans"("id") ON DELETE set null,
    "metric" text NOT NULL,
    "event" "limit_event_type" NOT NULL,
    "value" integer NOT NULL,
    "limit" integer NOT NULL,
    "action" text,
    "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_by" text REFERENCES "auth_user"("id") ON DELETE set null,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_audit_limit_events_scope" ON "audit_limit_events" ("scope_type", "scope_id", "metric");

INSERT INTO "plans" ("id", "name", "description", "is_default", "features") VALUES
  ('free', 'Free', 'Starter quota suitable for individual exploration.', true, '{
    "ideas.per_user.lifetime": 5,
    "features.per_idea.lifetime": 50,
    "collaborators.per_idea.lifetime": 3,
    "publicIdeas.per_user.lifetime": 1,
    "joinRequests.per_idea.per_viewer.cooldownDays": 7,
    "mutations.per_user.daily": 500
  }'),
  ('pro', 'Pro', 'Expanded capacity for growing teams.', false, '{
    "ideas.per_user.lifetime": 50,
    "features.per_idea.lifetime": 500,
    "collaborators.per_idea.lifetime": 10,
    "publicIdeas.per_user.lifetime": 10,
    "joinRequests.per_idea.per_viewer.cooldownDays": 3,
    "mutations.per_user.daily": 5000
  }'),
  ('team', 'Team', 'High-volume quota for organizations.', false, '{
    "ideas.per_user.lifetime": 500,
    "features.per_idea.lifetime": 5000,
    "collaborators.per_idea.lifetime": 50,
    "publicIdeas.per_user.lifetime": 100,
    "joinRequests.per_idea.per_viewer.cooldownDays": 1,
    "mutations.per_user.daily": 25000
  }');

INSERT INTO "user_plans" ("user_id", "plan_id")
SELECT "id", 'free'
FROM "auth_user"
ON CONFLICT ("user_id") DO NOTHING;


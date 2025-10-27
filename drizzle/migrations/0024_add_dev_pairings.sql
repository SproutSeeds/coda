-- Dev Mode device pairing codes
create table if not exists "dev_pairings" (
  "id" uuid primary key default gen_random_uuid(),
  "code" text not null unique,
  "state" text not null default 'pending', -- pending|approved|consumed|expired
  "user_id" text,
  "runner_id" text,
  "runner_token" text,
  "created_at" timestamptz not null default now(),
  "expires_at" timestamptz not null default (now() + interval '10 minutes'),
  "approved_at" timestamptz,
  "consumed_at" timestamptz
);
create index if not exists "idx_dev_pairings_code" on "dev_pairings" ("code");


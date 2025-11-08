-- Provider cost ledger tables
do $$ begin
  if not exists (select 1 from pg_type where typname = 'provider_metric_window') then
    create type provider_metric_window as enum ('hour', 'day', 'week', 'month');
  end if;
end $$;

create table if not exists provider_cost_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  metric text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  quantity numeric not null default 0,
  cost_usd numeric not null default 0,
  currency text not null default 'usd',
  fetched_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_provider_cost_events_provider_metric_window
  on provider_cost_events (provider, metric, window_start, window_end);

create table if not exists provider_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  metric text not null,
  "window" provider_metric_window not null default 'day',
  window_start timestamptz not null,
  window_end timestamptz not null,
  quantity numeric not null default 0,
  cost_usd numeric not null default 0,
  currency text not null default 'usd',
  sample_count numeric not null default 0,
  last_fetched_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_provider_cost_snapshots_window
  on provider_cost_snapshots (provider, metric, "window", window_start);

create table if not exists provider_cost_reconciliations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  metric text not null,
  "window" provider_metric_window not null default 'day',
  window_start timestamptz not null,
  window_end timestamptz not null,
  provider_quantity numeric not null default 0,
  provider_cost_usd numeric not null default 0,
  internal_quantity numeric not null default 0,
  internal_cost_usd numeric not null default 0,
  variance_usd numeric not null default 0,
  variance_ratio numeric not null default 0,
  computed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_provider_cost_reconciliations_window
  on provider_cost_reconciliations (provider, metric, "window", window_start);

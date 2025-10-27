-- Dev Mode logs persistence
create table if not exists "dev_logs" (
  "id" text primary key,
  "job_id" uuid not null references "dev_jobs"("id") on delete cascade,
  "level" text not null,
  "text" text not null,
  "seq" integer not null,
  "ts" timestamptz not null default now()
);

create index if not exists "idx_dev_logs_job_seq" on "dev_logs" ("job_id", "seq");

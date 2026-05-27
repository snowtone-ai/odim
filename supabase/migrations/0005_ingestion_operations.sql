create table if not exists ingestion_runs (
  id uuid primary key,
  mode text not null check (mode in ('daily', 'backfill', 'dry-run')),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  source_limit integer not null default 50,
  raw_signal_count integer not null default 0,
  ontology_object_count integer not null default 0,
  ontology_link_count integer not null default 0,
  alert_count integer not null default 0,
  audit_event_count integer not null default 0,
  source_report jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists source_watermarks (
  source_id text primary key,
  mode text not null default 'daily',
  last_success_at timestamptz not null default now(),
  last_observed_at timestamptz,
  raw_signal_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create unique index if not exists alerts_dedupe_key_unique_idx on alerts (dedupe_key);
create unique index if not exists audit_log_dedupe_key_unique_idx on audit_log (dedupe_key);

alter table ingestion_runs enable row level security;
alter table source_watermarks enable row level security;

drop policy if exists ingestion_runs_service_only on ingestion_runs;
create policy ingestion_runs_service_only on ingestion_runs
  for all
  using (current_role = 'service_role')
  with check (current_role = 'service_role');

drop policy if exists source_watermarks_service_only on source_watermarks;
create policy source_watermarks_service_only on source_watermarks
  for all
  using (current_role = 'service_role')
  with check (current_role = 'service_role');

grant all privileges on ingestion_runs, source_watermarks to service_role;

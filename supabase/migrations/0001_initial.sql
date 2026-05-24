create extension if not exists vector;

create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text not null default 'enterprise',
  created_at timestamptz default now()
);

create table if not exists users (
  id uuid primary key,
  org_id uuid not null references orgs(id),
  display_name text,
  role text not null default 'analyst'
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  name text not null,
  prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  created_by uuid references users(id),
  created_at timestamptz default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create unique index if not exists api_keys_key_hash_idx on api_keys (key_hash);
create index if not exists api_keys_prefix_idx on api_keys (prefix);
create index if not exists api_keys_org_id_idx on api_keys (org_id);

create table if not exists alert_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs(id),
  name text not null,
  layer text not null,
  min_confidence float not null default 0.6,
  destination text not null default 'api',
  enabled boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists alert_rules_org_id_idx on alert_rules (org_id);

create table if not exists ontology_objects (
  id uuid primary key default gen_random_uuid(),
  object_type text not null,
  attributes jsonb not null default '{}',
  org_visible uuid references orgs(id),
  source_refs jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ontology_links (
  id uuid primary key default gen_random_uuid(),
  from_object_id uuid not null references ontology_objects(id),
  to_object_id uuid not null references ontology_objects(id),
  link_type text not null,
  confidence float not null default 0.5,
  org_visible uuid references orgs(id),
  source_refs jsonb default '[]',
  created_at timestamptz default now()
);

create table if not exists raw_signals (
  id uuid primary key default gen_random_uuid(),
  layer text not null,
  source text not null,
  external_id text,
  fingerprint text not null,
  payload jsonb not null,
  source_refs jsonb default '[]',
  org_id uuid references orgs(id),
  freshness float default 1.0,
  is_proprietary boolean default false,
  observed_at timestamptz not null,
  ingested_at timestamptz default now()
);
create unique index if not exists raw_signals_fingerprint_idx on raw_signals (fingerprint);
create index if not exists raw_signals_org_id_idx on raw_signals (org_id);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text,
  priority text not null,
  title text not null,
  description text,
  related_object_id uuid references ontology_objects(id),
  evidence jsonb default '[]',
  confidence float,
  source_refs jsonb default '[]',
  org_id uuid references orgs(id),
  created_at timestamptz default now()
);
create unique index if not exists alerts_dedupe_key_idx on alerts (dedupe_key) where dedupe_key is not null;

create table if not exists munin_memory (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  user_id uuid references users(id),
  agent_scope text not null,
  content text not null,
  source_refs jsonb default '[]',
  embedding vector(768),
  importance float default 0.5,
  decay_score float default 1.0,
  linked_memory_ids uuid[] default '{}',
  created_at timestamptz default now(),
  last_accessed_at timestamptz default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text,
  event_type text not null,
  object_id uuid,
  org_id uuid references orgs(id),
  actor text not null,
  detail jsonb,
  source_refs jsonb default '[]',
  confidence float,
  created_at timestamptz default now()
);
create unique index if not exists audit_log_dedupe_key_idx on audit_log (dedupe_key) where dedupe_key is not null;

create or replace function current_request_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from users where id = auth.uid()
$$;

grant usage on schema public to authenticated;
grant select on users, api_keys, alert_rules, raw_signals, ontology_objects, ontology_links, alerts, audit_log, munin_memory to authenticated;
grant usage on schema public to service_role;
grant all privileges on orgs, users, api_keys, alert_rules, raw_signals, ontology_objects, ontology_links, alerts, audit_log, munin_memory to service_role;

alter table munin_memory enable row level security;
drop policy if exists munin_org_isolation on munin_memory;
create policy munin_org_isolation on munin_memory
  using (org_id = current_request_org_id());

alter table users enable row level security;
drop policy if exists users_org_isolation on users;
create policy users_org_isolation on users
  using (org_id = current_request_org_id());

alter table api_keys enable row level security;
drop policy if exists api_keys_org_isolation on api_keys;
create policy api_keys_org_isolation on api_keys
  using (org_id = current_request_org_id());

alter table alert_rules enable row level security;
drop policy if exists alert_rules_public_or_org on alert_rules;
create policy alert_rules_public_or_org on alert_rules
  using (
    org_id is null
    or org_id = current_request_org_id()
  );

alter table raw_signals enable row level security;
drop policy if exists raw_signals_public_or_org on raw_signals;
create policy raw_signals_public_or_org on raw_signals
  using (
    is_proprietary = false
    or org_id = current_request_org_id()
  )
  with check (
    is_proprietary = false
    or org_id = current_request_org_id()
  );

alter table ontology_objects enable row level security;
drop policy if exists ontology_public_or_org on ontology_objects;
create policy ontology_public_or_org on ontology_objects
  using (
    org_visible is null
    or org_visible = current_request_org_id()
  );

alter table ontology_links enable row level security;
drop policy if exists ontology_links_public_or_org on ontology_links;
create policy ontology_links_public_or_org on ontology_links
  using (
    org_visible is null
    or org_visible = current_request_org_id()
  );

alter table alerts enable row level security;
drop policy if exists alerts_public_or_org on alerts;
create policy alerts_public_or_org on alerts
  using (
    org_id is null
    or org_id = current_request_org_id()
  );

alter table audit_log enable row level security;
drop policy if exists audit_log_public_or_org on audit_log;
create policy audit_log_public_or_org on audit_log
  using (
    org_id is null
    or org_id = current_request_org_id()
  );

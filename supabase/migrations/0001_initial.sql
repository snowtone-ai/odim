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
  payload jsonb not null,
  freshness float default 1.0,
  is_proprietary boolean default false,
  observed_at timestamptz not null,
  ingested_at timestamptz default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  priority text not null,
  title text not null,
  description text,
  related_object_id uuid references ontology_objects(id),
  evidence jsonb default '[]',
  org_id uuid references orgs(id),
  created_at timestamptz default now()
);

create table if not exists munin_memory (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  user_id uuid references users(id),
  agent_scope text not null,
  content text not null,
  embedding vector(768),
  importance float default 0.5,
  decay_score float default 1.0,
  linked_memory_ids uuid[] default '{}',
  created_at timestamptz default now(),
  last_accessed_at timestamptz default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  object_id uuid,
  actor text not null,
  detail jsonb,
  confidence float,
  created_at timestamptz default now()
);

alter table munin_memory enable row level security;
drop policy if exists munin_org_isolation on munin_memory;
create policy munin_org_isolation on munin_memory
  using (org_id = (select org_id from users where id = auth.uid()));

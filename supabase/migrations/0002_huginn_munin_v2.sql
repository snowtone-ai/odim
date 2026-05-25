alter table munin_memory add column if not exists memory_class text not null default 'fact';
alter table munin_memory add column if not exists source_type text not null default 'odim_derived';
alter table munin_memory add column if not exists is_seed boolean default false;
alter table munin_memory add column if not exists status text not null default 'active';
alter table munin_memory add column if not exists salience_score float not null default 0.5;
alter table munin_memory add column if not exists valid_from timestamptz default now();
alter table munin_memory add column if not exists valid_to timestamptz;

create index if not exists munin_memory_org_class_status_idx on munin_memory (org_id, memory_class, status);

create table if not exists munin_opinions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  user_id uuid references users(id),
  source_type text not null,
  content text not null,
  embedding vector(768),
  is_seed boolean default false,
  valid_from timestamptz default now(),
  valid_to timestamptz,
  created_at timestamptz default now()
);
create index if not exists munin_opinions_embedding_idx on munin_opinions using ivfflat (embedding vector_cosine_ops);
create index if not exists munin_opinions_org_id_idx on munin_opinions (org_id);

create table if not exists munin_dream_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  phase_summary jsonb,
  diff jsonb,
  status text not null default 'pending_review',
  created_at timestamptz default now()
);
create index if not exists munin_dream_runs_org_id_idx on munin_dream_runs (org_id);

create table if not exists huginn_eval_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  question text not null,
  answer text not null,
  plan jsonb,
  retrieval_layers_used text[],
  sources_count int,
  grader_score float,
  grader_flags text[],
  user_rating int,
  user_note text,
  created_at timestamptz default now()
);
create index if not exists huginn_eval_log_org_id_idx on huginn_eval_log (org_id);

alter table munin_memory enable row level security;
alter table munin_opinions enable row level security;
alter table munin_dream_runs enable row level security;
alter table huginn_eval_log enable row level security;

drop policy if exists munin_org_isolation on munin_memory;
create policy munin_org_isolation on munin_memory
  using (org_id = current_request_org_id())
  with check (org_id = current_request_org_id());

drop policy if exists munin_opinions_org_isolation on munin_opinions;
create policy munin_opinions_org_isolation on munin_opinions
  using (org_id = current_request_org_id())
  with check (org_id = current_request_org_id());

drop policy if exists munin_dream_runs_org_isolation on munin_dream_runs;
create policy munin_dream_runs_org_isolation on munin_dream_runs
  using (org_id = current_request_org_id())
  with check (org_id = current_request_org_id());

drop policy if exists huginn_eval_log_org_isolation on huginn_eval_log;
create policy huginn_eval_log_org_isolation on huginn_eval_log
  using (org_id = current_request_org_id())
  with check (org_id = current_request_org_id());

grant select on munin_opinions, munin_dream_runs, huginn_eval_log to authenticated;
grant all privileges on munin_memory, munin_opinions, munin_dream_runs, huginn_eval_log to service_role;

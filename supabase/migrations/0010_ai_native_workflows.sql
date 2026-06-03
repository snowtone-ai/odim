-- Migration 0010: AI-native Evidence Graph consumers and Watchtower workflows

create table if not exists watchtower_runs (
  id uuid primary key,
  org_id uuid null references orgs(id),
  playbook_id text not null,
  playbook_name text not null,
  alert_id uuid null references alerts(id),
  alert_title text null,
  status text not null check (status in ('queued', 'running', 'waiting_approval', 'succeeded', 'rejected', 'failed')),
  thesis text not null,
  confidence float not null default 0.5 check (confidence >= 0 and confidence <= 1),
  citation_coverage float not null default 0 check (citation_coverage >= 0 and citation_coverage <= 1),
  trace_completeness float not null default 0 check (trace_completeness >= 0 and trace_completeness <= 1),
  risk_flags text[] not null default '{}',
  graph_path_ids text[] not null default '{}',
  cost_estimate_tokens integer not null default 0 check (cost_estimate_tokens >= 0),
  source_refs jsonb not null default '[]',
  revision integer not null default 1 check (revision >= 1),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

create table if not exists watchtower_run_steps (
  id uuid primary key,
  run_id uuid not null references watchtower_runs(id) on delete cascade,
  step_key text not null check (step_key in ('scope', 'retrieve_graph', 'contradiction_check', 'approval_gate', 'dispatch_report')),
  label text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'waiting_approval', 'blocked', 'failed')),
  summary text not null,
  confidence float not null default 0.5 check (confidence >= 0 and confidence <= 1),
  source_refs jsonb not null default '[]',
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);

create table if not exists watchtower_approvals (
  id uuid primary key,
  run_id uuid not null references watchtower_runs(id) on delete cascade,
  action text not null check (action in ('send_slack_report', 'queue_push_digest', 'create_board_brief', 'open_api_webhook')),
  label text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  requested_by text not null,
  decided_by text null,
  decision_note text null,
  source_refs jsonb not null default '[]',
  created_at timestamptz not null default now(),
  decided_at timestamptz null
);

create index if not exists watchtower_runs_org_id_idx on watchtower_runs (org_id);
create index if not exists watchtower_runs_status_idx on watchtower_runs (status);
create index if not exists watchtower_runs_updated_at_idx on watchtower_runs (updated_at desc);
create index if not exists watchtower_runs_playbook_idx on watchtower_runs (playbook_id, revision desc);
create index if not exists watchtower_run_steps_run_id_idx on watchtower_run_steps (run_id);
create index if not exists watchtower_approvals_run_id_idx on watchtower_approvals (run_id);
create index if not exists watchtower_approvals_status_idx on watchtower_approvals (status);

grant select on watchtower_runs, watchtower_run_steps, watchtower_approvals to authenticated;
grant all privileges on watchtower_runs, watchtower_run_steps, watchtower_approvals to service_role;

alter table watchtower_runs enable row level security;
drop policy if exists watchtower_runs_public_or_org on watchtower_runs;
create policy watchtower_runs_public_or_org on watchtower_runs
  using (
    org_id is null
    or org_id = current_request_org_id()
  )
  with check (
    org_id is null
    or org_id = current_request_org_id()
  );

alter table watchtower_run_steps enable row level security;
drop policy if exists watchtower_run_steps_run_scope on watchtower_run_steps;
create policy watchtower_run_steps_run_scope on watchtower_run_steps
  using (
    exists (
      select 1
      from watchtower_runs
      where watchtower_runs.id = watchtower_run_steps.run_id
        and (
          watchtower_runs.org_id is null
          or watchtower_runs.org_id = current_request_org_id()
        )
    )
  )
  with check (
    exists (
      select 1
      from watchtower_runs
      where watchtower_runs.id = watchtower_run_steps.run_id
        and (
          watchtower_runs.org_id is null
          or watchtower_runs.org_id = current_request_org_id()
        )
    )
  );

alter table watchtower_approvals enable row level security;
drop policy if exists watchtower_approvals_run_scope on watchtower_approvals;
create policy watchtower_approvals_run_scope on watchtower_approvals
  using (
    exists (
      select 1
      from watchtower_runs
      where watchtower_runs.id = watchtower_approvals.run_id
        and (
          watchtower_runs.org_id is null
          or watchtower_runs.org_id = current_request_org_id()
        )
    )
  )
  with check (
    exists (
      select 1
      from watchtower_runs
      where watchtower_runs.id = watchtower_approvals.run_id
        and (
          watchtower_runs.org_id is null
          or watchtower_runs.org_id = current_request_org_id()
        )
    )
  );

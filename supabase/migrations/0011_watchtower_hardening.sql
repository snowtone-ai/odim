-- Migration 0011: Watchtower production hardening

begin;

create index if not exists watchtower_runs_alert_id_idx on watchtower_runs (alert_id);

create or replace function set_watchtower_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists watchtower_runs_set_updated_at on watchtower_runs;
create trigger watchtower_runs_set_updated_at
  before update on watchtower_runs
  for each row
  execute function set_watchtower_updated_at();

drop policy if exists watchtower_runs_public_or_org on watchtower_runs;
drop policy if exists watchtower_runs_org_scope on watchtower_runs;
create policy watchtower_runs_org_scope on watchtower_runs
  using (
    org_id = current_request_org_id()
  )
  with check (
    org_id = current_request_org_id()
  );

drop policy if exists watchtower_run_steps_run_scope on watchtower_run_steps;
create policy watchtower_run_steps_run_scope on watchtower_run_steps
  using (
    exists (
      select 1
      from watchtower_runs
      where watchtower_runs.id = watchtower_run_steps.run_id
        and watchtower_runs.org_id = current_request_org_id()
    )
  )
  with check (
    exists (
      select 1
      from watchtower_runs
      where watchtower_runs.id = watchtower_run_steps.run_id
        and watchtower_runs.org_id = current_request_org_id()
    )
  );

drop policy if exists watchtower_approvals_run_scope on watchtower_approvals;
create policy watchtower_approvals_run_scope on watchtower_approvals
  using (
    exists (
      select 1
      from watchtower_runs
      where watchtower_runs.id = watchtower_approvals.run_id
        and watchtower_runs.org_id = current_request_org_id()
    )
  )
  with check (
    exists (
      select 1
      from watchtower_runs
      where watchtower_runs.id = watchtower_approvals.run_id
        and watchtower_runs.org_id = current_request_org_id()
    )
  );

commit;

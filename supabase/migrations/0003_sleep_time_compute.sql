create table if not exists pre_computed_answers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  question_pattern text not null,
  answer text not null,
  evidence_snapshot jsonb,
  confidence float,
  computed_at timestamptz default now(),
  expires_at timestamptz,
  status text default 'active'
);

create index if not exists pre_computed_answers_org_pattern_status_idx on pre_computed_answers (org_id, question_pattern, status);

alter table pre_computed_answers enable row level security;

drop policy if exists pre_computed_answers_org_isolation on pre_computed_answers;
create policy pre_computed_answers_org_isolation on pre_computed_answers
  using (org_id = current_request_org_id())
  with check (org_id = current_request_org_id());

grant select on pre_computed_answers to authenticated;
grant all privileges on pre_computed_answers to service_role;

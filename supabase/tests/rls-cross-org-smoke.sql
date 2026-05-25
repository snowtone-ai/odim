-- Supabase staging-only RLS smoke test.
-- Run after applying supabase/migrations/0001_initial.sql.
-- Expected final row:
--   cross_org_raw_signals = 0
--   cross_org_alerts = 0
--   cross_org_api_keys = 0
--   cross_org_audit_log = 0
--   cross_org_munin_memory = 0
--   cross_org_munin_opinions = 0
--   cross_org_huginn_eval_log = 0

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
grant select on users, api_keys, alert_rules, raw_signals, ontology_objects, ontology_links, alerts, audit_log, munin_memory, munin_opinions, huginn_eval_log to authenticated;
grant usage on schema public to service_role;
grant all privileges on orgs, users, api_keys, alert_rules, raw_signals, ontology_objects, ontology_links, alerts, audit_log, munin_memory, munin_opinions, huginn_eval_log to service_role;

drop policy if exists munin_org_isolation on munin_memory;
create policy munin_org_isolation on munin_memory
  using (org_id = current_request_org_id())
  with check (org_id = current_request_org_id());

drop policy if exists munin_opinions_org_isolation on munin_opinions;
create policy munin_opinions_org_isolation on munin_opinions
  using (org_id = current_request_org_id())
  with check (org_id = current_request_org_id());

drop policy if exists huginn_eval_log_org_isolation on huginn_eval_log;
create policy huginn_eval_log_org_isolation on huginn_eval_log
  using (org_id = current_request_org_id())
  with check (org_id = current_request_org_id());

drop policy if exists users_org_isolation on users;
create policy users_org_isolation on users
  using (org_id = current_request_org_id());

drop policy if exists api_keys_org_isolation on api_keys;
create policy api_keys_org_isolation on api_keys
  using (org_id = current_request_org_id());

drop policy if exists alert_rules_public_or_org on alert_rules;
create policy alert_rules_public_or_org on alert_rules
  using (
    org_id is null
    or org_id = current_request_org_id()
  );

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

drop policy if exists ontology_public_or_org on ontology_objects;
create policy ontology_public_or_org on ontology_objects
  using (
    org_visible is null
    or org_visible = current_request_org_id()
  );

drop policy if exists ontology_links_public_or_org on ontology_links;
create policy ontology_links_public_or_org on ontology_links
  using (
    org_visible is null
    or org_visible = current_request_org_id()
  );

drop policy if exists alerts_public_or_org on alerts;
create policy alerts_public_or_org on alerts
  using (
    org_id is null
    or org_id = current_request_org_id()
  );

drop policy if exists audit_log_public_or_org on audit_log;
create policy audit_log_public_or_org on audit_log
  using (
    org_id is null
    or org_id = current_request_org_id()
  );

begin;

insert into orgs (id, name, tier)
values
  ('11111111-1111-4111-8111-111111111111', 'RLS Smoke Org A', 'enterprise'),
  ('22222222-2222-4222-8222-222222222222', 'RLS Smoke Org B', 'enterprise')
on conflict (id) do nothing;

insert into users (id, org_id, display_name, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'RLS Smoke User A', 'analyst'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'RLS Smoke User B', 'analyst')
on conflict (id) do nothing;

insert into api_keys (id, org_id, name, prefix, key_hash, scopes, created_by)
values (
  '77777777-7777-4777-8777-777777777777',
  '22222222-2222-4222-8222-222222222222',
  'RLS smoke API key for org B',
  'odim_live_rlssmoke',
  'rls-smoke-api-key-org-b',
  array['alerts:read'],
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
)
on conflict (id) do update
set org_id = excluded.org_id,
    created_by = excluded.created_by;

insert into raw_signals (
  id,
  layer,
  source,
  external_id,
  fingerprint,
  payload,
  source_refs,
  org_id,
  is_proprietary,
  observed_at
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    'energy',
    'rls-smoke',
    'raw-org-b',
    'rls-smoke-raw-org-b',
    jsonb_build_object('smoke', true),
    jsonb_build_array(jsonb_build_object('sourceId', 'rls-smoke', 'url', 'odim://rls-smoke', 'title', 'RLS smoke raw')),
    '22222222-2222-4222-8222-222222222222',
    true,
    now()
  )
on conflict (fingerprint) do update
set org_id = excluded.org_id,
    is_proprietary = excluded.is_proprietary;

insert into alerts (id, dedupe_key, priority, title, org_id, confidence, source_refs, created_at)
values (
  '44444444-4444-4444-8444-444444444444',
  'rls-smoke-alert-org-b',
  'high',
  'RLS smoke alert for org B',
  '22222222-2222-4222-8222-222222222222',
  0.9,
  jsonb_build_array(jsonb_build_object('sourceId', 'rls-smoke', 'url', 'odim://rls-smoke', 'title', 'RLS smoke alert')),
  now()
)
on conflict (dedupe_key) where dedupe_key is not null do update
set org_id = excluded.org_id;

insert into audit_log (id, dedupe_key, event_type, org_id, actor, detail, confidence, source_refs, created_at)
values (
  '55555555-5555-4555-8555-555555555555',
  'rls-smoke-audit-org-b',
  'rls_smoke',
  '22222222-2222-4222-8222-222222222222',
  'rls-smoke',
  jsonb_build_object('smoke', true),
  0.9,
  jsonb_build_array(jsonb_build_object('sourceId', 'rls-smoke', 'url', 'odim://rls-smoke', 'title', 'RLS smoke audit')),
  now()
)
on conflict (dedupe_key) where dedupe_key is not null do update
set org_id = excluded.org_id;

insert into munin_memory (id, org_id, user_id, agent_scope, content, source_refs)
values (
  '66666666-6666-4666-8666-666666666666',
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'huginn',
  'RLS smoke memory for org B',
  jsonb_build_array(jsonb_build_object('sourceId', 'rls-smoke', 'url', 'odim://rls-smoke', 'title', 'RLS smoke memory'))
)
on conflict (id) do update
set org_id = excluded.org_id,
    user_id = excluded.user_id;

insert into munin_opinions (id, org_id, user_id, source_type, content, is_seed)
values (
  '88888888-8888-4888-8888-888888888888',
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'huginn_inference',
  'RLS smoke opinion for org B',
  false
)
on conflict (id) do update
set org_id = excluded.org_id,
    user_id = excluded.user_id;

insert into huginn_eval_log (id, org_id, question, answer, plan, retrieval_layers_used, sources_count)
values (
  '99999999-9999-4999-8999-999999999999',
  '22222222-2222-4222-8222-222222222222',
  'RLS smoke question for org B',
  'RLS smoke answer for org B',
  jsonb_build_object('need_retrieval', true),
  array['munin_core'],
  1
)
on conflict (id) do update
set org_id = excluded.org_id;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select
  (select count(*) from raw_signals where id = '33333333-3333-4333-8333-333333333333') as cross_org_raw_signals,
  (select count(*) from alerts where id = '44444444-4444-4444-8444-444444444444') as cross_org_alerts,
  (select count(*) from api_keys where id = '77777777-7777-4777-8777-777777777777') as cross_org_api_keys,
  (select count(*) from audit_log where id = '55555555-5555-4555-8555-555555555555') as cross_org_audit_log,
  (select count(*) from munin_memory where id = '66666666-6666-4666-8666-666666666666') as cross_org_munin_memory,
  (select count(*) from munin_opinions where id = '88888888-8888-4888-8888-888888888888') as cross_org_munin_opinions,
  (select count(*) from huginn_eval_log where id = '99999999-9999-4999-8999-999999999999') as cross_org_huginn_eval_log;

rollback;

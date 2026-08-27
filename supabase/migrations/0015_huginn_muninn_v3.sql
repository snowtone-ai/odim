-- Muninn v3: temporal, reviewable, provenance-preserving memory.
-- This migration is additive. Existing v2 rows remain retrievable through the
-- legacy `not_required` review state until explicitly reviewed or retired.

begin;

alter table munin_memory add column if not exists provenance jsonb not null default '{}'::jsonb;
alter table munin_memory add column if not exists source_hash text;
alter table munin_memory add column if not exists observed_at timestamptz;
alter table munin_memory add column if not exists ingested_at timestamptz default now();
alter table munin_memory add column if not exists supersedes uuid[] not null default '{}';
alter table munin_memory add column if not exists parent_memory_ids uuid[] not null default '{}';
alter table munin_memory add column if not exists review_status text;

-- Rows that predate v3 are legacy-compatible. New rows use pending_review.
update munin_memory set review_status = 'not_required' where review_status is null;
alter table munin_memory alter column review_status set default 'pending_review';
alter table munin_memory alter column review_status set not null;

update munin_memory
set
  observed_at = coalesce(observed_at, created_at),
  ingested_at = coalesce(ingested_at, created_at),
  source_hash = coalesce(source_hash, md5(coalesce(source_refs::text, '[]') || ':' || coalesce(created_at::text, '')))
where observed_at is null or ingested_at is null or source_hash is null;

update munin_memory
set provenance = jsonb_build_object(
  'sourceHash', source_hash,
  'sourceRefs', coalesce(source_refs, '[]'::jsonb),
  'observedAt', observed_at,
  'ingestedAt', ingested_at,
  'supersedes', to_jsonb(supersedes),
  'parentMemoryIds', to_jsonb(parent_memory_ids),
  'origin', 'legacy_v2'
)
where provenance = '{}'::jsonb;

alter table munin_memory add column if not exists content_tsv tsvector
  generated always as (to_tsvector('simple'::regconfig, content)) stored;

alter table munin_opinions add column if not exists source_refs jsonb not null default '[]'::jsonb;
alter table munin_opinions add column if not exists provenance jsonb not null default '{}'::jsonb;
alter table munin_opinions add column if not exists source_hash text;
alter table munin_opinions add column if not exists observed_at timestamptz;
alter table munin_opinions add column if not exists ingested_at timestamptz default now();
alter table munin_opinions add column if not exists supersedes uuid[] not null default '{}';
alter table munin_opinions add column if not exists parent_memory_ids uuid[] not null default '{}';
alter table munin_opinions add column if not exists review_status text;
update munin_opinions set review_status = 'not_required' where review_status is null;
alter table munin_opinions alter column review_status set default 'pending_review';
alter table munin_opinions alter column review_status set not null;
alter table munin_opinions add column if not exists content_tsv tsvector
  generated always as (to_tsvector('simple'::regconfig, content)) stored;

update munin_opinions
set
  observed_at = coalesce(observed_at, created_at),
  ingested_at = coalesce(ingested_at, created_at),
  source_hash = coalesce(source_hash, md5(coalesce(source_refs::text, '[]') || ':' || coalesce(created_at::text, '')))
where observed_at is null or ingested_at is null or source_hash is null;

update munin_opinions
set provenance = jsonb_build_object(
  'sourceHash', source_hash,
  'sourceRefs', coalesce(source_refs, '[]'::jsonb),
  'observedAt', observed_at,
  'ingestedAt', ingested_at,
  'supersedes', to_jsonb(supersedes),
  'parentMemoryIds', to_jsonb(parent_memory_ids),
  'origin', 'legacy_v2'
)
where provenance = '{}'::jsonb;

alter table munin_dream_runs add column if not exists proposal_ids uuid[] not null default '{}';
alter table munin_dream_runs add column if not exists reviewed_at timestamptz;
alter table munin_dream_runs add column if not exists reviewed_by uuid references users(id);
alter table munin_dream_runs add column if not exists review_note text;

create table if not exists munin_memory_proposals (
  id uuid primary key,
  org_id uuid not null references orgs(id),
  user_id uuid references users(id),
  run_id uuid,
  content text not null,
  source_type text not null,
  memory_class text not null,
  agent_scope text not null,
  is_seed boolean not null default false,
  source_refs jsonb not null default '[]'::jsonb,
  salience_score float not null default 0,
  memory_status text not null default 'archived',
  review_status text not null default 'pending_review',
  status text not null default 'pending_review',
  source_hash text not null,
  observed_at timestamptz,
  ingested_at timestamptz not null default now(),
  supersedes uuid[] not null default '{}',
  parent_memory_ids uuid[] not null default '{}',
  provenance jsonb not null default '{}'::jsonb,
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text,
  created_at timestamptz not null default now()
);

-- Reviewer attribution may be an API-key owner or a local service actor, not
-- necessarily a row in users. Preserve it as an audit-safe immutable string.
alter table munin_memory_proposals drop constraint if exists munin_memory_proposals_reviewed_by_fkey;
alter table munin_memory_proposals alter column reviewed_by type text using reviewed_by::text;

alter table munin_memory_proposals add column if not exists content_tsv tsvector
  generated always as (to_tsvector('simple'::regconfig, content)) stored;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'munin_memory_review_status_check') then
    alter table munin_memory add constraint munin_memory_review_status_check
      check (review_status in ('not_required', 'pending_review', 'approved', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'munin_opinions_review_status_check') then
    alter table munin_opinions add constraint munin_opinions_review_status_check
      check (review_status in ('not_required', 'pending_review', 'approved', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'munin_memory_proposals_review_status_check') then
    alter table munin_memory_proposals add constraint munin_memory_proposals_review_status_check
      check (review_status in ('pending_review', 'approved', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'munin_memory_proposals_status_check') then
    alter table munin_memory_proposals add constraint munin_memory_proposals_status_check
      check (status in ('pending_review', 'approved', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'munin_memory_valid_window_check') then
    alter table munin_memory add constraint munin_memory_valid_window_check
      check (valid_to is null or valid_from < valid_to);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'munin_opinions_valid_window_check') then
    alter table munin_opinions add constraint munin_opinions_valid_window_check
      check (valid_to is null or valid_from < valid_to);
  end if;
end $$;

-- Keep cache rows internally coherent. Retrieval still applies the request's
-- as-of/evidence timestamp checks in the application and RPC reader.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pre_computed_answers_status_check') then
    alter table pre_computed_answers add constraint pre_computed_answers_status_check
      check (status in ('active', 'invalidated'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pre_computed_answers_confidence_check') then
    alter table pre_computed_answers add constraint pre_computed_answers_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pre_computed_answers_expiry_check') then
    alter table pre_computed_answers add constraint pre_computed_answers_expiry_check
      check (expires_at is null or computed_at is null or computed_at <= expires_at);
  end if;
end $$;

-- Proposal payloads are immutable after insert. Lifecycle/reviewer fields are
-- intentionally excluded so the CAS review transition can remain auditable.
create or replace function public.munin_memory_proposals_payload_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.id is distinct from OLD.id
    or NEW.org_id is distinct from OLD.org_id
    or NEW.user_id is distinct from OLD.user_id
    or NEW.run_id is distinct from OLD.run_id
    or NEW.content is distinct from OLD.content
    or NEW.source_type is distinct from OLD.source_type
    or NEW.memory_class is distinct from OLD.memory_class
    or NEW.agent_scope is distinct from OLD.agent_scope
    or NEW.is_seed is distinct from OLD.is_seed
    or NEW.source_refs is distinct from OLD.source_refs
    or NEW.salience_score is distinct from OLD.salience_score
    or NEW.memory_status is distinct from OLD.memory_status
    or NEW.source_hash is distinct from OLD.source_hash
    or NEW.observed_at is distinct from OLD.observed_at
    or NEW.ingested_at is distinct from OLD.ingested_at
    or NEW.supersedes is distinct from OLD.supersedes
    or NEW.parent_memory_ids is distinct from OLD.parent_memory_ids
    or NEW.provenance is distinct from OLD.provenance
    or NEW.created_at is distinct from OLD.created_at then
    raise exception 'Muninn proposal payload is immutable';
  end if;
  return NEW;
end;
$$;

drop trigger if exists munin_memory_proposals_payload_immutable_trigger on munin_memory_proposals;
create trigger munin_memory_proposals_payload_immutable_trigger
before update on munin_memory_proposals
for each row execute function public.munin_memory_proposals_payload_immutable();

-- The review RPC makes proposal CAS, approved-record insertion, and lifecycle
-- update one transaction. This closes the active-row-before-review window.
create or replace function public.munin_review_memory_proposal(
  p_org_id uuid,
  p_proposal_id uuid,
  p_decision text,
  p_reviewer_id text default null,
  p_review_note text default null,
  p_reviewed_at timestamptz default now(),
  p_record jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal_row munin_memory_proposals%rowtype;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'Invalid Muninn proposal decision' using errcode = '22023';
  end if;

  select * into proposal_row
  from munin_memory_proposals
  where id = p_proposal_id and org_id = p_org_id
  for update;

  if not found then
    raise exception 'Muninn proposal not found' using errcode = 'P0002';
  end if;
  if proposal_row.review_status <> 'pending_review' then
    raise exception 'Muninn proposal is no longer pending review' using errcode = 'P0001';
  end if;

  if p_decision = 'approve' then
    if p_record is null or jsonb_typeof(p_record) <> 'object' then
      raise exception 'Approved Muninn record is required' using errcode = '22023';
    end if;

    if proposal_row.memory_class = 'opinion' then
      insert into munin_opinions (
        id, org_id, user_id, source_type, content, source_refs, is_seed,
        valid_from, valid_to, created_at, provenance, source_hash, observed_at,
        ingested_at, supersedes, parent_memory_ids, review_status
      ) values (
        nullif(p_record->>'id', '')::uuid,
        p_org_id,
        proposal_row.user_id,
        proposal_row.source_type,
        proposal_row.content,
        proposal_row.source_refs,
        proposal_row.is_seed,
        (p_record->>'valid_from')::timestamptz,
        nullif(p_record->>'valid_to', '')::timestamptz,
        proposal_row.created_at,
        jsonb_set(coalesce(proposal_row.provenance, '{}'::jsonb), '{origin}', '"approved_munin_proposal"'::jsonb, true),
        proposal_row.source_hash,
        proposal_row.observed_at,
        proposal_row.ingested_at,
        proposal_row.supersedes,
        proposal_row.parent_memory_ids,
        'approved'
      );
    else
      insert into munin_memory (
        id, org_id, user_id, memory_class, agent_scope, source_type, content,
        source_refs, salience_score, importance, decay_score, is_seed, status,
        linked_memory_ids, valid_from, valid_to, created_at, last_accessed_at,
        provenance, source_hash, observed_at, ingested_at, supersedes,
        parent_memory_ids, review_status
      ) values (
        nullif(p_record->>'id', '')::uuid,
        p_org_id,
        proposal_row.user_id,
        proposal_row.memory_class,
        proposal_row.agent_scope,
        proposal_row.source_type,
        proposal_row.content,
        proposal_row.source_refs,
        proposal_row.salience_score,
        0.8,
        1,
        proposal_row.is_seed,
        proposal_row.memory_status,
        proposal_row.parent_memory_ids,
        (p_record->>'valid_from')::timestamptz,
        nullif(p_record->>'valid_to', '')::timestamptz,
        proposal_row.created_at,
        coalesce((p_record->>'last_accessed_at')::timestamptz, proposal_row.created_at),
        jsonb_set(coalesce(proposal_row.provenance, '{}'::jsonb), '{origin}', '"approved_munin_proposal"'::jsonb, true),
        proposal_row.source_hash,
        proposal_row.observed_at,
        proposal_row.ingested_at,
        proposal_row.supersedes,
        proposal_row.parent_memory_ids,
        'approved'
      );
    end if;
  end if;

  update munin_memory_proposals
  set review_status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
      status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
      rejection_reason = case when p_decision = 'reject' then p_review_note else null end,
      reviewed_at = coalesce(p_reviewed_at, now()),
      reviewed_by = p_reviewer_id,
      review_note = p_review_note
  where id = p_proposal_id and org_id = p_org_id;

  return jsonb_build_object('applied', p_decision = 'approve');
end;
$$;

-- Seed edits are append-only MVCC versions. Lock the current row and perform
-- the replacement insert plus old-window close in one transaction so a
-- failed insert cannot leave an active seed with no successor (or two active
-- versions). The RPC is intentionally service-role-only, like proposal
-- review, because the application has already established the org scope.
create or replace function public.munin_supersede_seed(
  p_org_id uuid,
  p_old_id uuid,
  p_kind text,
  p_valid_to timestamptz,
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  old_memory munin_memory%rowtype;
  old_opinion munin_opinions%rowtype;
  replacement_id uuid;
  replacement_valid_from timestamptz;
begin
  if p_kind not in ('memory', 'opinion') or p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'Invalid Muninn seed replacement' using errcode = '22023';
  end if;
  replacement_id := nullif(p_record->>'id', '')::uuid;
  replacement_valid_from := (p_record->>'valid_from')::timestamptz;
  if replacement_id is null or replacement_valid_from is null or replacement_valid_from <> p_valid_to then
    raise exception 'Seed replacement timestamp or id is invalid' using errcode = '22023';
  end if;
  if not coalesce(p_record->'supersedes', '[]'::jsonb) @> to_jsonb(array[p_old_id]::uuid[]) then
    raise exception 'Seed replacement must supersede the current version' using errcode = '22023';
  end if;

  if p_kind = 'opinion' then
    select * into old_opinion
    from munin_opinions
    where id = p_old_id and org_id = p_org_id and is_seed = true
    for update;
    if not found or old_opinion.valid_to is not null then
      -- A retry after a committed transaction is safe if it names the same
      -- replacement; all other callers observe a compare-and-swap failure.
      if exists (select 1 from munin_opinions where id = replacement_id and org_id = p_org_id and valid_from = p_valid_to)
        and exists (select 1 from munin_opinions where id = p_old_id and org_id = p_org_id and valid_to = p_valid_to) then
        return jsonb_build_object('applied', true, 'id', replacement_id);
      end if;
      raise exception 'Seed memory is no longer current' using errcode = 'P0001';
    end if;
    if p_valid_to <= old_opinion.valid_from then
      raise exception 'Seed replacement must start after the current version' using errcode = '22023';
    end if;
    insert into munin_opinions (
      id, org_id, user_id, source_type, content, source_refs, is_seed,
      valid_from, valid_to, created_at, provenance, source_hash, observed_at,
      ingested_at, supersedes, parent_memory_ids, review_status
    ) values (
      replacement_id, p_org_id, old_opinion.user_id, 'user_seed',
      p_record->>'content', coalesce(p_record->'source_refs', '[]'::jsonb), true,
      p_valid_to, null, coalesce((p_record->>'created_at')::timestamptz, p_valid_to),
      coalesce(p_record->'provenance', '{}'::jsonb), nullif(p_record->>'source_hash', ''),
      nullif(p_record->>'observed_at', '')::timestamptz,
      coalesce((p_record->>'ingested_at')::timestamptz, p_valid_to),
      coalesce((select array_agg(elem.value::uuid) from jsonb_array_elements_text(coalesce(p_record->'supersedes', '[]'::jsonb)) as elem(value)), '{}'),
      coalesce((select array_agg(elem.value::uuid) from jsonb_array_elements_text(coalesce(p_record->'parent_memory_ids', '[]'::jsonb)) as elem(value)), '{}'),
      'approved'
    );
    update munin_opinions set valid_to = p_valid_to
    where id = p_old_id and org_id = p_org_id and valid_to is null;
  else
    select * into old_memory
    from munin_memory
    where id = p_old_id and org_id = p_org_id and is_seed = true
    for update;
    if not found or old_memory.valid_to is not null then
      if exists (select 1 from munin_memory where id = replacement_id and org_id = p_org_id and valid_from = p_valid_to)
        and exists (select 1 from munin_memory where id = p_old_id and org_id = p_org_id and valid_to = p_valid_to) then
        return jsonb_build_object('applied', true, 'id', replacement_id);
      end if;
      raise exception 'Seed memory is no longer current' using errcode = 'P0001';
    end if;
    if p_valid_to <= old_memory.valid_from then
      raise exception 'Seed replacement must start after the current version' using errcode = '22023';
    end if;
    insert into munin_memory (
      id, org_id, user_id, memory_class, agent_scope, source_type, content,
      source_refs, salience_score, importance, decay_score, is_seed, status,
      linked_memory_ids, valid_from, valid_to, created_at, last_accessed_at,
      provenance, source_hash, observed_at, ingested_at, supersedes,
      parent_memory_ids, review_status
    ) values (
      replacement_id, p_org_id, old_memory.user_id, 'seed', 'core', 'user_seed',
      p_record->>'content', coalesce(p_record->'source_refs', '[]'::jsonb), 1, 1, 1, true, 'active',
      coalesce((select array_agg(elem.value::uuid) from jsonb_array_elements_text(coalesce(p_record->'linked_memory_ids', '[]'::jsonb)) as elem(value)), '{}'),
      p_valid_to, null, coalesce((p_record->>'created_at')::timestamptz, p_valid_to),
      coalesce((p_record->>'last_accessed_at')::timestamptz, p_valid_to),
      coalesce(p_record->'provenance', '{}'::jsonb), nullif(p_record->>'source_hash', ''),
      nullif(p_record->>'observed_at', '')::timestamptz,
      coalesce((p_record->>'ingested_at')::timestamptz, p_valid_to),
      coalesce((select array_agg(elem.value::uuid) from jsonb_array_elements_text(coalesce(p_record->'supersedes', '[]'::jsonb)) as elem(value)), '{}'),
      coalesce((select array_agg(elem.value::uuid) from jsonb_array_elements_text(coalesce(p_record->'parent_memory_ids', '[]'::jsonb)) as elem(value)), '{}'),
      'approved'
    );
    update munin_memory set valid_to = p_valid_to
    where id = p_old_id and org_id = p_org_id and is_seed = true and valid_to is null;
  end if;
  return jsonb_build_object('applied', true, 'id', replacement_id);
end;
$$;

revoke execute on function public.munin_supersede_seed(uuid, uuid, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.munin_supersede_seed(uuid, uuid, text, timestamptz, jsonb) to service_role;

-- A lease-backed lock prevents the same org's Dream from running concurrently
-- across workers/instances. The in-process lock remains a fast-path guard.
create table if not exists munin_dream_locks (
  org_id uuid primary key references orgs(id),
  run_id uuid not null,
  lease_until timestamptz not null,
  created_at timestamptz not null default now()
);

alter table munin_dream_locks enable row level security;
drop policy if exists munin_dream_locks_org_isolation on munin_dream_locks;
create policy munin_dream_locks_org_isolation on munin_dream_locks
  using (org_id = current_request_org_id())
  with check (org_id = current_request_org_id());

create or replace function public.munin_try_acquire_dream_lock(
  p_org_id uuid,
  p_run_id uuid,
  p_now timestamptz default now(),
  p_lease_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  acquired boolean;
begin
  if p_lease_seconds <= 0 then
    raise exception 'Dream lock lease must be positive' using errcode = '22023';
  end if;
  insert into munin_dream_locks (org_id, run_id, lease_until)
  values (p_org_id, p_run_id, p_now + make_interval(secs => p_lease_seconds))
  on conflict (org_id) do update
    set run_id = excluded.run_id,
        lease_until = excluded.lease_until
    where munin_dream_locks.lease_until <= p_now
  returning true into acquired;
  return coalesce(acquired, false);
end;
$$;

create or replace function public.munin_release_dream_lock(p_org_id uuid, p_run_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  released boolean;
begin
  delete from munin_dream_locks
  where org_id = p_org_id and run_id = p_run_id
  returning true into released;
  return coalesce(released, false);
end;
$$;

create index if not exists munin_memory_v3_temporal_idx
  on munin_memory (org_id, review_status, status, valid_from, valid_to);
create index if not exists munin_memory_v3_source_hash_idx
  on munin_memory (org_id, source_hash);
create index if not exists munin_memory_content_tsv_v3_idx
  on munin_memory using gin (content_tsv);
create index if not exists munin_opinions_content_tsv_v3_idx
  on munin_opinions using gin (content_tsv);
create index if not exists munin_memory_proposals_content_tsv_v3_idx
  on munin_memory_proposals using gin (content_tsv);
create index if not exists munin_memory_proposals_org_status_v3_idx
  on munin_memory_proposals (org_id, review_status, created_at desc);
create index if not exists munin_memory_proposals_run_v3_idx
  on munin_memory_proposals (org_id, run_id);

-- HNSW is deliberately partial: only active, non-pending rows participate.
create index if not exists munin_memory_embedding_hnsw_v3_idx
  on munin_memory using hnsw (embedding vector_cosine_ops)
  where status = 'active' and review_status in ('approved', 'not_required') and valid_to is null;
create index if not exists munin_opinions_embedding_hnsw_v3_idx
  on munin_opinions using hnsw (embedding vector_cosine_ops)
  where review_status in ('approved', 'not_required') and valid_to is null;

create or replace function public.munin_hybrid_search(
  p_org_id uuid,
  p_query text,
  p_query_embedding vector(768) default null,
  p_match_count integer default 20,
  p_now timestamptz default now()
)
returns table (
  id uuid,
  org_id uuid,
  content text,
  source_refs jsonb,
  observed_at timestamptz,
  lexical_rank real,
  semantic_rank real,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  with candidates as (
    select
      m.id,
      m.org_id,
      m.content,
      m.source_refs,
      m.observed_at,
      ts_rank_cd(m.content_tsv, plainto_tsquery('simple'::regconfig, coalesce(p_query, '')))::real as lexical_score,
      case
        when p_query_embedding is null or m.embedding is null then null::real
        else (1 - (m.embedding <=> p_query_embedding))::real
      end as semantic_score
    from munin_memory m
    where m.org_id = p_org_id
      and m.status = 'active'
      and m.review_status in ('approved', 'not_required')
      and m.valid_from <= p_now
      and m.observed_at <= p_now
      and (m.valid_to is null or p_now < m.valid_to)
  ),
  lexical_ranked as (
    select
      c.*,
      row_number() over (order by c.lexical_score desc, c.id) as lexical_rank
    from candidates c
    where c.lexical_score > 0
  ),
  semantic_ranked as (
    select
      c.*,
      row_number() over (order by c.semantic_score desc, c.id) as semantic_rank
    from candidates c
    where c.semantic_score is not null
  ),
  fused as (
    select
      coalesce(l.id, s.id) as id,
      coalesce(l.org_id, s.org_id) as org_id,
      coalesce(l.content, s.content) as content,
      coalesce(l.source_refs, s.source_refs) as source_refs,
      coalesce(l.observed_at, s.observed_at) as observed_at,
      l.lexical_rank,
      s.semantic_rank,
      case when l.id is null then 0.0 else 1.0 / (60.0 + l.lexical_rank) end as lexical_rrf,
      case when s.id is null then 0.0 else 1.0 / (60.0 + s.semantic_rank) end as semantic_rrf
    from lexical_ranked l
    full outer join semantic_ranked s on s.id = l.id
  )
  select
    fused.id,
    fused.org_id,
    fused.content,
    fused.source_refs,
    fused.observed_at,
    fused.lexical_rank::real,
    fused.semantic_rank::real,
    (fused.lexical_rrf + fused.semantic_rrf)::real as rank
  from fused
  where fused.lexical_rank is not null or fused.semantic_rank is not null
  order by (fused.lexical_rrf + fused.semantic_rrf) desc, fused.id
  limit greatest(1, least(coalesce(p_match_count, 20), 100));
$$;

alter table munin_memory_proposals enable row level security;
drop policy if exists munin_memory_proposals_org_isolation on munin_memory_proposals;
create policy munin_memory_proposals_org_isolation on munin_memory_proposals
  using (org_id = current_request_org_id())
  with check (org_id = current_request_org_id());

grant select on munin_memory_proposals to authenticated;
grant all privileges on munin_memory_proposals to service_role;
grant select on munin_dream_locks to authenticated;
grant all privileges on munin_dream_locks to service_role;
revoke execute on function public.munin_review_memory_proposal(uuid, uuid, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.munin_review_memory_proposal(uuid, uuid, text, text, text, timestamptz, jsonb) to service_role;
revoke execute on function public.munin_try_acquire_dream_lock(uuid, uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.munin_try_acquire_dream_lock(uuid, uuid, timestamptz, integer) to service_role;
revoke execute on function public.munin_release_dream_lock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.munin_release_dream_lock(uuid, uuid) to service_role;
grant execute on function public.munin_hybrid_search(uuid, text, vector, integer, timestamptz) to authenticated, service_role;

commit;

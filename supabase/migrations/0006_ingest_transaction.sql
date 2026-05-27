create or replace function ingest_batch(
  p_signals jsonb,
  p_objects jsonb,
  p_links jsonb,
  p_alerts jsonb,
  p_audit jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signal_count integer := coalesce(jsonb_array_length(p_signals), 0);
  v_object_count integer := coalesce(jsonb_array_length(p_objects), 0);
  v_link_count integer := coalesce(jsonb_array_length(p_links), 0);
  v_alert_count integer := coalesce(jsonb_array_length(p_alerts), 0);
  v_audit_count integer := coalesce(jsonb_array_length(p_audit), 0);
begin
  insert into raw_signals (
    id, layer, source, payload, freshness, is_proprietary, observed_at, fingerprint, external_id, org_id, source_refs
  )
  select id, layer, source, payload, freshness, is_proprietary, observed_at, fingerprint, external_id, org_id, source_refs
  from jsonb_to_recordset(coalesce(p_signals, '[]'::jsonb)) as r(
    id uuid,
    layer text,
    source text,
    payload jsonb,
    freshness float,
    is_proprietary boolean,
    observed_at timestamptz,
    fingerprint text,
    external_id text,
    org_id uuid,
    source_refs jsonb
  )
  on conflict (fingerprint) do update set
    layer = excluded.layer,
    source = excluded.source,
    payload = excluded.payload,
    freshness = excluded.freshness,
    is_proprietary = excluded.is_proprietary,
    observed_at = excluded.observed_at,
    external_id = excluded.external_id,
    org_id = excluded.org_id,
    source_refs = excluded.source_refs;

  insert into ontology_objects (id, object_type, attributes, org_visible, source_refs)
  select id, object_type, attributes, org_visible, source_refs
  from jsonb_to_recordset(coalesce(p_objects, '[]'::jsonb)) as r(
    id uuid,
    object_type text,
    attributes jsonb,
    org_visible uuid,
    source_refs jsonb
  )
  on conflict (id) do update set
    object_type = excluded.object_type,
    attributes = excluded.attributes,
    org_visible = excluded.org_visible,
    source_refs = excluded.source_refs,
    updated_at = now();

  insert into ontology_links (id, from_object_id, to_object_id, link_type, confidence, org_visible, source_refs)
  select id, from_object_id, to_object_id, link_type, confidence, org_visible, source_refs
  from jsonb_to_recordset(coalesce(p_links, '[]'::jsonb)) as r(
    id uuid,
    from_object_id uuid,
    to_object_id uuid,
    link_type text,
    confidence float,
    org_visible uuid,
    source_refs jsonb
  )
  on conflict (id) do update set
    from_object_id = excluded.from_object_id,
    to_object_id = excluded.to_object_id,
    link_type = excluded.link_type,
    confidence = excluded.confidence,
    org_visible = excluded.org_visible,
    source_refs = excluded.source_refs;

  insert into alerts (
    id, dedupe_key, priority, title, description, related_object_id, evidence, org_id, confidence, source_refs, created_at
  )
  select id, dedupe_key, priority, title, description, related_object_id, evidence, org_id, confidence, source_refs, created_at
  from jsonb_to_recordset(coalesce(p_alerts, '[]'::jsonb)) as r(
    id uuid,
    dedupe_key text,
    priority text,
    title text,
    description text,
    related_object_id uuid,
    evidence jsonb,
    org_id uuid,
    confidence float,
    source_refs jsonb,
    created_at timestamptz
  )
  on conflict (dedupe_key) do update set
    priority = excluded.priority,
    title = excluded.title,
    description = excluded.description,
    related_object_id = excluded.related_object_id,
    evidence = excluded.evidence,
    org_id = excluded.org_id,
    confidence = excluded.confidence,
    source_refs = excluded.source_refs;

  insert into audit_log (
    id, dedupe_key, event_type, object_id, org_id, actor, detail, confidence, source_refs, created_at
  )
  select id, dedupe_key, event_type, object_id, org_id, actor, detail, confidence, source_refs, created_at
  from jsonb_to_recordset(coalesce(p_audit, '[]'::jsonb)) as r(
    id uuid,
    dedupe_key text,
    event_type text,
    object_id uuid,
    org_id uuid,
    actor text,
    detail jsonb,
    confidence float,
    source_refs jsonb,
    created_at timestamptz
  )
  on conflict (dedupe_key) do update set
    event_type = excluded.event_type,
    object_id = excluded.object_id,
    org_id = excluded.org_id,
    actor = excluded.actor,
    detail = excluded.detail,
    confidence = excluded.confidence,
    source_refs = excluded.source_refs;

  return jsonb_build_object(
    'raw_signals', v_signal_count,
    'ontology_objects', v_object_count,
    'ontology_links', v_link_count,
    'alerts', v_alert_count,
    'audit_log', v_audit_count
  );
end;
$$;

grant execute on function ingest_batch(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

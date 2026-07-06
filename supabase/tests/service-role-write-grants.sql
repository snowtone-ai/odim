grant usage on schema public to service_role;
grant all privileges on
  orgs,
  users,
  api_keys,
  alert_rules,
  raw_signals,
  ontology_objects,
  ontology_links,
  alerts,
  audit_log,
  munin_memory,
  org_billing,
  billing_events,
  org_invites
to service_role;

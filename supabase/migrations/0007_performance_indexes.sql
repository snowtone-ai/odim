create index if not exists munin_memory_embedding_idx
  on munin_memory using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists alerts_org_id_idx on alerts(org_id);
create index if not exists audit_log_org_id_idx on audit_log(org_id);
create index if not exists raw_signals_layer_observed_idx on raw_signals(layer, observed_at desc);
create index if not exists ingestion_runs_started_idx on ingestion_runs(started_at desc);

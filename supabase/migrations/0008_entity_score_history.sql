-- Migration 0008: entity_score_history
-- Records daily entity score snapshots for sparkline trends.

CREATE TABLE IF NOT EXISTS entity_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text NOT NULL,
  score numeric NOT NULL,
  confidence numeric NOT NULL,
  signal_count integer NOT NULL DEFAULT 0,
  narrative_gap numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_score_history_lookup
  ON entity_score_history (entity_id, recorded_at DESC);

ALTER TABLE entity_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_score_history_read"
  ON entity_score_history FOR SELECT USING (true);

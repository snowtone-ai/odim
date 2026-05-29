import type { SupabaseClient } from "@supabase/supabase-js";
import type { OntologyObjectDraft } from "./types.ts";

/**
 * Records a score snapshot row per entity after ingestion completes.
 * Inserts one row per decision_maker object with current score, confidence,
 * and signal count. Uses INSERT (not upsert) so each run accumulates history.
 */
export async function recordEntityScoreSnapshots(
  client: SupabaseClient,
  ontologyObjects: OntologyObjectDraft[]
): Promise<void> {
  const decisionMakers = ontologyObjects.filter(
    (obj) => obj.objectType === "decision_maker"
  );

  if (decisionMakers.length === 0) return;

  const rows = decisionMakers.map((obj) => ({
    entity_id: obj.id,
    score: Number(obj.attributes.reality_score ?? 0),
    confidence: Number(obj.attributes.confidence ?? 0),
    signal_count: Number(obj.attributes.signal_count ?? 0),
    narrative_gap: obj.attributes.narrative_gap != null
      ? Number(obj.attributes.narrative_gap)
      : null,
    recorded_at: new Date().toISOString()
  }));

  const { error } = await client
    .from("entity_score_history")
    .insert(rows);

  if (error) {
    console.warn(`score snapshot insert warning: ${error.message}`);
  } else {
    console.log(
      JSON.stringify({ event: "score_snapshots_recorded", count: rows.length })
    );
  }
}

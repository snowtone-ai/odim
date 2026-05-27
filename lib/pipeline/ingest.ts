import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestionPlan } from "./types.ts";

export function toDatabaseRows(plan: IngestionPlan) {
  return {
    rawSignals: plan.rawSignals.map((signal) => ({
      id: signal.id,
      layer: signal.layer,
      source: signal.source,
      payload: signal.payload,
      freshness: signal.freshness,
      is_proprietary: signal.isProprietary,
      observed_at: signal.observedAt,
      fingerprint: signal.fingerprint,
      external_id: signal.externalId,
      org_id: signal.orgId ?? null,
      source_refs: signal.sourceRefs
    })),
    ontologyObjects: plan.ontologyObjects.map((object) => ({
      id: object.id,
      object_type: object.objectType,
      attributes: object.attributes,
      org_visible: object.orgVisible,
      source_refs: object.sourceRefs
    })),
    ontologyLinks: plan.ontologyLinks.map((link) => ({
      id: link.id,
      from_object_id: link.fromObjectId,
      to_object_id: link.toObjectId,
      link_type: link.linkType,
      confidence: link.confidence,
      org_visible: link.orgVisible,
      source_refs: link.sourceRefs
    })),
    alerts: plan.alerts.map((alert) => ({
      id: alert.id,
      dedupe_key: alert.dedupeKey,
      priority: alert.priority,
      title: alert.title,
      description: alert.description,
      related_object_id: alert.relatedObjectId ?? null,
      evidence: alert.evidence,
      org_id: alert.orgId,
      confidence: alert.confidence,
      source_refs: alert.evidence,
      created_at: alert.createdAt
    })),
    auditEvents: plan.auditEvents.map((event) => ({
      id: event.id,
      event_type: event.eventType,
      object_id: event.objectId ?? null,
      org_id: event.orgId,
      actor: event.actor,
      detail: event.detail,
      confidence: event.confidence,
      source_refs: event.sourceRefs,
      dedupe_key: event.dedupeKey,
      created_at: event.createdAt
    }))
  };
}

export async function upsertIngestionPlan(client: SupabaseClient, plan: IngestionPlan) {
  const rows = toDatabaseRows(plan);
  const rpcClient = client as SupabaseClient & {
    rpc?: (functionName: string, args: Record<string, unknown>) => Promise<{ error: { message: string; code?: string } | null }>;
  };
  if (typeof rpcClient.rpc === "function") {
    const { error } = await rpcClient.rpc("ingest_batch", {
      p_signals: rows.rawSignals,
      p_objects: rows.ontologyObjects,
      p_links: rows.ontologyLinks,
      p_alerts: rows.alerts,
      p_audit: rows.auditEvents
    });
    if (!error) return;
    if (!isMissingIngestBatchRpc(error)) throw new Error(`ingest_batch RPC failed: ${error.message}`);
    console.warn("ingest_batch RPC unavailable; falling back to sequential upserts", { error: error.message });
  }

  const operations: Array<[string, Array<Record<string, unknown>>]> = [
    ["raw_signals", rows.rawSignals],
    ["ontology_objects", rows.ontologyObjects],
    ["ontology_links", rows.ontologyLinks],
    ["alerts", rows.alerts],
    ["audit_log", rows.auditEvents]
  ];
  const conflictTargets: Record<string, string> = {
    alerts: "dedupe_key",
    audit_log: "dedupe_key",
    ontology_links: "id",
    ontology_objects: "id",
    raw_signals: "fingerprint"
  };

  for (const [table, tableRows] of operations) {
    if (!tableRows.length) continue;
    const { error } = await client.from(table).upsert(tableRows, { onConflict: conflictTargets[table] ?? "id" });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

function isMissingIngestBatchRpc(error: { message: string; code?: string }) {
  return error.code === "PGRST202" || /Could not find the function|schema cache|function .* does not exist/i.test(error.message);
}

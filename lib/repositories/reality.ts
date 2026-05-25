import { alerts as fallbackAlerts, auditEvents as fallbackAuditEvents, entities as fallbackEntities, signals as fallbackSignals } from "../data.ts";
import { rawSignalVisibilityFilter, tenantOrPublicFilter, type OrgContext } from "../api/org.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import { createServerSupabaseReadClient, hasSupabaseReadEnv } from "../supabase/client.ts";

type JsonRecord = Record<string, unknown>;

function firstSourceId(value: unknown) {
  if (!Array.isArray(value)) return "source-backed";
  const first = value[0] as JsonRecord | undefined;
  return typeof first?.sourceId === "string" ? first.sourceId : "source-backed";
}

function confidence(value: unknown, fallback = 0.5) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function titleFromSource(value: unknown, fallback: string) {
  if (!Array.isArray(value)) return fallback;
  const first = value[0] as JsonRecord | undefined;
  return typeof first?.title === "string" ? first.title : fallback;
}

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the table|relation .* does not exist/i.test(message);
}

export async function listAlerts(context: OrgContext = {}) {
  if (!hasSupabaseReadEnv()) return { alerts: fallbackAlerts, source: "fallback" as const };
  const client = createServerSupabaseReadClient();
  const { data, error } = await client
    .from("alerts")
    .select("id, priority, title, description, evidence, confidence, source_refs, created_at")
    .or(tenantOrPublicFilter("org_id", context.orgId))
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return { alerts: fallbackAlerts, source: "fallback" as const };
    throw new Error(`alerts read failed: ${error.message}`);
  }
  return {
    alerts: (data ?? []).map((row: JsonRecord) => ({
      priority: String(row.priority),
      title: String(row.title),
      source: firstSourceId(row.source_refs ?? row.evidence),
      confidence: confidence(row.confidence)
    })),
    source: "supabase" as const
  };
}

export async function listSignals(context: OrgContext = {}) {
  if (!hasSupabaseReadEnv()) return { signals: fallbackSignals, source: "fallback" as const };
  const client = createServerSupabaseReadClient();
  const { data, error } = await client
    .from("raw_signals")
    .select("id, layer, source, external_id, observed_at, source_refs, freshness")
    .or(rawSignalVisibilityFilter(context.orgId))
    .order("observed_at", { ascending: false })
    .limit(100);
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return { signals: fallbackSignals, source: "fallback" as const };
    throw new Error(`signals read failed: ${error.message}`);
  }
  return {
    signals: (data ?? []).map((row: JsonRecord) => ({
      layer: String(row.layer),
      source: String(row.source),
      title: titleFromSource(row.source_refs, String(row.external_id ?? row.id)),
      confidence: confidence(row.freshness, 1),
      observedAt: String(row.observed_at)
    })),
    source: "supabase" as const
  };
}

export async function listEntities(context: OrgContext = {}) {
  if (!hasSupabaseReadEnv()) return { entities: fallbackEntities, source: "fallback" as const };
  const client = createServerSupabaseReadClient();
  const { data, error } = await client
    .from("ontology_objects")
    .select("id, attributes, source_refs, created_at")
    .eq("object_type", "decision_maker")
    .or(tenantOrPublicFilter("org_visible", context.orgId))
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return { entities: fallbackEntities, source: "fallback" as const };
    throw new Error(`entities read failed: ${error.message}`);
  }
  return {
    entities: (data ?? []).map((row: JsonRecord, index: number) => {
      const attributes = (row.attributes ?? {}) as JsonRecord;
      return {
        id: String(row.id),
        name: String(attributes.name ?? row.id),
        score: Number(attributes.reality_score ?? 60 + index),
        committed: "Source-backed",
        lead: 72 + index * 7,
        confidence: 0.62
      };
    }),
    source: "supabase" as const
  };
}

export async function listAuditEvents(context: OrgContext = {}) {
  if (!hasSupabaseReadEnv()) return { auditEvents: fallbackAuditEvents, source: "fallback" as const };
  const client = createServerSupabaseReadClient();
  const { data, error } = await client
    .from("audit_log")
    .select("id, event_type, actor, confidence, source_refs, created_at")
    .or(tenantOrPublicFilter("org_id", context.orgId))
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return { auditEvents: fallbackAuditEvents, source: "fallback" as const };
    throw new Error(`audit read failed: ${error.message}`);
  }
  return {
    auditEvents: (data ?? []).map((row: JsonRecord) => ({
      id: String(row.id),
      event: String(row.event_type),
      actor: String(row.actor),
      confidence: confidence(row.confidence),
      source: firstSourceId(row.source_refs)
    })),
    source: "supabase" as const
  };
}

import { alerts as fallbackAlerts, auditEvents as fallbackAuditEvents, entities as fallbackEntities, signals as fallbackSignals } from "../data.ts";
import { rawSignalVisibilityFilter, tenantOrPublicFilter, type OrgContext } from "../api/org.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import { checkFreshness } from "../pipeline/freshness.ts";
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

function assertSupabaseReadEnv() {
  if (!hasSupabaseReadEnv() && isProductionRuntime()) {
    throw new Error("Supabase read environment is required in production");
  }
}

export async function listAlerts(context: OrgContext = {}) {
  assertSupabaseReadEnv();
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
  assertSupabaseReadEnv();
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
  assertSupabaseReadEnv();
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
        lead: Math.max(1, Math.round(Number(attributes.narrative_gap ?? 1) * 10)),
        confidence: confidence(attributes.confidence, 0.62)
      };
    }),
    source: "supabase" as const
  };
}

export async function listAuditEvents(context: OrgContext = {}) {
  assertSupabaseReadEnv();
  if (!hasSupabaseReadEnv()) return { auditEvents: fallbackAuditEvents, source: "fallback" as const };
  const client = createServerSupabaseReadClient();
  const { data, error } = await client
    .from("audit_log")
    .select("id, event_type, actor, confidence, source_refs, created_at, object_id, detail")
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
      source: firstSourceId(row.source_refs),
      createdAt: String(row.created_at ?? ""),
      objectId: row.object_id ? String(row.object_id) : "",
      detail: (row.detail ?? {}) as JsonRecord
    })),
    source: "supabase" as const
  };
}

export async function getEntityDetail(entityId: string, context: OrgContext = {}) {
  const entities = await listEntities(context);
  const signals = await listSignals(context);
  const alerts = await listAlerts(context);
  const entity = entities.entities.find((item) => item.id === entityId);
  if (!entity) return null;
  const relatedSignals = signals.signals.filter((signal) => signal.title.toLowerCase().includes(entity.name.toLowerCase().slice(0, 8)));
  const relatedAlerts = alerts.alerts.filter((alert) => alert.title.toLowerCase().includes(entity.name.toLowerCase().slice(0, 8)));
  return {
    ...entity,
    signals: relatedSignals,
    alerts: relatedAlerts
  };
}

export async function getEntityScoreHistory(entityId: string, days = 30, context: OrgContext = {}) {
  const fallbackHistory = () => {
    const entity = fallbackEntities.find((entry) => entry.id === entityId);
    const baseline = entity?.score ?? 62;
    const now = Date.now();
    return Array.from({ length: days }, (_, index) => ({
      score: Math.round((baseline - 6 + index * 0.28 + Math.sin(index / 3) * 3) * 100) / 100,
      recorded_at: new Date(now - (days - index - 1) * 86_400_000).toISOString()
    }));
  };
  if (!hasSupabaseReadEnv()) return fallbackHistory();
  const client = createServerSupabaseReadClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await client
    .from("entity_score_history")
    .select("score, recorded_at")
    .eq("entity_id", entityId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true })
    .limit(days + 5);
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return fallbackHistory();
    throw new Error(`entity score history read failed: ${error.message}`);
  }
  return (data ?? []).map((row: JsonRecord) => ({
    score: Number(row.score),
    recorded_at: String(row.recorded_at)
  }));
}

export async function listSourceHealth(_context: OrgContext = {}) {
  if (!hasSupabaseReadEnv()) {
    const grouped = new Map<string, { lastObservedAt: string; rawSignalCount: number }>();
    for (const signal of fallbackSignals) {
      const current = grouped.get(signal.source) ?? { lastObservedAt: signal.observedAt, rawSignalCount: 0 };
      current.lastObservedAt = current.lastObservedAt > signal.observedAt ? current.lastObservedAt : signal.observedAt;
      current.rawSignalCount += 1;
      grouped.set(signal.source, current);
    }
    return checkFreshness(
      Array.from(grouped.entries()).map(([sourceId, value]) => ({
        sourceId,
        lastObservedAt: value.lastObservedAt,
        lastSuccessAt: value.lastObservedAt,
        rawSignalCount: value.rawSignalCount
      }))
    );
  }
  const client = createServerSupabaseReadClient();
  const { data, error } = await client
    .from("source_watermarks")
    .select("source_id, last_success_at, last_observed_at, raw_signal_count")
    .order("updated_at", { ascending: false })
    .limit(250);
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return listSourceHealth({});
    throw new Error(`source health read failed: ${error.message}`);
  }
  return checkFreshness(
    (data ?? []).map((row: JsonRecord) => ({
      sourceId: String(row.source_id),
      lastSuccessAt: row.last_success_at ? String(row.last_success_at) : null,
      lastObservedAt: row.last_observed_at ? String(row.last_observed_at) : null,
      rawSignalCount: Number(row.raw_signal_count ?? 0)
    }))
  );
}

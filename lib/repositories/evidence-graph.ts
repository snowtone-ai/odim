import { rawSignalVisibilityFilter, tenantOrPublicFilter, type OrgContext } from "../api/org.ts";
import { sourceBackedPlan } from "../data.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import { buildEvidenceGraph, buildEvidenceWorkbench, queryEvidenceGraph, type EvidenceGraphQuery } from "../graphrag/evidence-graph.ts";
import type { AlertDraft, AuditEventDraft, IngestionPlan, NormalizedSignal, OntologyLinkDraft, OntologyObjectDraft, SourceRef } from "../pipeline/types.ts";
import { createServerSupabaseReadClient, hasSupabaseReadEnv } from "../supabase/client.ts";

type JsonRecord = Record<string, unknown>;

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

function jsonRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function sourceRefs(value: unknown): SourceRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => jsonRecord(item))
    .filter((item) => typeof item.sourceId === "string")
    .map((item) => ({
      sourceId: String(item.sourceId),
      url: typeof item.url === "string" ? item.url : `odim://${item.sourceId}`,
      title: typeof item.title === "string" ? item.title : String(item.sourceId),
      externalId: typeof item.externalId === "string" ? item.externalId : undefined,
      observedAt: typeof item.observedAt === "string" ? item.observedAt : undefined
    }));
}

function confidence(value: unknown, fallback = 0.5) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function toSignal(row: JsonRecord): NormalizedSignal {
  const refs = sourceRefs(row.source_refs);
  return {
    id: String(row.id),
    layer: String(row.layer) as NormalizedSignal["layer"],
    source: String(row.source ?? "source-backed"),
    externalId: String(row.external_id ?? row.id),
    orgId: stringOrNull(row.org_id),
    payload: jsonRecord(row.payload),
    observedAt: String(row.observed_at ?? row.ingested_at ?? new Date(0).toISOString()),
    sourceRefs: refs,
    fingerprint: String(row.fingerprint ?? row.id),
    confidence: confidence(row.confidence, confidence(row.freshness, 0.68)),
    freshness: confidence(row.freshness, 1),
    isProprietary: row.is_proprietary === true
  };
}

function toObject(row: JsonRecord): OntologyObjectDraft {
  return {
    id: String(row.id),
    objectType: String(row.object_type ?? "object"),
    attributes: jsonRecord(row.attributes),
    orgVisible: stringOrNull(row.org_visible),
    sourceRefs: sourceRefs(row.source_refs)
  };
}

function toLink(row: JsonRecord): OntologyLinkDraft {
  return {
    id: String(row.id),
    fromObjectId: String(row.from_object_id),
    toObjectId: String(row.to_object_id),
    linkType: String(row.link_type ?? "related_to"),
    confidence: confidence(row.confidence, 0.6),
    orgVisible: stringOrNull(row.org_visible),
    sourceRefs: sourceRefs(row.source_refs)
  };
}

function toAlert(row: JsonRecord): AlertDraft {
  const evidence = sourceRefs(row.source_refs).length ? sourceRefs(row.source_refs) : sourceRefs(row.evidence);
  return {
    id: String(row.id),
    dedupeKey: String(row.dedupe_key ?? row.id),
    priority: String(row.priority ?? "medium") as AlertDraft["priority"],
    title: String(row.title ?? "Source-backed alert"),
    description: String(row.description ?? ""),
    relatedObjectId: stringOrNull(row.related_object_id) ?? undefined,
    evidence,
    orgId: stringOrNull(row.org_id),
    confidence: confidence(row.confidence, 0.62),
    signalFingerprint: "",
    createdAt: String(row.created_at ?? new Date(0).toISOString())
  };
}

function toAudit(row: JsonRecord): AuditEventDraft {
  return {
    id: String(row.id),
    dedupeKey: String(row.dedupe_key ?? row.id),
    eventType: String(row.event_type ?? "audit"),
    objectId: stringOrNull(row.object_id) ?? undefined,
    orgId: stringOrNull(row.org_id),
    actor: String(row.actor ?? "odim"),
    detail: jsonRecord(row.detail),
    confidence: confidence(row.confidence, 0.6),
    sourceRefs: sourceRefs(row.source_refs),
    createdAt: String(row.created_at ?? new Date(0).toISOString())
  };
}

async function readSupabasePlan(context: OrgContext): Promise<IngestionPlan> {
  const client = createServerSupabaseReadClient();
  const [objects, links, signals, alerts, audit] = await Promise.all([
    client
      .from("ontology_objects")
      .select("id, object_type, attributes, org_visible, source_refs, created_at")
      .or(tenantOrPublicFilter("org_visible", context.orgId))
      .order("created_at", { ascending: false })
      .limit(500),
    client
      .from("ontology_links")
      .select("id, from_object_id, to_object_id, link_type, confidence, org_visible, source_refs, created_at")
      .or(tenantOrPublicFilter("org_visible", context.orgId))
      .order("created_at", { ascending: false })
      .limit(800),
    client
      .from("raw_signals")
      .select("id, layer, source, external_id, fingerprint, payload, source_refs, org_id, freshness, is_proprietary, observed_at, ingested_at")
      .or(rawSignalVisibilityFilter(context.orgId))
      .order("observed_at", { ascending: false })
      .limit(500),
    client
      .from("alerts")
      .select("id, dedupe_key, priority, title, description, related_object_id, evidence, confidence, source_refs, org_id, created_at")
      .or(tenantOrPublicFilter("org_id", context.orgId))
      .order("created_at", { ascending: false })
      .limit(250),
    client
      .from("audit_log")
      .select("id, dedupe_key, event_type, object_id, org_id, actor, detail, source_refs, confidence, created_at")
      .or(tenantOrPublicFilter("org_id", context.orgId))
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  const firstError = [objects.error, links.error, signals.error, alerts.error, audit.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  return {
    ontologyObjects: (objects.data ?? []).map((row) => toObject(row as JsonRecord)),
    ontologyLinks: (links.data ?? []).map((row) => toLink(row as JsonRecord)),
    rawSignals: (signals.data ?? []).map((row) => toSignal(row as JsonRecord)),
    alerts: (alerts.data ?? []).map((row) => toAlert(row as JsonRecord)),
    auditEvents: (audit.data ?? []).map((row) => toAudit(row as JsonRecord))
  };
}

export async function loadEvidencePlan(context: OrgContext = {}) {
  assertSupabaseReadEnv();
  if (!hasSupabaseReadEnv()) return { plan: sourceBackedPlan, source: "fallback" as const };
  try {
    return { plan: await readSupabasePlan(context), source: "supabase" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (shouldFallbackFromSupabaseError(message)) return { plan: sourceBackedPlan, source: "fallback" as const };
    throw new Error(`evidence graph read failed: ${message}`);
  }
}

export async function getEvidenceWorkbench(context: OrgContext = {}) {
  const { plan, source } = await loadEvidencePlan(context);
  return {
    ...buildEvidenceWorkbench(plan),
    source
  };
}

export async function queryRealityEvidenceGraph(query: EvidenceGraphQuery, context: OrgContext = {}) {
  const { plan, source } = await loadEvidencePlan(context);
  const graph = buildEvidenceGraph(plan);
  return {
    ...queryEvidenceGraph(graph, query),
    source
  };
}

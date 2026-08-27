import { isProductionRuntime } from "../env/runtime.ts";
import { queryRealityEvidenceGraph } from "../repositories/evidence-graph.ts";
import { listAlerts, listAuditEvents, listEntities, listSignals } from "../repositories/reality.ts";
import { searchMuninMemory, searchOpinions, type MuninMemory, type MuninOpinion, type RetrievedMemory } from "../munin/memory.ts";
import { createMuninTemporalMemoryReader, isMuninReaderStrictRuntime } from "../munin/reader.ts";
import type { SourceRef } from "../pipeline/types.ts";
import type { EvidenceGraphMetrics, EvidencePath } from "../graphrag/evidence-graph.ts";
import sourcesConfig from "../../config/sources.json" with { type: "json" };
import { realityGapfillSearch, type GapfillResult } from "./gapfill.ts";
import { computeRDS, narrativeCaptureSearch, type NarrativeCaptureResult } from "./narrative-capture.ts";
import { HuginnExecutionError, type TemporalMemoryReader } from "./orchestrator/types.ts";
import { findPrecomputedAnswer, type PrecomputedAnswer } from "./precompute.ts";
import type { SelfAssessmentPlan } from "./self-assessment.ts";

export type CascadeLayer = "precomputed" | "munin_core" | "munin_archival" | "evidence_graph" | "odim_cache" | "reality_gapfill" | "opinion_search" | "narrative_capture";

export type CascadeEvidence = {
  id: string;
  layer: CascadeLayer;
  sourceType: string;
  content: string;
  confidence: number;
  sourceRefs: SourceRef[];
  isNarrative?: boolean;
};

export type CascadeSearchResult = {
  evidence: CascadeEvidence[];
  opinions: MuninOpinion[];
  narrative: NarrativeCaptureResult[];
  gapfill: GapfillResult[];
  layers_used: CascadeLayer[];
  evidenceGraph?: {
    paths: EvidencePath[];
    metrics: EvidenceGraphMetrics;
    source: "fallback" | "supabase";
  };
  rds?: number;
  precomputed?: PrecomputedAnswer;
  /** Safe category-only outcomes for timing/diagnostics; no source payloads. */
  retrievalFailures: string[];
  contextCounts: {
    alerts: number;
    entities: number;
    signals: number;
    auditEvents: number;
    fact: number;
    procedure: number;
    seed: number;
    opinions: number;
  };
  contextSource: "fallback" | "supabase";
};

function sourceRef(sourceId: string, title: string, observedAt?: string): SourceRef {
  return { sourceId, title, url: `odim://${sourceId}`, ...(observedAt ? { observedAt } : {}) };
}

export function evaluateSufficiency(evidence: Array<{ confidence: number }>, plan: SelfAssessmentPlan) {
  if (!evidence.length) return false;
  const confidence = evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length;
  const threshold = Math.max(0.55, 1 - plan.confidence_without_retrieval);
  return evidence.length >= 2 && confidence >= threshold;
}

export function searchLayer1Munin(input: { orgId: string; question: string; memories?: MuninMemory[]; asOf?: string }) {
  const asOf = input.asOf ? new Date(input.asOf) : undefined;
  return searchMuninMemory({
    orgId: input.orgId,
    question: input.question,
    memories: input.memories,
    topK: 8,
    now: asOf && Number.isFinite(asOf.valueOf()) ? asOf : undefined
  });
}

function countsFromEvidenceGraph(graph: { nodes: Array<{ kind: string }> }) {
  return {
    alerts: graph.nodes.filter((node) => node.kind === "alert").length,
    entities: graph.nodes.filter((node) => node.kind === "entity").length,
    signals: graph.nodes.filter((node) => node.kind === "signal").length,
    auditEvents: graph.nodes.filter((node) => node.kind === "audit").length
  };
}

function mergeCounts(
  left: { alerts: number; entities: number; signals: number; auditEvents: number },
  right: { alerts: number; entities: number; signals: number; auditEvents: number }
) {
  return {
    alerts: Math.max(left.alerts, right.alerts),
    entities: Math.max(left.entities, right.entities),
    signals: Math.max(left.signals, right.signals),
    auditEvents: Math.max(left.auditEvents, right.auditEvents)
  };
}

function observedAtFor(value: unknown) {
  const item = value && typeof value === "object" ? value as { observedAt?: unknown; createdAt?: unknown; sourceRefs?: unknown } : {};
  if (typeof item.observedAt === "string" && Number.isFinite(Date.parse(item.observedAt))) return item.observedAt;
  if (typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt))) return item.createdAt;
  if (Array.isArray(item.sourceRefs)) {
    const first = item.sourceRefs[0] as { observedAt?: unknown } | undefined;
    if (typeof first?.observedAt === "string" && Number.isFinite(Date.parse(first.observedAt))) return first.observedAt;
  }
  return undefined;
}

function isObservedBy(value: unknown, asOf: string) {
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) return false;
  const observedAt = observedAtFor(value);
  // Local fixture rows historically have no event timestamp. They remain usable
  // only outside strict/production runtimes; Supabase-backed rows must be dated.
  if (!observedAt) return !isMuninReaderStrictRuntime();
  return Date.parse(observedAt) <= asOfMs;
}

function evidencePathIsObservedBy(path: EvidencePath, asOf: string) {
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs) || !path.sources.length) return false;
  return path.sources.every((ref) => {
    if (typeof ref.observedAt !== "string" || !Number.isFinite(Date.parse(ref.observedAt))) {
      return !isMuninReaderStrictRuntime();
    }
    return Date.parse(ref.observedAt) <= asOfMs;
  });
}

export async function searchLayer2OdimCache(orgId: string, asOf = new Date().toISOString()) {
  const [alertsResult, entitiesResult, signalsResult, auditResult] = await Promise.all([
    listAlerts({ orgId }),
    listEntities({ orgId }),
    listSignals({ orgId }),
    listAuditEvents({ orgId })
  ]);
  const source: "fallback" | "supabase" =
    alertsResult.source === "supabase" || entitiesResult.source === "supabase" || signalsResult.source === "supabase" || auditResult.source === "supabase"
      ? "supabase"
      : "fallback";
  const entities = entitiesResult.entities.filter((entity) => isObservedBy(entity, asOf));
  const signals = signalsResult.signals
    .filter((signal) => signal.layer.toLowerCase() !== "narrative")
    .filter((signal) => isObservedBy(signal, asOf));
  const alerts = alertsResult.alerts.filter((alert) => isObservedBy(alert, asOf));
  const auditEvents = auditResult.auditEvents.filter((event) => isObservedBy(event, asOf));
  const evidence: CascadeEvidence[] = [
    ...entities.slice(0, 6).map((entity, index) => ({
      id: `entity:${index}:${entity.name}`,
      layer: "odim_cache" as const,
      sourceType: "odim_derived",
      content: `${entity.name}; reality_score=${entity.score}; confidence=${entity.confidence}`,
      confidence: entity.confidence,
      sourceRefs: [sourceRef("local:ontology", entity.name, observedAtFor(entity))]
    })),
    ...signals.slice(0, 8).map((signal, index) => ({
      id: `signal:${index}:${signal.source}`,
      layer: "odim_cache" as const,
      sourceType: "primary_filing",
      content: `[${signal.layer}] ${signal.title}; source=${signal.source}; observed=${signal.observedAt}`,
      confidence: signal.confidence,
      sourceRefs: [sourceRef(signal.source, signal.title, observedAtFor(signal))]
    })),
    ...alerts.slice(0, 6).map((alert, index) => ({
      id: `alert:${index}:${alert.source}`,
      layer: "odim_cache" as const,
      sourceType: "odim_derived",
      content: `[${alert.priority}] ${alert.title}; source=${alert.source}`,
      confidence: alert.confidence,
      sourceRefs: [sourceRef(alert.source, alert.title, observedAtFor(alert))]
    })),
    ...auditEvents.slice(0, 6).map((event, index) => ({
      id: `audit:${index}:${event.source}`,
      layer: "odim_cache" as const,
      sourceType: "odim_derived",
      content: `${event.event}; actor=${event.actor}; source=${event.source}`,
      confidence: event.confidence,
      sourceRefs: [sourceRef(event.source, event.event, observedAtFor(event))]
    }))
  ];
  return {
    evidence,
    source,
    counts: {
      alerts: alerts.length,
      entities: entities.length,
      signals: signals.length,
      auditEvents: auditEvents.length
    }
  };
}

function memoryToEvidence(memory: RetrievedMemory): CascadeEvidence {
  return {
    id: memory.id,
    layer: memory.isSeed || memory.agentScope === "core" ? "munin_core" : "munin_archival",
    sourceType: memory.sourceType,
    content: `[${memory.memoryClass}/${memory.agentScope} ${memory.retrievalScore}] ${memory.content}`,
    confidence: memory.retrievalScore,
    sourceRefs: memory.sourceRefs
  };
}

/** Reciprocal-rank fusion prevents one broad layer from deciding relevance alone. */
export function reciprocalRankFuse(groups: Array<{ layer: CascadeLayer; evidence: CascadeEvidence[] }>) {
  const scores = new Map<string, { evidence: CascadeEvidence; score: number; firstSeen: number }>();
  let firstSeen = 0;
  for (const group of groups) {
    group.evidence.forEach((evidence, index) => {
      const score = 1 / (60 + index + 1) + Math.max(0, Math.min(1, evidence.confidence)) * 0.01;
      const current = scores.get(evidence.id);
      if (current) current.score += score;
      else scores.set(evidence.id, { evidence, score, firstSeen: firstSeen++ });
    });
  }
  return [...scores.values()]
    .sort((left, right) => right.score - left.score || left.firstSeen - right.firstSeen)
    .map((entry) => entry.evidence);
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw new HuginnExecutionError({
    code: signal.reason === "deadline" ? "deadline_exceeded" : "aborted",
    message: "Huginn retrieval was cancelled",
    retryable: signal.reason === "deadline"
  });
}

function rejectedMessage(result: PromiseSettledResult<unknown>, label: string) {
  if (result.status !== "rejected") return undefined;
  return `${label}:${result.reason instanceof Error ? result.reason.name : "failed"}`;
}

function isTemporallyUsable(input: {
  item: { orgId: string; validFrom: string; validTo: string | null; observedAt?: string | null; status?: string; reviewStatus?: string };
  orgId: string;
  asOf: string;
}) {
  const asOf = Date.parse(input.asOf);
  const validFrom = Date.parse(input.item.validFrom);
  const validTo = input.item.validTo ? Date.parse(input.item.validTo) : undefined;
  const observedAt = input.item.observedAt == null ? undefined : Date.parse(input.item.observedAt);
  const observedByAsOf = observedAt === undefined
    ? !isMuninReaderStrictRuntime()
    : Number.isFinite(observedAt) && observedAt <= asOf;
  return (
    input.item.orgId === input.orgId &&
    (input.item.status ?? "active") === "active" &&
    ((input.item.reviewStatus ?? "not_required") === "approved" || (input.item.reviewStatus ?? "not_required") === "not_required") &&
    Number.isFinite(asOf) &&
    Number.isFinite(validFrom) &&
    validFrom <= asOf &&
    observedByAsOf &&
    (validTo === undefined || (Number.isFinite(validTo) && asOf < validTo))
  );
}

async function readTemporalMemories(input: {
  orgId: string;
  question: string;
  asOf: string;
  signal?: AbortSignal;
  memories?: MuninMemory[];
  temporalMemoryReader?: TemporalMemoryReader<RetrievedMemory, MuninOpinion>;
}) {
  if (typeof input.temporalMemoryReader?.search === "function") {
    const result = await input.temporalMemoryReader.search({ orgId: input.orgId, question: input.question, asOf: input.asOf, signal: input.signal });
    return Array.isArray(result) ? result.filter((memory) => isTemporallyUsable({ item: memory, orgId: input.orgId, asOf: input.asOf })) : [];
  }
  if (input.memories && !isMuninReaderStrictRuntime()) {
    return searchLayer1Munin({ orgId: input.orgId, question: input.question, memories: input.memories, asOf: input.asOf });
  }
  const reader = createMuninTemporalMemoryReader();
  if (typeof reader.search !== "function") return [];
  const result = await reader.search({ orgId: input.orgId, question: input.question, asOf: input.asOf, signal: input.signal });
  return Array.isArray(result) ? result.filter((memory) => isTemporallyUsable({ item: memory, orgId: input.orgId, asOf: input.asOf })) : [];
}

async function readTemporalOpinions(input: {
  orgId: string;
  question: string;
  asOf: string;
  signal?: AbortSignal;
  opinions?: MuninOpinion[];
  temporalMemoryReader?: TemporalMemoryReader<RetrievedMemory, MuninOpinion>;
}) {
  if (typeof input.temporalMemoryReader?.searchOpinions === "function") {
    const result = await input.temporalMemoryReader.searchOpinions({ orgId: input.orgId, question: input.question, asOf: input.asOf, signal: input.signal });
    return Array.isArray(result) ? result.filter((opinion) => isTemporallyUsable({ item: opinion, orgId: input.orgId, asOf: input.asOf })) : [];
  }
  if (input.opinions && !isMuninReaderStrictRuntime()) {
    const asOf = new Date(input.asOf);
    return searchOpinions({
      orgId: input.orgId,
      question: input.question,
      opinions: input.opinions,
      now: Number.isFinite(asOf.valueOf()) ? asOf : undefined
    });
  }
  const reader = createMuninTemporalMemoryReader();
  if (typeof reader.searchOpinions === "function") {
    const result = await reader.searchOpinions({ orgId: input.orgId, question: input.question, asOf: input.asOf, signal: input.signal });
    return Array.isArray(result) ? result.filter((opinion) => isTemporallyUsable({ item: opinion, orgId: input.orgId, asOf: input.asOf })) : [];
  }
  const asOf = new Date(input.asOf);
  return searchOpinions({
    orgId: input.orgId,
    question: input.question,
    opinions: input.opinions,
    now: Number.isFinite(asOf.valueOf()) ? asOf : undefined
  });
}

export async function cascadeSearch(input: {
  orgId: string;
  question: string;
  plan: SelfAssessmentPlan;
  memories?: MuninMemory[];
  opinions?: MuninOpinion[];
  asOf?: string;
  signal?: AbortSignal;
  temporalMemoryReader?: TemporalMemoryReader<RetrievedMemory, MuninOpinion>;
}): Promise<CascadeSearchResult> {
  const asOf = input.asOf ?? new Date().toISOString();
  const temporalMemoryReader = input.temporalMemoryReader ?? (
    input.memories && !isMuninReaderStrictRuntime() ? undefined : createMuninTemporalMemoryReader()
  );
  throwIfAborted(input.signal);
  const layers = new Set<CascadeLayer>();
  const [precomputedResult, memoriesResult] = await Promise.allSettled([
    findPrecomputedAnswer({ orgId: input.orgId, question: input.question, now: new Date(asOf), signal: input.signal }),
    readTemporalMemories({
      orgId: input.orgId,
      question: input.question,
      asOf,
      signal: input.signal,
      memories: input.memories,
      temporalMemoryReader
    })
  ]);
  throwIfAborted(input.signal);

  const precomputed = precomputedResult.status === "fulfilled" ? precomputedResult.value : undefined;
  const memories = memoriesResult.status === "fulfilled" ? memoriesResult.value : [];
  const retrievalFailures = [rejectedMessage(precomputedResult, "precomputed"), rejectedMessage(memoriesResult, "munin")].filter(
    (value): value is string => Boolean(value)
  );
  const muninFailure = rejectedMessage(memoriesResult, "munin");
  if (isMuninReaderStrictRuntime() && muninFailure) {
    throw new HuginnExecutionError({ code: "retrieval_unavailable", message: "Muninn temporal retrieval is unavailable", retryable: true });
  }
  if (precomputed) layers.add("precomputed");

  const memoryEvidence = memories.map(memoryToEvidence);
  if (memoryEvidence.some((item) => item.layer === "munin_core")) layers.add("munin_core");
  if (input.plan.need_retrieval && memoryEvidence.some((item) => item.layer === "munin_archival")) layers.add("munin_archival");
  let evidence = memoryEvidence;
  let contextSource: "fallback" | "supabase" = temporalMemoryReader && "source" in temporalMemoryReader && temporalMemoryReader.source === "supabase"
    ? "supabase"
    : "fallback";
  let counts = { alerts: 0, entities: 0, signals: 0, auditEvents: 0 };
  let evidenceGraph: CascadeSearchResult["evidenceGraph"] | undefined;

  if (input.plan.need_retrieval || !evaluateSufficiency(evidence, input.plan)) {
    const [graphResult, odimResult] = await Promise.allSettled([
      queryRealityEvidenceGraph({ question: input.question, limit: 4 }, { orgId: input.orgId }),
      searchLayer2OdimCache(input.orgId, asOf)
    ]);
    throwIfAborted(input.signal);
    const graphFailure = rejectedMessage(graphResult, "evidence_graph");
    const odimFailure = rejectedMessage(odimResult, "odim_cache");
    if (graphFailure) retrievalFailures.push(graphFailure);
    if (odimFailure) retrievalFailures.push(odimFailure);
    if (isProductionRuntime() && (graphFailure || odimFailure)) {
      throw new HuginnExecutionError({ code: "retrieval_unavailable", message: "Required source-backed retrieval is unavailable", retryable: true });
    }
    if (graphResult.status === "fulfilled") {
      const graph = graphResult.value;
      const paths = graph.paths.filter((path) => evidencePathIsObservedBy(path, asOf));
      if (paths.length) {
        counts = countsFromEvidenceGraph(graph.graph);
        layers.add("evidence_graph");
        evidenceGraph = { paths, metrics: graph.metrics, source: graph.source };
        evidence = [
          ...evidence,
          ...paths.map((path) => ({
            id: path.id,
            layer: "evidence_graph" as const,
            sourceType: "evidence_path",
            content: path.rationale,
            confidence: path.confidence,
            sourceRefs: path.sources
          }))
        ];
        contextSource = graph.source === "supabase" ? "supabase" : contextSource;
      }
    }
    if (odimResult.status === "fulfilled") {
      const odim = odimResult.value;
      evidence = [...evidence, ...odim.evidence];
      layers.add("odim_cache");
      counts = mergeCounts(counts, odim.counts);
      contextSource = odim.source;
    }
  }

  evidence = reciprocalRankFuse([
    { layer: "munin_core", evidence: evidence.filter((item) => item.layer === "munin_core" || item.layer === "munin_archival") },
    { layer: "evidence_graph", evidence: evidence.filter((item) => item.layer === "evidence_graph") },
    { layer: "odim_cache", evidence: evidence.filter((item) => item.layer === "odim_cache") }
  ]);

  const allowedDomains = Array.isArray(sourcesConfig.allowedGapfillDomains) ? sourcesConfig.allowedGapfillDomains : [];
  const needsGapfill = input.plan.needs_reality_gapfill && !evaluateSufficiency(evidence, input.plan);
  const [gapfillResult, opinionsResult, narrativeResult] = await Promise.allSettled([
    needsGapfill ? realityGapfillSearch({ orgId: input.orgId, question: input.question, allowedDomains, signal: input.signal }) : Promise.resolve([] as GapfillResult[]),
    input.plan.uses_past_opinion
      ? readTemporalOpinions({
          orgId: input.orgId,
          question: input.question,
          asOf,
          signal: input.signal,
          opinions: input.opinions,
          temporalMemoryReader
        })
      : Promise.resolve([] as MuninOpinion[]),
    input.plan.needs_narrative_capture
      ? narrativeCaptureSearch({ orgId: input.orgId, question: input.question, signal: input.signal })
      : Promise.resolve([] as NarrativeCaptureResult[])
  ]);
  throwIfAborted(input.signal);
  for (const [label, result] of [
    ["reality_gapfill", gapfillResult],
    ["opinion_search", opinionsResult],
    ["narrative_capture", narrativeResult]
  ] as const) {
    const failure = rejectedMessage(result, label);
    if (failure) retrievalFailures.push(failure);
  }

  const gapfill = gapfillResult.status === "fulfilled" ? gapfillResult.value : [];
  const gapfillEvidence = gapfill.map((result) => ({
    id: result.id,
    layer: "reality_gapfill" as const,
    sourceType: result.sourceType,
    content: result.content,
    confidence: result.confidence,
    sourceRefs: result.sourceRefs
  }));
  if (gapfillEvidence.length) {
    layers.add("reality_gapfill");
    evidence = reciprocalRankFuse([
      { layer: "munin_core", evidence },
      { layer: "reality_gapfill", evidence: gapfillEvidence }
    ]);
  }

  const opinions = opinionsResult.status === "fulfilled" ? opinionsResult.value : [];
  if (opinions.length) layers.add("opinion_search");
  const narrative = narrativeResult.status === "fulfilled" ? narrativeResult.value : [];
  if (narrative.length) layers.add("narrative_capture");

  return {
    evidence,
    opinions,
    narrative,
    gapfill,
    layers_used: [...layers],
    evidenceGraph,
    rds: computeRDS(evidence, narrative),
    precomputed,
    retrievalFailures,
    contextCounts: {
      ...counts,
      fact: memories.filter((memory) => memory.memoryClass === "fact").length,
      procedure: memories.filter((memory) => memory.memoryClass === "procedure").length,
      seed: memories.filter((memory) => memory.isSeed).length,
      opinions: opinions.length
    },
    contextSource
  };
}

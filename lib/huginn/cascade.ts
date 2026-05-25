import { listAlerts, listAuditEvents, listEntities, listSignals } from "../repositories/reality.ts";
import { buildFixtureMemories, searchMuninMemory, searchOpinions, type MuninMemory, type MuninOpinion, type RetrievedMemory } from "../munin/memory.ts";
import type { SourceRef } from "../pipeline/types.ts";
import { realityGapfillSearch, type GapfillResult } from "./gapfill.ts";
import { computeRDS, narrativeCaptureSearch, type NarrativeCaptureResult } from "./narrative-capture.ts";
import { findPrecomputedAnswer, type PrecomputedAnswer } from "./precompute.ts";
import type { SelfAssessmentPlan } from "./self-assessment.ts";
import sourcesConfig from "../../config/sources.json" with { type: "json" };

export type CascadeLayer = "precomputed" | "munin_core" | "munin_archival" | "odim_cache" | "reality_gapfill" | "opinion_search" | "narrative_capture";

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
  rds?: number;
  precomputed?: PrecomputedAnswer;
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

function sourceRef(sourceId: string, title: string): SourceRef {
  return { sourceId, title, url: `odim://${sourceId}`, observedAt: new Date(0).toISOString() };
}

export function evaluateSufficiency(evidence: Array<{ confidence: number }>, plan: SelfAssessmentPlan) {
  if (!evidence.length) return false;
  const confidence = evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length;
  const threshold = Math.max(0.55, 1 - plan.confidence_without_retrieval);
  return evidence.length >= 2 && confidence >= threshold;
}

export function searchLayer1Munin(input: { orgId: string; question: string; memories?: MuninMemory[] }) {
  return searchMuninMemory({ orgId: input.orgId, question: input.question, memories: input.memories, topK: 8 });
}

export async function searchLayer2OdimCache(orgId: string) {
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
  const signals = signalsResult.signals.filter((signal) => signal.layer.toLowerCase() !== "narrative");
  const evidence: CascadeEvidence[] = [
    ...entitiesResult.entities.slice(0, 6).map((entity, index) => ({
      id: `entity:${index}:${entity.name}`,
      layer: "odim_cache" as const,
      sourceType: "odim_derived",
      content: `${entity.name}; reality_score=${entity.score}; confidence=${entity.confidence}`,
      confidence: entity.confidence,
      sourceRefs: [sourceRef("local:ontology", entity.name)]
    })),
    ...signals.slice(0, 8).map((signal, index) => ({
      id: `signal:${index}:${signal.source}`,
      layer: "odim_cache" as const,
      sourceType: "primary_filing",
      content: `[${signal.layer}] ${signal.title}; source=${signal.source}; observed=${signal.observedAt}`,
      confidence: signal.confidence,
      sourceRefs: [sourceRef(signal.source, signal.title)]
    })),
    ...alertsResult.alerts.slice(0, 6).map((alert, index) => ({
      id: `alert:${index}:${alert.source}`,
      layer: "odim_cache" as const,
      sourceType: "odim_derived",
      content: `[${alert.priority}] ${alert.title}; source=${alert.source}`,
      confidence: alert.confidence,
      sourceRefs: [sourceRef(alert.source, alert.title)]
    })),
    ...auditResult.auditEvents.slice(0, 6).map((event, index) => ({
      id: `audit:${index}:${event.source}`,
      layer: "odim_cache" as const,
      sourceType: "odim_derived",
      content: `${event.event}; actor=${event.actor}; source=${event.source}`,
      confidence: event.confidence,
      sourceRefs: [sourceRef(event.source, event.event)]
    }))
  ];
  return {
    evidence,
    source,
    counts: {
      alerts: alertsResult.alerts.length,
      entities: entitiesResult.entities.length,
      signals: signals.length,
      auditEvents: auditResult.auditEvents.length
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

export async function cascadeSearch(input: {
  orgId: string;
  question: string;
  plan: SelfAssessmentPlan;
  memories?: MuninMemory[];
  opinions?: MuninOpinion[];
}): Promise<CascadeSearchResult> {
  const layers = new Set<CascadeLayer>();
  const precomputed = await findPrecomputedAnswer({ orgId: input.orgId, question: input.question });
  if (precomputed) {
    layers.add("precomputed");
    return {
      evidence: [],
      opinions: [],
      narrative: [],
      gapfill: [],
      layers_used: [...layers],
      precomputed,
      contextCounts: { alerts: 0, entities: 0, signals: 0, auditEvents: 0, fact: 0, procedure: 0, seed: 0, opinions: 0 },
      contextSource: "fallback"
    };
  }

  const memories = searchLayer1Munin({ orgId: input.orgId, question: input.question, memories: input.memories ?? buildFixtureMemories(input.orgId) });
  const memoryEvidence = memories.map(memoryToEvidence);
  if (memoryEvidence.some((item) => item.layer === "munin_core")) layers.add("munin_core");
  if (input.plan.need_retrieval && memoryEvidence.some((item) => item.layer === "munin_archival")) layers.add("munin_archival");
  let evidence = memoryEvidence;
  let contextSource: "fallback" | "supabase" = "fallback";
  let counts = { alerts: 0, entities: 0, signals: 0, auditEvents: 0 };

  if (!evaluateSufficiency(evidence, input.plan)) {
    const odim = await searchLayer2OdimCache(input.orgId);
    evidence = [...evidence, ...odim.evidence];
    layers.add("odim_cache");
    counts = odim.counts;
    contextSource = odim.source;
  }

  const allowedDomains = Array.isArray(sourcesConfig.allowedGapfillDomains) ? sourcesConfig.allowedGapfillDomains : [];
  const gapfill =
    input.plan.needs_reality_gapfill && !evaluateSufficiency(evidence, input.plan)
      ? await realityGapfillSearch({ orgId: input.orgId, question: input.question, allowedDomains })
      : [];
  if (gapfill.length) {
    layers.add("reality_gapfill");
    evidence = [
      ...evidence,
      ...gapfill.map((result) => ({
        id: result.id,
        layer: "reality_gapfill" as const,
        sourceType: result.sourceType,
        content: result.content,
        confidence: result.confidence,
        sourceRefs: result.sourceRefs
      }))
    ];
  }

  const opinions = input.plan.uses_past_opinion ? searchOpinions({ orgId: input.orgId, question: input.question, opinions: input.opinions }) : [];
  if (opinions.length) layers.add("opinion_search");

  const narrative = input.plan.needs_narrative_capture ? await narrativeCaptureSearch({ orgId: input.orgId, question: input.question }) : [];
  if (narrative.length) layers.add("narrative_capture");
  const rds = computeRDS(evidence, narrative);

  return {
    evidence,
    opinions,
    narrative,
    gapfill,
    layers_used: [...layers],
    rds,
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

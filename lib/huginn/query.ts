import { generateAnswer, type GenerateResponse } from "../ai/provider.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import { buildRecallMemoryDraft, searchMuninMemory, toMuninMemoryRow, type MuninMemory, type RetrievedMemory } from "../munin/memory.ts";
import type { SourceRef } from "../pipeline/types.ts";
import { listAlerts, listAuditEvents, listEntities, listSignals } from "../repositories/reality.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";

export type ReasoningTraceStep = {
  step: "scope" | "memory" | "ontology" | "generation" | "recall";
  summary: string;
  confidence?: number;
  sources?: string[];
};

export type HuginnResponse = GenerateResponse & {
  orgId: string;
  reasoningTrace: ReasoningTraceStep[];
  munin: {
    retrieved: Array<Pick<RetrievedMemory, "id" | "agentScope" | "content" | "retrievalScore">>;
    recallDraft: Pick<MuninMemory, "id" | "orgId" | "agentScope" | "content" | "sourceRefs">;
    persisted: boolean;
  };
  context: {
    source: "fallback" | "supabase";
    alerts: number;
    entities: number;
    signals: number;
    auditEvents: number;
  };
};

export type HuginnQuestionInput = {
  orgId: string;
  question: string;
  userId?: string;
  memories?: MuninMemory[];
  generate?: typeof generateAnswer;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the table|relation .* does not exist/i.test(message);
}

function sourceRef(sourceId: string, title: string): SourceRef {
  return {
    sourceId,
    title,
    url: `odim://${sourceId}`,
    observedAt: new Date(0).toISOString()
  };
}

function sourceIdsFromRows(rows: Array<{ source?: string }>) {
  return unique(rows.map((row) => row.source ?? "source-backed"));
}

function buildSourceRefs(input: {
  alerts: Array<{ source?: string; title?: string }>;
  signals: Array<{ source?: string; title?: string }>;
  auditEvents: Array<{ source?: string; event?: string }>;
}) {
  const refs = [
    ...input.alerts.map((alert) => sourceRef(alert.source ?? "alert", alert.title ?? "Alert evidence")),
    ...input.signals.map((signal) => sourceRef(signal.source ?? "signal", signal.title ?? "Signal evidence")),
    ...input.auditEvents.map((event) => sourceRef(event.source ?? "audit", event.event ?? "Audit evidence"))
  ];
  return refs.filter((ref, index, all) => all.findIndex((candidate) => candidate.sourceId === ref.sourceId) === index);
}

function formatContext(input: {
  orgId: string;
  question: string;
  memories: RetrievedMemory[];
  alerts: Array<{ priority: string; title: string; source: string; confidence: number }>;
  entities: Array<{ name: string; score: number; confidence: number }>;
  signals: Array<{ layer: string; source: string; title: string; confidence: number; observedAt: string }>;
  auditEvents: Array<{ event: string; actor: string; confidence: number; source: string }>;
}) {
  const memoryLines = input.memories
    .map((memory) => `- [${memory.agentScope} ${memory.retrievalScore}] ${memory.content}`)
    .join("\n");
  const alertLines = input.alerts
    .slice(0, 6)
    .map((alert) => `- [${alert.priority}] ${alert.title}; source=${alert.source}; confidence=${alert.confidence}`)
    .join("\n");
  const entityLines = input.entities
    .slice(0, 6)
    .map((entity) => `- ${entity.name}; reality_score=${entity.score}; confidence=${entity.confidence}`)
    .join("\n");
  const signalLines = input.signals
    .slice(0, 8)
    .map((signal) => `- [${signal.layer}] ${signal.title}; source=${signal.source}; observed=${signal.observedAt}`)
    .join("\n");
  const auditLines = input.auditEvents
    .slice(0, 6)
    .map((event) => `- ${event.event}; actor=${event.actor}; source=${event.source}; confidence=${event.confidence}`)
    .join("\n");

  return [
    `org_id=${input.orgId}`,
    "Rules: use only source-backed Reality/Ontology/Audit evidence visible to this org. Narrative is a trigger, not truth. Do not predict prices. Include confidence and sources.",
    `Question: ${input.question}`,
    "Munin memory:",
    memoryLines || "- none",
    "Ontology entities:",
    entityLines || "- none",
    "Reality signals:",
    signalLines || "- none",
    "Alerts:",
    alertLines || "- none",
    "Audit trail:",
    auditLines || "- none"
  ].join("\n");
}

export async function answerHuginnQuestion(input: HuginnQuestionInput): Promise<HuginnResponse> {
  if (!input.orgId) throw new Error("orgId is required for Huginn queries");
  if (!input.question.trim()) throw new Error("question is required for Huginn queries");

  const memories = searchMuninMemory({
    orgId: input.orgId,
    question: input.question,
    memories: input.memories,
    topK: 8
  });
  const [alertsResult, entitiesResult, signalsResult, auditResult] = await Promise.all([
    listAlerts({ orgId: input.orgId }),
    listEntities({ orgId: input.orgId }),
    listSignals({ orgId: input.orgId }),
    listAuditEvents({ orgId: input.orgId })
  ]);
  const context = formatContext({
    orgId: input.orgId,
    question: input.question,
    memories,
    alerts: alertsResult.alerts,
    entities: entitiesResult.entities,
    signals: signalsResult.signals,
    auditEvents: auditResult.auditEvents
  });

  const generated = await (input.generate ?? generateAnswer)({
    question: input.question,
    context,
    orgId: input.orgId
  });
  const sourceRefs = buildSourceRefs({
    alerts: alertsResult.alerts,
    signals: signalsResult.signals,
    auditEvents: auditResult.auditEvents
  });
  const sources = unique([
    ...generated.sources,
    ...sourceIdsFromRows(alertsResult.alerts),
    ...sourceIdsFromRows(signalsResult.signals),
    ...sourceIdsFromRows(auditResult.auditEvents),
    ...memories.flatMap((memory) => memory.sourceRefs.map((ref) => ref.sourceId))
  ]);
  const confidenceValues = [
    generated.confidence,
    ...alertsResult.alerts.map((alert) => alert.confidence),
    ...signalsResult.signals.map((signal) => signal.confidence),
    ...auditResult.auditEvents.map((event) => event.confidence),
    ...memories.map((memory) => memory.retrievalScore)
  ].filter((value) => Number.isFinite(value));
  const confidence =
    Math.round((confidenceValues.reduce((sum, value) => sum + value, 0) / Math.max(1, confidenceValues.length)) * 100) /
    100;
  const recallDraft = buildRecallMemoryDraft({
    orgId: input.orgId,
    userId: input.userId,
    question: input.question,
    answer: generated.answer,
    sourceRefs
  });
  let memoryPersisted = false;
  if (hasSupabaseWriteEnv()) {
    const { error } = await createServiceSupabaseClient()
      .from("munin_memory")
      .upsert(toMuninMemoryRow(recallDraft), { onConflict: "id" });
    if (error) {
      if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`Munin recall write failed: ${error.message}`);
    } else {
      memoryPersisted = true;
    }
  }

  return {
    ...generated,
    confidence,
    sources,
    orgId: input.orgId,
    reasoningTrace: [
      {
        step: "scope",
        summary: `Restricted query to org ${input.orgId} and public ontology/fallback context.`
      },
      {
        step: "memory",
        summary: `Retrieved ${memories.length} org-scoped Munin memories.`,
        sources: unique(memories.flatMap((memory) => memory.sourceRefs.map((ref) => ref.sourceId)))
      },
      {
        step: "ontology",
        summary: `Loaded ${entitiesResult.entities.length} entities, ${signalsResult.signals.length} signals, ${alertsResult.alerts.length} alerts, and ${auditResult.auditEvents.length} audit events.`,
        sources
      },
      {
        step: "generation",
        summary: `Generated source-backed answer with ${generated.model}.`,
        confidence: generated.confidence,
        sources: generated.sources
      },
      {
        step: "recall",
        summary: memoryPersisted
          ? "Persisted org-scoped Munin recall memory."
          : "Prepared org-scoped Munin recall memory draft for persistence.",
        sources: sourceRefs.map((ref) => ref.sourceId)
      }
    ],
    munin: {
      retrieved: memories.map((memory) => ({
        id: memory.id,
        agentScope: memory.agentScope,
        content: memory.content,
        retrievalScore: memory.retrievalScore
      })),
      recallDraft: {
        id: recallDraft.id,
        orgId: recallDraft.orgId,
        agentScope: recallDraft.agentScope,
        content: recallDraft.content,
        sourceRefs: recallDraft.sourceRefs
      },
      persisted: memoryPersisted
    },
    context: {
      source:
        alertsResult.source === "supabase" ||
        entitiesResult.source === "supabase" ||
        signalsResult.source === "supabase" ||
        auditResult.source === "supabase"
          ? "supabase"
          : "fallback",
      alerts: alertsResult.alerts.length,
      entities: entitiesResult.entities.length,
      signals: signalsResult.signals.length,
      auditEvents: auditResult.auditEvents.length
    }
  };
}

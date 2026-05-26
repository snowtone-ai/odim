import { generateAnswer, type GenerateResponse } from "../ai/provider.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import { buildRecallMemoryDraft, searchMuninMemory, toMuninMemoryRow, type MuninMemory, type MuninOpinion, type RetrievedMemory } from "../munin/memory.ts";
import { writeGate } from "../munin/write-gate.ts";
import type { SourceRef } from "../pipeline/types.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import { cascadeSearch, type CascadeEvidence } from "./cascade.ts";
import { logHuginnEval } from "./eval-log.ts";
import { outcomesGrader, writeSycophancyAuditEvent } from "./grader.ts";
import { assessQuery, type SelfAssessmentPlan } from "./self-assessment.ts";

export type ReasoningTraceStep = {
  step: "scope" | "self_assessment" | "memory" | "cascade" | "ontology" | "generation" | "grader" | "eval" | "recall";
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
    counts: {
      fact: number;
      procedure: number;
      seed: number;
      opinions: number;
    };
  };
  context: {
    source: "fallback" | "supabase";
    alerts: number;
    entities: number;
    signals: number;
    auditEvents: number;
  };
  retrieval_layers_used: string[];
  eval_log_id: string;
  selfAssessmentPlan: SelfAssessmentPlan;
  graderScore?: number;
  graderFlags?: string[];
  rds?: number;
  narrativeContrast: Array<{ title: string; content: string; sourceType: "web_narrative" }>;
};

export type HuginnQuestionInput = {
  orgId: string;
  question: string;
  userId?: string;
  memories?: MuninMemory[];
  opinions?: MuninOpinion[];
  generate?: typeof generateAnswer;
  /** Internal flag: prevent recursive sycophancy suppression */
  suppressSycophancy?: boolean;
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

function buildSourceRefs(evidence: CascadeEvidence[]) {
  const refs = evidence.flatMap((item) => item.sourceRefs.length ? item.sourceRefs : [sourceRef(item.sourceType, item.content.slice(0, 80))]);
  return refs.filter((ref, index, all) => all.findIndex((candidate) => candidate.sourceId === ref.sourceId) === index);
}

function formatContext(input: {
  orgId: string;
  question: string;
  evidence: CascadeEvidence[];
  opinions: MuninOpinion[];
  plan: SelfAssessmentPlan;
}) {
  const memoryLines = input.evidence
    .filter((item) => item.layer === "munin_core" || item.layer === "munin_archival")
    .map((item) => `- [${item.layer} ${item.confidence}] ${item.content}`)
    .join("\n");
  const evidenceLines = input.evidence
    .filter((item) => item.layer !== "munin_core" && item.layer !== "munin_archival" && !item.isNarrative)
    .map((item) => `- [${item.layer}/${item.sourceType}] ${item.content}; confidence=${item.confidence}`)
    .join("\n");
  const opinionLines = input.opinions
    .map((opinion) => `- [opinion ${opinion.isSeed ? "seed" : "past"}] ${opinion.content}`)
    .join("\n");

  return [
    `org_id=${input.orgId}`,
    "Rules: use only source-backed Reality/Ontology/Audit evidence visible to this org. Narrative is a trigger, not truth. Do not predict prices. Include confidence and sources.",
    `Question: ${input.question}`,
    `Self-assessment: need_retrieval=${input.plan.need_retrieval}; confidence_without_retrieval=${input.plan.confidence_without_retrieval}; uses_past_opinion=${input.plan.uses_past_opinion}`,
    "Munin memory:",
    memoryLines || "- none",
    "Reality/Odim evidence:",
    evidenceLines || "- none",
    "Past opinions (only because uses_past_opinion=true):",
    input.plan.uses_past_opinion ? opinionLines || "- none" : "- excluded by default"
  ].join("\n");
}

export async function answerHuginnQuestion(input: HuginnQuestionInput): Promise<HuginnResponse> {
  if (!input.orgId) throw new Error("orgId is required for Huginn queries");
  if (!input.question.trim()) throw new Error("question is required for Huginn queries");

  const coreMemories = searchMuninMemory({
    orgId: input.orgId,
    question: input.question,
    memories: input.memories,
    topK: 4
  });
  const plan = await assessQuery({ question: input.question, orgId: input.orgId, coreMemory: coreMemories });
  const cascade = await cascadeSearch({
    orgId: input.orgId,
    question: input.question,
    plan,
    memories: input.memories,
    opinions: input.opinions
  });
  const evidence = cascade.evidence;
  const precomputedAnswer = cascade.precomputed?.answer;
  const context = formatContext({
    orgId: input.orgId,
    question: input.question,
    evidence,
    opinions: cascade.opinions,
    plan
  });

  const antiSycophancyPrefix = input.suppressSycophancy
    ? "SYSTEM: Be direct and honest. Do not tell the user what they want to hear. Prioritize accuracy and completeness over agreeableness. If evidence is absent, say so.\n\n"
    : "";

  const generated = precomputedAnswer
    ? {
        answer: precomputedAnswer,
        model: "pre_computed_answers",
        confidence: cascade.precomputed?.confidence ?? 0.7,
        sources: ["pre_computed_answers"]
      }
    : await (input.generate ?? generateAnswer)({
        question: input.question,
        context: antiSycophancyPrefix + context,
        orgId: input.orgId
      });
  const sourceRefs = buildSourceRefs(evidence);
  const sources = unique([
    ...generated.sources,
    ...evidence.flatMap((item) => item.sourceRefs.map((ref) => ref.sourceId))
  ]);
  const confidenceValues = [
    generated.confidence,
    ...evidence.map((item) => item.confidence)
  ].filter((value) => Number.isFinite(value));
  const confidence =
    Math.round((confidenceValues.reduce((sum, value) => sum + value, 0) / Math.max(1, confidenceValues.length)) * 100) /
    100;
  // Grade FIRST — so sycophantic answers are never persisted to Munin
  const grader = await outcomesGrader({ question: input.question, answer: generated.answer });
  await writeSycophancyAuditEvent({
    orgId: input.orgId,
    question: input.question,
    answer: generated.answer,
    flags: grader.flags
  });

  // Sycophancy suppression: recurse before persisting any memory
  if (grader.flags.includes("sycophancy_suspected") && !input.suppressSycophancy) {
    return answerHuginnQuestion({ ...input, suppressSycophancy: true });
  }

  // Persist memory only for the adopted (non-sycophantic) answer
  const recallDraft = buildRecallMemoryDraft({
    orgId: input.orgId,
    userId: input.userId,
    question: input.question,
    answer: generated.answer,
    sourceRefs
  });
  let memoryPersisted = false;
  const recallGate = writeGate({
    orgId: input.orgId,
    userId: input.userId,
    content: recallDraft.content,
    sourceType: "huginn_inference",
    memoryClass: "fact",
    certainty: generated.confidence,
    novelty: 0.7,
    reliability: 0.8
  });
  if (hasSupabaseWriteEnv()) {
    if (recallGate.action === "WRITTEN_TO_MEMORY") {
      recallDraft.status = recallGate.status ?? "active";
      recallDraft.salienceScore = recallGate.salienceScore;
      const { error } = await createServiceSupabaseClient()
        .from("munin_memory")
        .upsert(toMuninMemoryRow(recallDraft), { onConflict: "id" });
      if (error) {
        if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`Munin recall write failed: ${error.message}`);
      } else {
        memoryPersisted = true;
      }
    }
  }

  const evalLogId = await logHuginnEval({
    orgId: input.orgId,
    question: input.question,
    answer: generated.answer,
    plan,
    retrieval_layers_used: cascade.layers_used,
    sources_count: sources.length,
    grader_score: grader.score,
    grader_flags: grader.flags
  });

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
        step: "self_assessment",
        summary: `Planner selected retrieval=${plan.need_retrieval}, gapfill=${plan.needs_reality_gapfill}, narrative_capture=${plan.needs_narrative_capture}, past_opinion=${plan.uses_past_opinion}.`,
        confidence: plan.confidence_without_retrieval
      },
      {
        step: "memory",
        summary: `Retrieved ${cascade.contextCounts.fact} fact, ${cascade.contextCounts.procedure} procedure, and ${cascade.contextCounts.seed} seed Munin memories; opinions=${cascade.contextCounts.opinions}.`,
        sources: unique(evidence.filter((item) => item.layer.startsWith("munin")).flatMap((item) => item.sourceRefs.map((ref) => ref.sourceId)))
      },
      {
        step: "cascade",
        summary: `Cascade layers used: ${cascade.layers_used.join(", ") || "none"}.`,
        sources
      },
      {
        step: "ontology",
        summary: `Loaded ${cascade.contextCounts.entities} entities, ${cascade.contextCounts.signals} signals, ${cascade.contextCounts.alerts} alerts, and ${cascade.contextCounts.auditEvents} audit events.`,
        sources
      },
      {
        step: "generation",
        summary: `Generated source-backed answer with ${generated.model}.`,
        confidence: generated.confidence,
        sources: generated.sources
      },
      {
        step: "grader",
        summary: `Outcomes grader score ${grader.score}; flags=${grader.flags.join(", ") || "none"}.`,
        confidence: grader.score
      },
      {
        step: "eval",
        summary: `Logged Huginn eval row ${evalLogId}.`
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
      retrieved: coreMemories.map((memory) => ({
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
      persisted: memoryPersisted,
      counts: {
        fact: cascade.contextCounts.fact,
        procedure: cascade.contextCounts.procedure,
        seed: cascade.contextCounts.seed,
        opinions: cascade.contextCounts.opinions
      }
    },
    context: {
      source: cascade.contextSource,
      alerts: cascade.contextCounts.alerts,
      entities: cascade.contextCounts.entities,
      signals: cascade.contextCounts.signals,
      auditEvents: cascade.contextCounts.auditEvents
    },
    retrieval_layers_used: cascade.layers_used,
    eval_log_id: evalLogId,
    selfAssessmentPlan: plan,
    graderScore: grader.score,
    graderFlags: grader.flags,
    rds: cascade.rds,
    narrativeContrast: cascade.narrative.map((item) => ({
      title: item.title,
      content: item.content,
      sourceType: item.sourceType
    }))
  };
}

import { generateGraderAssessment } from "../ai/provider.ts";
import type { GenerateRuntimeOptions } from "../ai/provider.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import { createHash } from "node:crypto";

export type GraderFlag = "sycophancy_suspected" | "narrative_as_evidence" | "missing_sources" | "no_uncertainty";

export type OutcomesGraderResult = {
  score: number;
  flags: GraderFlag[];
};

const allowedFlags = new Set<GraderFlag>(["sycophancy_suspected", "narrative_as_evidence", "missing_sources", "no_uncertainty"]);

export async function outcomesGrader(input: { question: string; answer: string; orgId?: string }, options: GenerateRuntimeOptions = {}): Promise<OutcomesGraderResult> {
  if (process.env.GRADER_ENABLED !== "true" && (process.env.AI_PROVIDER ?? "mock") !== "mock") return { score: 0.8, flags: [] };
  const result = await generateGraderAssessment({ question: input.question, answer: input.answer, orgId: input.orgId }, options);
  return {
    score: Math.max(0, Math.min(1, Number(result.overall_score) || 0)),
    flags: (Array.isArray(result.flags) ? result.flags : []).filter((flag): flag is GraderFlag => allowedFlags.has(flag as GraderFlag))
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function writeSycophancyAuditEvent(input: { orgId: string; question: string; answer: string; flags: string[]; runId?: string; signal?: AbortSignal }) {
  if (!input.flags.includes("sycophancy_suspected") || !hasSupabaseWriteEnv()) return;
  if (input.signal?.aborted) return;
  const request = createServiceSupabaseClient().from("audit_log").insert({
    event_type: "huginn_grader_flag",
    org_id: input.orgId,
    actor: "outcomes_grader",
    detail: {
      questionHash: sha256(input.question),
      answerHash: sha256(input.answer),
      questionLength: input.question.length,
      answerLength: input.answer.length,
      flags: input.flags,
      runId: input.runId ?? null
    },
    confidence: 0.8,
    source_refs: []
  });
  if (input.signal) request.abortSignal(input.signal);
  await request;
}

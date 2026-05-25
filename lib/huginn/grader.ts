import { generateGraderAssessment } from "../ai/provider.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";

export type GraderFlag = "sycophancy_suspected" | "narrative_as_evidence" | "missing_sources" | "no_uncertainty";

export type OutcomesGraderResult = {
  score: number;
  flags: GraderFlag[];
};

const allowedFlags = new Set<GraderFlag>(["sycophancy_suspected", "narrative_as_evidence", "missing_sources", "no_uncertainty"]);

export async function outcomesGrader(input: { question: string; answer: string }): Promise<OutcomesGraderResult> {
  if (process.env.GRADER_ENABLED !== "true" && (process.env.AI_PROVIDER ?? "mock") !== "mock") return { score: 0.8, flags: [] };
  const result = await generateGraderAssessment({ question: input.question, answer: input.answer });
  return {
    score: Math.max(0, Math.min(1, Number(result.overall_score) || 0)),
    flags: (Array.isArray(result.flags) ? result.flags : []).filter((flag): flag is GraderFlag => allowedFlags.has(flag as GraderFlag))
  };
}

export async function writeSycophancyAuditEvent(input: { orgId: string; question: string; answer: string; flags: string[] }) {
  if (!input.flags.includes("sycophancy_suspected") || !hasSupabaseWriteEnv()) return;
  await createServiceSupabaseClient().from("audit_log").insert({
    event_type: "huginn_grader_flag",
    org_id: input.orgId,
    actor: "outcomes_grader",
    detail: { question: input.question, answer: input.answer, flags: input.flags },
    confidence: 0.8,
    source_refs: []
  });
}

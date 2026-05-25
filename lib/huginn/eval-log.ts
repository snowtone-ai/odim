import { isProductionRuntime } from "../env/runtime.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import type { SelfAssessmentPlan } from "./self-assessment.ts";

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the table|relation .* does not exist/i.test(message);
}

export async function logHuginnEval(input: {
  orgId: string;
  question: string;
  answer: string;
  plan: SelfAssessmentPlan;
  retrieval_layers_used: string[];
  sources_count: number;
  grader_score?: number | null;
  grader_flags?: string[] | null;
}) {
  const id = deterministicUuid("huginn_eval_log", {
    orgId: input.orgId,
    question: input.question,
    answer: input.answer,
    createdAtBucket: new Date().toISOString().slice(0, 16)
  });
  if (!hasSupabaseWriteEnv()) {
    console.info("huginn_eval_log fallback", { id, orgId: input.orgId, sources_count: input.sources_count });
    return id;
  }
  const { error } = await createServiceSupabaseClient().from("huginn_eval_log").upsert(
    {
      id,
      org_id: input.orgId,
      question: input.question,
      answer: input.answer,
      plan: input.plan,
      retrieval_layers_used: input.retrieval_layers_used,
      sources_count: input.sources_count,
      grader_score: input.grader_score ?? null,
      grader_flags: input.grader_flags ?? null,
      user_rating: null,
      user_note: null
    },
    { onConflict: "id" }
  );
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return id;
    throw new Error(`huginn eval log write failed: ${error.message}`);
  }
  return id;
}

export async function updateHuginnEvalRating(input: {
  orgId: string;
  evalLogId: string;
  userRating: number;
  userNote?: string;
}) {
  if (input.userRating < 1 || input.userRating > 5) throw new Error("user_rating must be 1-5");
  if (!hasSupabaseWriteEnv()) return { id: input.evalLogId, source: "fallback" as const };
  const { error } = await createServiceSupabaseClient()
    .from("huginn_eval_log")
    .update({ user_rating: input.userRating, user_note: input.userNote ?? null })
    .eq("id", input.evalLogId)
    .eq("org_id", input.orgId);
  if (error) throw new Error(`huginn eval rating update failed: ${error.message}`);
  return { id: input.evalLogId, source: "supabase" as const };
}

import { isProductionRuntime } from "../env/runtime.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import type { SelfAssessmentPlan } from "./self-assessment.ts";
import { createHash } from "node:crypto";

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the table|relation .* does not exist/i.test(message);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
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
  signal?: AbortSignal;
}) {
  if (input.signal?.aborted) return deterministicUuid("huginn_eval_log", { orgId: input.orgId, questionHash: sha256(input.question), answerHash: sha256(input.answer), createdAtBucket: new Date().toISOString().slice(0, 16) });
  const questionHash = sha256(input.question);
  const answerHash = sha256(input.answer);
  const id = deterministicUuid("huginn_eval_log", {
    orgId: input.orgId,
    questionHash,
    answerHash,
    createdAtBucket: new Date().toISOString().slice(0, 16)
  });
  if (!hasSupabaseWriteEnv()) {
    console.info("huginn_eval_log fallback", { id, orgId: input.orgId, sources_count: input.sources_count });
    return id;
  }
  const request = createServiceSupabaseClient().from("huginn_eval_log").upsert(
    {
      id,
      org_id: input.orgId,
      // Legacy columns are non-null, so retain a stable placeholder until an
      // append-only migration provides dedicated hash/metadata columns.
      question: "[redacted]",
      answer: "[redacted]",
      plan: {
        ...input.plan,
        privacy: {
          version: "huginn-eval-v3",
          questionHash,
          answerHash,
          questionLength: input.question.length,
          answerLength: input.answer.length
        }
      },
      retrieval_layers_used: input.retrieval_layers_used,
      sources_count: input.sources_count,
      grader_score: input.grader_score ?? null,
      grader_flags: input.grader_flags ?? null,
      user_rating: null,
      user_note: null
    },
    { onConflict: "id" }
  );
  if (input.signal) request.abortSignal(input.signal);
  const { error } = await request;
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return id;
    throw new Error("huginn eval log write failed");
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
  if (error) throw new Error("huginn eval rating update failed");
  return { id: input.evalLogId, source: "supabase" as const };
}

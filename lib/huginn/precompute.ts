import { isProductionRuntime } from "../env/runtime.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import type { SourceRef } from "../pipeline/types.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";

export type PrecomputedAnswer = {
  id: string;
  orgId: string;
  questionPattern: string;
  answer: string;
  evidenceSnapshot: SourceRef[];
  confidence: number;
  computedAt: string;
  expiresAt: string;
  status: "active" | "invalidated";
};

function isObservedBy(answer: PrecomputedAnswer, now: Date) {
  const computedAt = Date.parse(answer.computedAt);
  if (!Number.isFinite(computedAt) || computedAt > now.valueOf()) return false;
  return answer.evidenceSnapshot.every((ref) => {
    const observedAt = Date.parse(ref.observedAt ?? "");
    return Number.isFinite(observedAt) && observedAt <= now.valueOf();
  });
}

const precomputedAnswers = new Map<string, PrecomputedAnswer[]>();

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the table|relation .* does not exist|column .* does not exist/i.test(message);
}

function isStrictPrecomputeRuntime() {
  return isProductionRuntime() || process.env.REPOSITORY_SUPABASE_STRICT === "true";
}

function tokenize(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((token) => token.length > 2));
}

function overlap(left: string, right: string) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  return [...leftTokens].filter((token) => rightTokens.has(token)).length / Math.sqrt(leftTokens.size * rightTokens.size);
}

function toRow(answer: PrecomputedAnswer) {
  return {
    id: answer.id,
    org_id: answer.orgId,
    question_pattern: answer.questionPattern,
    answer: answer.answer,
    evidence_snapshot: answer.evidenceSnapshot,
    confidence: answer.confidence,
    computed_at: answer.computedAt,
    expires_at: answer.expiresAt,
    status: answer.status
  };
}

function fromRow(row: Record<string, unknown>): PrecomputedAnswer {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    questionPattern: String(row.question_pattern),
    answer: String(row.answer),
    evidenceSnapshot: Array.isArray(row.evidence_snapshot) ? (row.evidence_snapshot as SourceRef[]) : [],
    confidence: Number(row.confidence ?? 0),
    computedAt: String(row.computed_at),
    expiresAt: String(row.expires_at),
    status: row.status === "invalidated" ? "invalidated" : "active"
  };
}

function seedPrecomputedAnswerInMemory(answer: Omit<PrecomputedAnswer, "id">) {
  const id = deterministicUuid("pre_computed_answers", answer);
  const next = { ...answer, id };
  const rows = (precomputedAnswers.get(answer.orgId) ?? []).filter((row) => row.id !== id);
  rows.push(next);
  precomputedAnswers.set(answer.orgId, rows);
  return next;
}

export async function seedPrecomputedAnswer(answer: Omit<PrecomputedAnswer, "id">) {
  const next = seedPrecomputedAnswerInMemory(answer);
  if (!hasSupabaseWriteEnv()) return next;

  const { error } = await createServiceSupabaseClient()
    .from("pre_computed_answers")
    .upsert(toRow(next), { onConflict: "id" });
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return next;
    throw new Error("precomputed answer write failed");
  }
  return next;
}

function ensureFixtureSeed(orgId: string) {
  if (precomputedAnswers.has(orgId)) return;
  seedPrecomputedAnswerInMemory({
    orgId,
    questionPattern: "source backed capital commitment",
    answer: "Precomputed fixture: source-backed capital commitment evidence is available in the Reality cache.",
    evidenceSnapshot: [],
    confidence: 0.72,
    computedAt: new Date(0).toISOString(),
    expiresAt: "2099-01-01T00:00:00.000Z",
    status: "active"
  });
}

function findInMemory(input: { orgId: string; question: string; now: Date }) {
  ensureFixtureSeed(input.orgId);
  return (precomputedAnswers.get(input.orgId) ?? [])
    .filter((answer) => answer.status === "active" && new Date(answer.expiresAt) > input.now && answer.confidence >= 0.7 && isObservedBy(answer, input.now))
    .map((answer) => ({ answer, score: overlap(input.question, answer.questionPattern) }))
    .filter(({ score }) => score >= 0.45)
    .sort((left, right) => right.score - left.score)[0]?.answer;
}

async function findInSupabase(input: { orgId: string; question: string; now: Date; signal?: AbortSignal }) {
  if (input.signal?.aborted) return undefined;
  const nowIso = input.now.toISOString();
  const request = createServiceSupabaseClient()
    .from("pre_computed_answers")
    .select("id, org_id, question_pattern, answer, evidence_snapshot, confidence, computed_at, expires_at, status")
    .eq("org_id", input.orgId)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    // Prevent future-computed rows from consuming the result limit before
    // the application-level evidence snapshot guard runs.
    .lte("computed_at", nowIso)
    .gte("confidence", 0.7)
    .limit(50);
  if (input.signal) request.abortSignal(input.signal);
  const { data, error } = await request;
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return undefined;
    throw new Error("precomputed answer read failed");
  }
  return (data ?? [])
    .map((row) => fromRow(row as Record<string, unknown>))
    .filter((answer) => answer.orgId === input.orgId)
    .filter((answer) => isObservedBy(answer, input.now))
    .map((answer) => ({ answer, score: overlap(input.question, answer.questionPattern) }))
    .filter(({ score }) => score >= 0.45)
    .sort((left, right) => right.score - left.score)[0]?.answer;
}

export async function findPrecomputedAnswer(input: { orgId: string; question: string; now?: Date; signal?: AbortSignal }) {
  if (process.env.SLEEP_COMPUTE_ENABLED !== "true") return undefined;
  const now = input.now ?? new Date();
  if (input.signal?.aborted) return undefined;
  if (hasSupabaseWriteEnv()) {
    const persisted = await findInSupabase({ ...input, now });
    if (input.signal?.aborted) return undefined;
    if (persisted) return persisted;
    // A configured Supabase store is authoritative. Never fall through to a
    // process-local cache in production/strict mode, even when the DB simply
    // has no matching row; that cache is not tenant- or deployment-durable.
    if (isStrictPrecomputeRuntime()) return undefined;
  } else if (isStrictPrecomputeRuntime()) {
    // Production/strict retrieval must never silently consult the process-local
    // fixture cache when the Supabase precompute store is unavailable. An
    // absent cache is safe; an unverified fixture hit is not.
    throw new Error("precomputed answer store unavailable");
  }
  if (input.signal?.aborted) return undefined;
  return findInMemory({ ...input, now });
}

async function invalidatePersistedPrecomputedAnswers(input: { orgId: string; content: string }) {
  if (!hasSupabaseWriteEnv()) return;
  const { data, error } = await createServiceSupabaseClient()
    .from("pre_computed_answers")
    .select("id, question_pattern")
    .eq("org_id", input.orgId)
    .eq("status", "active")
    .limit(100);
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return;
    throw new Error("precomputed answer invalidation read failed");
  }
  const ids = (data ?? [])
    .filter((row) => overlap(String(row.question_pattern), input.content) > 0.2)
    .map((row) => String(row.id));
  if (!ids.length) return;
  const update = await createServiceSupabaseClient()
    .from("pre_computed_answers")
    .update({ status: "invalidated" })
    .in("id", ids)
    .eq("org_id", input.orgId);
  if (update.error) {
    if (shouldFallbackFromSupabaseError(update.error.message)) return;
    throw new Error("precomputed answer invalidation failed");
  }
}

export function invalidatePrecomputedAnswers(input: { orgId: string; content: string }) {
  const rows = precomputedAnswers.get(input.orgId) ?? [];
  for (const row of rows) {
    if (overlap(row.questionPattern, input.content) > 0.2) row.status = "invalidated";
  }
  void invalidatePersistedPrecomputedAnswers(input).catch(() => {
    console.warn("precomputed answer invalidation failed");
  });
}

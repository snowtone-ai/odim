import { writeGate } from "../munin/write-gate.ts";
import type { SourceRef } from "../pipeline/types.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import { createHash } from "node:crypto";

export type NarrativeCaptureResult = {
  id: string;
  title: string;
  url: string;
  content: string;
  sentiment: "bullish" | "bearish" | "mixed";
  sourceType: "web_narrative";
  sourceRefs: SourceRef[];
};

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the table|relation .* does not exist|column .* does not exist/i.test(message);
}

async function persistNarrativeSignal(input: { orgId: string; question: string; result: NarrativeCaptureResult; signal?: AbortSignal }) {
  if (!hasSupabaseWriteEnv()) return;
  if (input.signal?.aborted) return;
  const fingerprint = deterministicUuid("raw_signals:narrative_capture", {
    orgId: input.orgId,
    url: input.result.url,
    question: input.question
  });
  const request = createServiceSupabaseClient()
    .from("raw_signals")
    .upsert(
      {
        id: deterministicUuid("raw_signals", { fingerprint }),
        layer: "narrative",
        source: "narrative_capture",
        external_id: input.result.url,
        fingerprint,
        payload: {
          title: input.result.title,
          url: input.result.url,
          contentHash: createHash("sha256").update(input.result.content).digest("hex"),
          contentLength: input.result.content.length,
          sentiment: input.result.sentiment,
          questionHash: createHash("sha256").update(input.question).digest("hex"),
          questionLength: input.question.length,
          source_type: input.result.sourceType
        },
        source_refs: input.result.sourceRefs,
        org_id: input.orgId,
        freshness: 1,
        is_proprietary: true,
        observed_at: new Date().toISOString()
      },
      { onConflict: "fingerprint" }
    );
  if (input.signal) request.abortSignal(input.signal);
  const { error } = await request;
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return;
    throw new Error(`narrative capture persistence failed: ${error.message}`);
  }
}

export async function narrativeCaptureSearch(input: { orgId: string; question: string; signal?: AbortSignal }): Promise<NarrativeCaptureResult[]> {
  if (process.env.NARRATIVE_CAPTURE_ENABLED !== "true" && (process.env.AI_PROVIDER ?? "mock") !== "mock") return [];
  if (input.signal?.aborted) return [];
  const result: NarrativeCaptureResult = {
    id: "narrative:fixture",
    title: "Fixture market narrative",
    url: "https://example.com/market-narrative",
    content: `Market narrative fixture for contrast only: ${input.question}`,
    sentiment: "mixed",
    sourceType: "web_narrative",
    sourceRefs: [
      {
        sourceId: "narrative-rss",
        url: "https://example.com/market-narrative",
        title: "Fixture market narrative",
        observedAt: new Date(0).toISOString()
      }
    ]
  };
  const gated = writeGate({
    orgId: input.orgId,
    content: result.content,
    sourceType: "web_narrative",
    memoryClass: "fact"
  });
  if (gated.action !== "REJECTED_FROM_MEMORY") throw new Error("web_narrative must be rejected from munin_memory");
  if (input.signal?.aborted) return [];
  await persistNarrativeSignal({ orgId: input.orgId, question: input.question, result, signal: input.signal });
  if (input.signal?.aborted) return [];
  return [result];
}

export function computeRDS(realityEvidence: Array<{ confidence?: number; content?: string }>, narrativeResults: NarrativeCaptureResult[]) {
  if (!narrativeResults.length) return undefined;
  const confidence = realityEvidence.reduce((sum, item) => sum + (item.confidence ?? 0.5), 0) / Math.max(1, realityEvidence.length);
  const mixedNarrativePenalty = narrativeResults.some((item) => item.sentiment === "mixed") ? 0.15 : 0.25;
  return Math.max(0, Math.min(1, Math.round((1 - confidence + mixedNarrativePenalty) * 100) / 100));
}

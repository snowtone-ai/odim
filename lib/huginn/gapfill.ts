import { writeGate } from "../munin/write-gate.ts";
import type { SourceRef } from "../pipeline/types.ts";
import type { SourceType } from "../munin/types.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import { toMuninMemoryRow, type MuninMemory } from "../munin/memory.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";

export type GapfillResult = {
  id: string;
  title: string;
  url: string;
  domain: string;
  sourceType: Extract<SourceType, "primary_filing" | "official_ir">;
  content: string;
  confidence: number;
  sourceRefs: SourceRef[];
};

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the table|relation .* does not exist|column .* does not exist/i.test(message);
}

function hostFor(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

export function isAllowedGapfillUrl(url: string, allowedDomains: string[]) {
  const host = hostFor(url);
  return allowedDomains.some((domain) => {
    const normalized = hostFor(domain).replace(/^www\./, "");
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

export async function realityGapfillSearch(input: {
  orgId: string;
  question: string;
  allowedDomains: string[];
}): Promise<GapfillResult[]> {
  if (process.env.GAPFILL_ENABLED !== "true" && (process.env.AI_PROVIDER ?? "mock") !== "mock") return [];
  const fixtureUrl = "https://elibrary.ferc.gov/eLibrary/search";
  const fixture: GapfillResult = {
    id: "gapfill:ferc:fixture",
    title: "FERC eLibrary fixture filing match",
    url: fixtureUrl,
    domain: "elibrary.ferc.gov",
    sourceType: "primary_filing",
    content: `FERC fixture filing evidence matching query: ${input.question}`,
    confidence: 0.82,
    sourceRefs: [
      {
        sourceId: "ferc-elibrary",
        url: fixtureUrl,
        title: "FERC eLibrary fixture filing match",
        observedAt: new Date(0).toISOString()
      }
    ]
  };
  const results = [fixture].filter((result) => isAllowedGapfillUrl(result.url, input.allowedDomains));
  for (const result of results) {
    const gated = writeGate({
      orgId: input.orgId,
      content: result.content,
      sourceType: result.sourceType,
      memoryClass: "fact",
      novelty: 0.8,
      reliability: 0.95,
      certainty: result.confidence
    });
    if (gated.action !== "WRITTEN_TO_MEMORY") throw new Error("reality gapfill result failed writeGate memory route");
    if (hasSupabaseWriteEnv()) {
      const now = new Date().toISOString();
      const memory: MuninMemory = {
        id: deterministicUuid("munin_gapfill_memory", { orgId: input.orgId, resultId: result.id, content: result.content }),
        orgId: input.orgId,
        agentScope: "archival",
        memoryClass: "fact",
        sourceType: result.sourceType,
        content: result.content,
        salienceScore: gated.salienceScore,
        importance: result.confidence,
        decayScore: 1,
        isSeed: false,
        status: gated.status ?? "active",
        linkedMemoryIds: [],
        sourceRefs: result.sourceRefs,
        validFrom: now,
        validTo: null,
        createdAt: now,
        lastAccessedAt: now
      };
      const { error } = await createServiceSupabaseClient()
        .from("munin_memory")
        .upsert(toMuninMemoryRow(memory), { onConflict: "id" });
      if (error) {
        if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`reality gapfill persistence failed: ${error.message}`);
      }
    }
  }
  return results;
}

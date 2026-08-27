import { writeGate } from "../munin/write-gate.ts";
import type { SourceRef } from "../pipeline/types.ts";
import type { SourceType } from "../munin/types.ts";
import { buildMemoryProposal, persistMemoryProposal } from "../munin/proposals.ts";

export type GapfillResult = {
  id: string;
  title: string;
  url: string;
  domain: string;
  sourceType: Extract<SourceType, "primary_filing" | "official_ir">;
  content: string;
  confidence: number;
  sourceRefs: SourceRef[];
  /** Additive v3 metadata; the result remains usable as transient evidence. */
  reviewStatus?: "pending_review";
  proposalId?: string;
};

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
  signal?: AbortSignal;
}): Promise<GapfillResult[]> {
  if (process.env.GAPFILL_ENABLED !== "true" && (process.env.AI_PROVIDER ?? "mock") !== "mock") return [];
  if (input.signal?.aborted) return [];
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
  const persistedResults: GapfillResult[] = [];
  for (const result of results) {
    if (input.signal?.aborted) return persistedResults;
    const gated = writeGate({
      orgId: input.orgId,
      content: result.content,
      sourceType: result.sourceType,
      memoryClass: "fact",
      novelty: 0.8,
      reliability: 0.95,
      certainty: result.confidence,
      reviewStatus: "pending_review"
    });
    if (gated.action !== "WRITTEN_TO_MEMORY") throw new Error("reality gapfill result failed writeGate memory route");
    const proposal = buildMemoryProposal({
      orgId: input.orgId,
      content: result.content,
      sourceType: result.sourceType,
      memoryClass: "fact",
      agentScope: "archival",
      novelty: 0.8,
      reliability: 0.95,
      certainty: result.confidence,
      sourceRefs: result.sourceRefs,
      observedAt: result.sourceRefs.find((source) => source.observedAt)?.observedAt,
      origin: "huginn_reality_gapfill"
    });
    if (proposal.reviewStatus !== "pending_review") throw new Error("reality gapfill must remain pending review");
    const persisted = await persistMemoryProposal(proposal, { signal: input.signal });
    persistedResults.push({ ...result, reviewStatus: "pending_review", proposalId: persisted.id });
  }
  return persistedResults;
}

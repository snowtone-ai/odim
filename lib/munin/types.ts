export type SourceType =
  | "primary_filing"
  | "official_ir"
  | "odim_derived"
  | "huginn_inference"
  | "user_seed"
  | "web_narrative";

export type MemoryClass = "fact" | "procedure" | "seed" | "opinion";

export type MemoryStatus = "active" | "archived" | "retired";

/**
 * Review is intentionally separate from lifecycle status.  A row can be
 * active because it is an existing v2 row while still carrying the legacy
 * `not_required` review state; newly derived rows must be approved before
 * retrieval.
 */
export type MemoryReviewStatus = "not_required" | "pending_review" | "approved" | "rejected";

export type AgentScope = "core" | "archival" | "recall";

export type WriteGateAction = "WRITTEN_TO_MEMORY" | "WRITTEN_TO_OPINIONS" | "REJECTED_FROM_MEMORY";

export type WriteGateCandidate = {
  orgId: string;
  userId?: string;
  content: string;
  sourceType: SourceType;
  memoryClass: MemoryClass;
  agentScope?: AgentScope;
  isSeed?: boolean;
  novelty?: number;
  reliability?: number;
  certainty?: number;
  sourceRefs?: import("../pipeline/types.ts").SourceRef[];
  sourceHash?: string;
  observedAt?: string;
  ingestedAt?: string;
  supersedes?: string[];
  parentMemoryIds?: string[];
  reviewStatus?: MemoryReviewStatus;
  runId?: string;
};

export type WriteGateResult = {
  action: WriteGateAction;
  table: "munin_memory" | "munin_opinions" | "raw_signals";
  status?: MemoryStatus;
  salienceScore: number;
  memoryClass: MemoryClass;
  sourceType: SourceType;
  reason: string;
  reviewStatus?: MemoryReviewStatus;
};

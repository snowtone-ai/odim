export type HuginnRunPhase = "planning" | "retrieval" | "generation" | "verification" | "side_effects";

export type HuginnRunState = "received" | HuginnRunPhase | "completed" | "degraded" | "abstained" | "failed";

export type HuginnRunStatus = Extract<HuginnRunState, "completed" | "degraded" | "abstained">;

export type HuginnErrorCode =
  | "invalid_input"
  | "deadline_exceeded"
  | "aborted"
  | "unauthorized"
  | "rate_limited"
  | "provider_unavailable"
  | "retrieval_unavailable"
  | "internal";

export type HuginnPhaseTiming = {
  ms: number;
  outcome: "ok" | "skipped" | "timeout" | "error";
};

export type HuginnRunMetadata = {
  id: string;
  requestId: string;
  status: HuginnRunStatus;
  startedAt: string;
  completedAt: string;
  deadlineAt: string;
  queryHash: string;
  phaseTimings: Partial<Record<HuginnRunPhase, HuginnPhaseTiming>>;
};

export type HuginnGroundingStatus = "grounded" | "partial" | "insufficient" | "stale";

export type HuginnClaimCitation = {
  claimId: string;
  claim: string;
  sourceIds: string[];
  status: "cited" | "uncited" | "stale";
};

export type HuginnGrounding = {
  status: HuginnGroundingStatus;
  asOf: string;
  citedClaims: number;
  totalClaims: number;
  citationCoverage: number;
  reason?: "missing_citations" | "stale_citations" | "partial_citations";
};

export type HuginnSafeStatus = {
  code: "ok" | "degraded" | "abstained" | Exclude<HuginnErrorCode, "invalid_input">;
  retryable: boolean;
};

/**
 * Compatibility boundary for the forthcoming Muninn temporal API.  Huginn
 * deliberately relies on structural feature detection instead of importing an
 * unfinished repository or migration contract.
 */
export type TemporalMemoryReader<TMemory, TOpinion> = {
  search?: (input: {
    orgId: string;
    question: string;
    asOf: string;
    signal?: AbortSignal;
  }) => Promise<TMemory[]> | TMemory[];
  searchOpinions?: (input: {
    orgId: string;
    question: string;
    asOf: string;
    signal?: AbortSignal;
  }) => Promise<TOpinion[]> | TOpinion[];
};

export class HuginnExecutionError extends Error {
  readonly code: HuginnErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(input: { code: HuginnErrorCode; message: string; retryable?: boolean; cause?: unknown }) {
    super(input.message);
    this.name = "HuginnExecutionError";
    this.code = input.code;
    this.retryable = input.retryable ?? (input.code === "deadline_exceeded" || input.code === "provider_unavailable" || input.code === "retrieval_unavailable");
    this.cause = input.cause;
  }
}

import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import type { SourceRef } from "../pipeline/types.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import {
  computeSourceHash,
  normalizeMuninMemory,
  normalizeMuninOpinion,
  normalizeMuninProvenance,
  toMuninMemoryRow,
  toMuninOpinionRow,
  type MuninMemory,
  type MuninOpinion,
  type MuninProvenance
} from "./memory.ts";
import { muninSalienceThreshold, scoreSalience } from "./write-gate.ts";
import type { AgentScope, MemoryClass, MemoryStatus, SourceType, WriteGateCandidate } from "./types.ts";

export type MemoryProposalStatus = "pending_review" | "approved" | "rejected";

export type MuninMemoryProposal = {
  id: string;
  orgId: string;
  userId?: string;
  runId?: string;
  content: string;
  sourceType: SourceType;
  memoryClass: MemoryClass;
  agentScope: AgentScope;
  isSeed: boolean;
  sourceRefs: SourceRef[];
  salienceScore: number;
  memoryStatus: MemoryStatus;
  reviewStatus: MemoryProposalStatus;
  /** Alias retained for storage adapters and callers that use proposal status. */
  status: MemoryProposalStatus;
  sourceHash: string;
  observedAt: string | null;
  ingestedAt: string;
  supersedes: string[];
  parentMemoryIds: string[];
  provenance: MuninProvenance;
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
};

export type BuildMemoryProposalInput = Pick<WriteGateCandidate, "orgId" | "userId" | "content" | "sourceType" | "memoryClass"> & {
  agentScope?: AgentScope;
  isSeed?: boolean;
  novelty?: number;
  reliability?: number;
  certainty?: number;
  sourceRefs?: SourceRef[];
  sourceHash?: string;
  observedAt?: string | null;
  ingestedAt?: string;
  supersedes?: string[];
  parentMemoryIds?: string[];
  runId?: string;
  actorId?: string;
  origin?: string;
  now?: Date;
};

export type ReviewMemoryProposalInput = {
  orgId: string;
  proposalId?: string;
  proposal?: MuninMemoryProposal;
  decision: "approve" | "reject";
  reviewerId?: string;
  note?: string;
  now?: Date;
  /** Optional storage adapter for controlled retries/tests; production defaults to Muninn persistence. */
  persistRecord?: (record: MuninMemory | MuninOpinion) => Promise<void>;
};

export type ReviewMemoryProposalResult = {
  proposal: MuninMemoryProposal;
  applied: boolean;
  record?: MuninMemory | MuninOpinion;
};

const fallbackProposals = new Map<string, MuninMemoryProposal>();
const fallbackAppliedRecords = new Map<string, MuninMemory | MuninOpinion>();

function proposalKey(orgId: string, id: string) {
  return `${orgId}:${id}`;
}

function uniqueStrings(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the (?:table|function)|relation .* does not exist|function .* does not exist|column .* does not exist/i.test(message);
}

function isStrictProposalRuntime() {
  return isProductionRuntime() || process.env.REPOSITORY_SUPABASE_STRICT === "true";
}

/** Build a deterministic, non-retrievable candidate. It never writes or retires a row. */
export function buildMemoryProposal(input: BuildMemoryProposalInput): MuninMemoryProposal {
  if (!input.orgId) throw new Error("orgId is required for a Munin memory proposal");
  const content = input.content.trim();
  if (!content) throw new Error("content is required for a Munin memory proposal");
  const nowIso = (input.now ?? new Date()).toISOString();
  const sourceRefs = input.sourceRefs ?? [];
  const observedAt = input.observedAt ?? sourceRefs.find((source) => source.observedAt)?.observedAt ?? nowIso;
  const ingestedAt = input.ingestedAt ?? nowIso;
  const sourceHash = input.sourceHash ?? computeSourceHash({ sourceRefs, observedAt, content });
  const parentMemoryIds = uniqueStrings(input.parentMemoryIds);
  const supersedes = uniqueStrings(input.supersedes);
  const isSeed = input.isSeed ?? false;
  const candidate: WriteGateCandidate = {
    orgId: input.orgId,
    userId: input.userId,
    content,
    sourceType: input.sourceType,
    memoryClass: input.memoryClass,
    isSeed,
    novelty: input.novelty,
    reliability: input.reliability,
    certainty: input.certainty
  };
  const salienceScore = Math.round(scoreSalience(candidate) * 1000) / 1000;
  const rejected = input.sourceType === "web_narrative";
  const reviewStatus: MemoryProposalStatus = rejected ? "rejected" : "pending_review";
  const status: MemoryProposalStatus = reviewStatus;
  const provenance = normalizeMuninProvenance({
    content,
    sourceRefs,
    sourceHash,
    observedAt,
    ingestedAt,
    createdAt: nowIso,
    supersedes,
    parentMemoryIds,
    actorId: input.actorId,
    runId: input.runId,
    provenance: { origin: input.origin ?? "munin_memory_proposal" }
  });
  const id = deterministicUuid("munin_memory_proposal", {
    orgId: input.orgId,
    content,
    sourceHash,
    sourceType: input.sourceType,
    memoryClass: input.memoryClass,
    parentMemoryIds,
    supersedes
  });
  return {
    id,
    orgId: input.orgId,
    userId: input.userId,
    runId: input.runId,
    content,
    sourceType: input.sourceType,
    memoryClass: input.memoryClass,
    agentScope: input.agentScope ?? (input.memoryClass === "procedure" ? "core" : "archival"),
    isSeed,
    sourceRefs,
    salienceScore,
    memoryStatus: isSeed || salienceScore >= muninSalienceThreshold() ? "active" : "archived",
    reviewStatus,
    status,
    sourceHash,
    observedAt,
    ingestedAt,
    supersedes,
    parentMemoryIds,
    provenance,
    rejectionReason: rejected ? "web_narrative is structurally blocked from Munin memory" : undefined,
    createdAt: nowIso
  };
}

function toProposalRow(proposal: MuninMemoryProposal) {
  return {
    id: proposal.id,
    org_id: proposal.orgId,
    user_id: proposal.userId ?? null,
    run_id: proposal.runId ?? null,
    content: proposal.content,
    source_type: proposal.sourceType,
    memory_class: proposal.memoryClass,
    agent_scope: proposal.agentScope,
    is_seed: proposal.isSeed,
    source_refs: proposal.sourceRefs,
    salience_score: proposal.salienceScore,
    memory_status: proposal.memoryStatus,
    review_status: proposal.reviewStatus,
    status: proposal.status,
    source_hash: proposal.sourceHash,
    observed_at: proposal.observedAt,
    ingested_at: proposal.ingestedAt,
    supersedes: proposal.supersedes,
    parent_memory_ids: proposal.parentMemoryIds,
    provenance: proposal.provenance,
    rejection_reason: proposal.rejectionReason ?? null,
    reviewed_at: proposal.reviewedAt ?? null,
    reviewed_by: proposal.reviewedBy ?? null,
    review_note: proposal.reviewNote ?? null,
    created_at: proposal.createdAt
  };
}

/** Persist a proposal idempotently; fallback storage is process-local and never pretends to be durable. */
export async function persistMemoryProposal(
  proposal: MuninMemoryProposal,
  options: { signal?: AbortSignal } = {}
): Promise<MuninMemoryProposal> {
  if (options.signal?.aborted) throw new Error("Munin proposal persistence was cancelled");
  if (proposal.reviewStatus === "rejected") return proposal;
  if (!hasSupabaseWriteEnv()) {
    const key = proposalKey(proposal.orgId, proposal.id);
    // A deterministic proposal is an insert-once event. In particular, a
    // stale Dream retry must not restore a rejected/approved lifecycle state.
    if (!fallbackProposals.has(key)) fallbackProposals.set(key, proposal);
    return proposal;
  }
  const request = createServiceSupabaseClient()
    .from("munin_memory_proposals")
    .upsert(toProposalRow(proposal), { onConflict: "id", ignoreDuplicates: true });
  if (options.signal) request.abortSignal(options.signal);
  const { error } = await request;
  if (error) {
    if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`Munin proposal write failed: ${error.message}`);
    const key = proposalKey(proposal.orgId, proposal.id);
    if (!fallbackProposals.has(key)) fallbackProposals.set(key, proposal);
  }
  return proposal;
}

export async function listMemoryProposals(orgId: string): Promise<MuninMemoryProposal[]> {
  if (!orgId) throw new Error("orgId is required for Munin proposals");
  if (!hasSupabaseWriteEnv()) return [...fallbackProposals.values()].filter((proposal) => proposal.orgId === orgId);
  const { data, error } = await createServiceSupabaseClient()
    .from("munin_memory_proposals")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) {
    if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`Munin proposal read failed: ${error.message}`);
    return [...fallbackProposals.values()].filter((proposal) => proposal.orgId === orgId);
  }
  return (data ?? []).map(rowToProposal);
}

/** Return only proposals that are still waiting for an explicit reviewer decision. */
export async function listPendingMemoryProposals(orgId: string): Promise<MuninMemoryProposal[]> {
  if (!orgId) throw new Error("orgId is required for Munin proposals");
  if (!hasSupabaseWriteEnv()) {
    return [...fallbackProposals.values()].filter(
      (proposal) => proposal.orgId === orgId && proposal.reviewStatus === "pending_review"
    );
  }
  const { data, error } = await createServiceSupabaseClient()
    .from("munin_memory_proposals")
    .select("*")
    .eq("org_id", orgId)
    .eq("review_status", "pending_review")
    .order("created_at", { ascending: false });
  if (error) {
    if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`Munin proposal read failed: ${error.message}`);
    return [...fallbackProposals.values()].filter(
      (proposal) => proposal.orgId === orgId && proposal.reviewStatus === "pending_review"
    );
  }
  return (data ?? []).map(rowToProposal).filter((proposal) => proposal.reviewStatus === "pending_review");
}

function rowToProposal(row: Record<string, unknown>): MuninMemoryProposal {
  const isSeed = row.is_seed === true || row.is_seed === "true" || row.is_seed === 1;
  const sourceRefs = Array.isArray(row.source_refs) ? (row.source_refs as SourceRef[]) : [];
  const createdAt = String(row.created_at ?? new Date(0).toISOString());
  const content = String(row.content ?? "");
  const provenance = normalizeMuninProvenance({
    content,
    sourceRefs,
    provenance: (row.provenance as Partial<MuninProvenance> | undefined),
    sourceHash: row.source_hash ? String(row.source_hash) : undefined,
    observedAt: row.observed_at ? String(row.observed_at) : null,
    ingestedAt: row.ingested_at ? String(row.ingested_at) : createdAt,
    createdAt,
    supersedes: Array.isArray(row.supersedes) ? row.supersedes.map(String) : [],
    parentMemoryIds: Array.isArray(row.parent_memory_ids) ? row.parent_memory_ids.map(String) : [],
    runId: row.run_id ? String(row.run_id) : undefined
  });
  const reviewStatus = (String(row.review_status ?? row.status ?? "pending_review") as MemoryProposalStatus);
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    userId: row.user_id ? String(row.user_id) : undefined,
    runId: row.run_id ? String(row.run_id) : undefined,
    content,
    sourceType: String(row.source_type) as SourceType,
    memoryClass: String(row.memory_class) as MemoryClass,
    agentScope: String(row.agent_scope) as AgentScope,
    isSeed,
    sourceRefs,
    salienceScore: Number(row.salience_score ?? 0),
    memoryStatus: String(row.memory_status ?? "archived") as MemoryStatus,
    reviewStatus,
    status: String(row.status ?? reviewStatus) as MemoryProposalStatus,
    sourceHash: provenance.sourceHash,
    observedAt: provenance.observedAt,
    ingestedAt: provenance.ingestedAt,
    supersedes: provenance.supersedes,
    parentMemoryIds: provenance.parentMemoryIds,
    provenance,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    reviewNote: row.review_note ? String(row.review_note) : undefined,
    createdAt
  };
}

async function findProposal(input: ReviewMemoryProposalInput) {
  if (input.proposal && input.proposal.orgId !== input.orgId) {
    throw new Error("Munin proposal org isolation violation");
  }
  // A caller-supplied proposal is only a local-test/compatibility shortcut.
  // Once Supabase is configured, re-read the locked row below so a stale or
  // tampered payload cannot become the basis for an approval.
  if (input.proposal && !hasSupabaseWriteEnv()) return input.proposal;
  const proposalId = input.proposalId ?? input.proposal?.id;
  if (!proposalId) throw new Error("proposalId is required for Munin proposal review");
  const fallback = fallbackProposals.get(proposalKey(input.orgId, proposalId));
  if (fallback) return fallback;
  if (!hasSupabaseWriteEnv()) throw new Error("Munin proposal not found");
  const { data, error } = await createServiceSupabaseClient()
    .from("munin_memory_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("org_id", input.orgId)
    .maybeSingle();
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) throw new Error("Munin proposal not found");
    throw new Error(`Munin proposal read failed: ${error.message}`);
  }
  if (!data) throw new Error("Munin proposal not found");
  return rowToProposal(data as Record<string, unknown>);
}

type ProposalClaimStorage = "fallback" | "supabase";

function reviewFields(reviewStatus: MemoryProposalStatus, reviewedAt: string, reviewerId?: string, note?: string) {
  return {
    review_status: reviewStatus,
    status: reviewStatus,
    reviewed_at: reviewedAt,
    reviewed_by: reviewerId ?? null,
    review_note: note ?? null
  };
}

/** Claim a pending proposal before any retrievable record is written. */
async function claimProposal(
  input: ReviewMemoryProposalInput,
  current: MuninMemoryProposal,
  reviewed: MuninMemoryProposal
): Promise<ProposalClaimStorage> {
  const key = proposalKey(input.orgId, current.id);
  if (!hasSupabaseWriteEnv()) {
    const stored = fallbackProposals.get(key);
    if (stored && stored.reviewStatus !== "pending_review") throw new Error("Munin proposal is no longer pending review");
    fallbackProposals.set(key, reviewed);
    return "fallback";
  }

  const { data, error } = await createServiceSupabaseClient()
    .from("munin_memory_proposals")
    .update(reviewFields(reviewed.reviewStatus, reviewed.reviewedAt ?? new Date(0).toISOString(), reviewed.reviewedBy, reviewed.reviewNote))
    .eq("id", current.id)
    .eq("org_id", input.orgId)
    .eq("review_status", "pending_review")
    .select("*")
    .maybeSingle();
  if (error) {
    if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`Munin proposal review failed: ${error.message}`);
    fallbackProposals.set(key, reviewed);
    return "fallback";
  }
  if (!data) throw new Error("Munin proposal is no longer pending review");
  return "supabase";
}

async function rollbackProposalClaim(
  input: ReviewMemoryProposalInput,
  current: MuninMemoryProposal,
  reviewed: MuninMemoryProposal,
  storage: ProposalClaimStorage
) {
  if (storage === "fallback") {
    fallbackProposals.set(proposalKey(input.orgId, current.id), current);
    return;
  }
  const { error } = await createServiceSupabaseClient()
    .from("munin_memory_proposals")
    .update({ review_status: "pending_review", status: "pending_review", reviewed_at: null, reviewed_by: null, review_note: null })
    .eq("id", current.id)
    .eq("org_id", input.orgId)
    .eq("review_status", "approved")
    .eq("reviewed_at", reviewed.reviewedAt ?? "");
  if (error) throw new Error(`Munin proposal compensation failed: ${error.message}`);
}

function approvedMemoryFromProposal(proposal: MuninMemoryProposal, now: Date): MuninMemory | MuninOpinion {
  const createdAt = proposal.createdAt;
  const id = deterministicUuid(proposal.memoryClass === "opinion" ? "munin_opinions" : "munin_memory", { proposalId: proposal.id });
  const provenance = normalizeMuninProvenance({
    content: proposal.content,
    sourceRefs: proposal.sourceRefs,
    provenance: { ...proposal.provenance, origin: "approved_munin_proposal" },
    sourceHash: proposal.sourceHash,
    observedAt: proposal.observedAt,
    ingestedAt: proposal.ingestedAt,
    createdAt,
    supersedes: proposal.supersedes,
    parentMemoryIds: proposal.parentMemoryIds,
    runId: proposal.runId
  });
  if (proposal.memoryClass === "opinion") {
    return normalizeMuninOpinion({
      id,
      orgId: proposal.orgId,
      userId: proposal.userId,
      sourceType: proposal.sourceType as MuninOpinion["sourceType"],
      content: proposal.content,
      isSeed: proposal.isSeed,
      validFrom: now.toISOString(),
      validTo: null,
      createdAt,
      provenance,
      sourceHash: proposal.sourceHash,
      observedAt: proposal.observedAt,
      ingestedAt: proposal.ingestedAt,
      supersedes: proposal.supersedes,
      parentMemoryIds: proposal.parentMemoryIds,
      reviewStatus: "approved",
      runId: proposal.runId
    });
  }
  return normalizeMuninMemory({
    id,
    orgId: proposal.orgId,
    userId: proposal.userId,
    agentScope: proposal.agentScope,
    memoryClass: proposal.memoryClass as Exclude<MemoryClass, "opinion">,
    sourceType: proposal.sourceType as Exclude<SourceType, "web_narrative">,
    content: proposal.content,
    salienceScore: proposal.salienceScore,
    importance: 0.8,
    decayScore: 1,
    isSeed: proposal.isSeed,
    status: proposal.memoryStatus,
    linkedMemoryIds: proposal.parentMemoryIds,
    sourceRefs: proposal.sourceRefs,
    validFrom: now.toISOString(),
    validTo: null,
    createdAt,
    lastAccessedAt: now.toISOString(),
    provenance,
    sourceHash: proposal.sourceHash,
    observedAt: proposal.observedAt,
    ingestedAt: proposal.ingestedAt,
    supersedes: proposal.supersedes,
    parentMemoryIds: proposal.parentMemoryIds,
    reviewStatus: "approved",
    runId: proposal.runId
  });
}

async function persistApprovedRecord(record: MuninMemory | MuninOpinion) {
  if (!hasSupabaseWriteEnv()) {
    fallbackAppliedRecords.set(`${record.orgId}:${record.id}`, record);
    return;
  }
  const client = createServiceSupabaseClient();
  const { error } = "memoryClass" in record
    ? await client.from("munin_memory").upsert(toMuninMemoryRow(record), { onConflict: "id", ignoreDuplicates: true })
    : await client.from("munin_opinions").upsert(toMuninOpinionRow(record), { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`Approved Munin record write failed: ${error.message}`);
    fallbackAppliedRecords.set(`${record.orgId}:${record.id}`, record);
  }
}

function atomicRecord(record: MuninMemory | MuninOpinion) {
  return "memoryClass" in record ? toMuninMemoryRow(record) : toMuninOpinionRow(record);
}

/**
 * Production approvals use one database transaction: the RPC locks and CAS
 * claims the proposal, inserts the approved row, and updates the lifecycle
 * fields before returning. Non-production environments without migration
 * 0015 can still exercise the compatibility CAS+compensation path below.
 */
async function reviewWithAtomicRpc(input: {
  orgId: string;
  current: MuninMemoryProposal;
  reviewed: MuninMemoryProposal;
  decision: "approve" | "reject";
  record?: MuninMemory | MuninOpinion;
}) {
  const { data, error } = await createServiceSupabaseClient().rpc("munin_review_memory_proposal", {
    p_org_id: input.orgId,
    p_proposal_id: input.current.id,
    p_decision: input.decision,
    p_reviewer_id: input.reviewed.reviewedBy ?? null,
    p_review_note: input.reviewed.reviewNote ?? null,
    p_reviewed_at: input.reviewed.reviewedAt,
    p_record: input.record ? atomicRecord(input.record) : null
  });
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return undefined;
    throw new Error(`Munin proposal approval failed: ${error.message}`);
  }
  const payload = data && typeof data === "object" ? data as { applied?: unknown } : {};
  if (typeof payload.applied !== "boolean") {
    // A successful HTTP response with no RPC result is not proof that the
    // review transaction ran. Production must fail closed; local can use the
    // compatibility CAS path, which still claims before writing the record.
    if (isStrictProposalRuntime()) throw new Error("Munin proposal approval returned an invalid result");
    return undefined;
  }
  return {
    proposal: input.reviewed,
    record: input.record,
    applied: payload.applied
  } satisfies ReviewMemoryProposalResult;
}

/** Approve/reject is the only path that can turn a proposal into retrievable memory. */
export async function reviewMemoryProposal(input: ReviewMemoryProposalInput): Promise<ReviewMemoryProposalResult> {
  if (!input.orgId) throw new Error("orgId is required for Munin proposal review");
  const current = await findProposal(input);
  if (current.reviewStatus !== "pending_review") throw new Error("Munin proposal is no longer pending review");
  const reviewedAt = (input.now ?? new Date()).toISOString();
  const decisionStatus: MemoryProposalStatus = input.decision === "approve" ? "approved" : "rejected";
  const reviewed: MuninMemoryProposal = {
    ...current,
    reviewStatus: decisionStatus,
    status: decisionStatus,
    reviewedAt,
    reviewedBy: input.reviewerId,
    reviewNote: input.note
  };
  if (hasSupabaseWriteEnv()) {
    const record = input.decision === "approve" ? approvedMemoryFromProposal(current, input.now ?? new Date()) : undefined;
    const atomic = await reviewWithAtomicRpc({
      orgId: input.orgId,
      current,
      reviewed,
      decision: input.decision,
      record
    });
    if (atomic) return atomic;
  }
  const storage = await claimProposal(input, current, reviewed);
  if (input.decision === "reject") {
    return { proposal: reviewed, applied: false };
  }
  const record = approvedMemoryFromProposal(current, input.now ?? new Date());
  try {
    await (input.persistRecord ?? persistApprovedRecord)(record);
  } catch (error) {
    try {
      await rollbackProposalClaim(input, current, reviewed, storage);
    } catch (compensationError) {
      throw new Error(`Munin proposal approval failed and compensation failed: ${compensationError instanceof Error ? compensationError.message : String(compensationError)}`);
    }
    throw error;
  }
  return { proposal: reviewed, record, applied: true };
}

export function getFallbackAppliedMuninRecords(orgId: string) {
  return [...fallbackAppliedRecords.values()].filter((record) => record.orgId === orgId);
}

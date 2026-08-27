import { randomUUID } from "node:crypto";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import {
  buildFixtureMemories,
  isMemoryCurrentlyUsable,
  normalizeMuninMemory,
  type MuninMemory
} from "./memory.ts";
import {
  buildMemoryProposal,
  persistMemoryProposal,
  type MuninMemoryProposal
} from "./proposals.ts";
import {
  clusterByEmbedding,
  consolidateCluster,
  detectContradictions,
  extractRecurringPatterns
} from "./dream-phases.ts";

export type DreamRun = {
  runId: string;
  orgId: string;
  phaseSummary: Record<string, unknown>;
  diff: Record<string, unknown>;
  status: "pending_review";
  proposalIds: string[];
};

// This is intentionally process-local; the migration's run/proposal CAS is
// still the cross-instance authority. Keying by org prevents one tenant's
// scheduled run from suppressing another tenant's run.
const dreamRunningByOrg = new Set<string>();

function readFixtureSnapshot(orgId: string, memories = buildFixtureMemories(orgId), now = new Date()) {
  return memories.filter(
    (memory) =>
      memory.orgId === orgId &&
      isMemoryCurrentlyUsable({ memory, now }) &&
      !memory.isSeed &&
      (memory.memoryClass === "fact" || memory.memoryClass === "procedure")
  );
}

function boolValue(value: unknown) {
  return value === true || value === "true" || value === 1;
}

function rowToDreamMemory(row: Record<string, unknown>): MuninMemory {
  return normalizeMuninMemory({
    id: String(row.id ?? ""),
    orgId: String(row.org_id ?? ""),
    userId: row.user_id ? String(row.user_id) : undefined,
    agentScope: String(row.agent_scope ?? "archival") as MuninMemory["agentScope"],
    memoryClass: String(row.memory_class ?? "fact") as MuninMemory["memoryClass"],
    sourceType: String(row.source_type ?? "primary_filing") as MuninMemory["sourceType"],
    content: String(row.content ?? ""),
    salienceScore: Number(row.salience_score ?? 0),
    importance: Number(row.importance ?? 0),
    decayScore: Number(row.decay_score ?? 1),
    isSeed: boolValue(row.is_seed),
    status: String(row.status ?? "active") as MuninMemory["status"],
    linkedMemoryIds: Array.isArray(row.linked_memory_ids) ? row.linked_memory_ids.map(String) : [],
    sourceRefs: Array.isArray(row.source_refs) ? row.source_refs as MuninMemory["sourceRefs"] : [],
    validFrom: String(row.valid_from ?? row.created_at ?? ""),
    validTo: row.valid_to ? String(row.valid_to) : null,
    createdAt: String(row.created_at ?? ""),
    lastAccessedAt: String(row.last_accessed_at ?? row.created_at ?? ""),
    provenance: row.provenance && typeof row.provenance === "object"
      ? row.provenance as MuninMemory["provenance"]
      : undefined,
    sourceHash: row.source_hash ? String(row.source_hash) : undefined,
    observedAt: row.observed_at ? String(row.observed_at) : null,
    ingestedAt: row.ingested_at ? String(row.ingested_at) : undefined,
    supersedes: Array.isArray(row.supersedes) ? row.supersedes.map(String) : [],
    parentMemoryIds: Array.isArray(row.parent_memory_ids) ? row.parent_memory_ids.map(String) : [],
    reviewStatus: String(row.review_status ?? "not_required") as MuninMemory["reviewStatus"],
    runId: row.run_id ? String(row.run_id) : undefined
  });
}

function isDreamRowTemporallyUsable(row: Record<string, unknown>, orgId: string, nowIso: string) {
  if (String(row.org_id ?? "") !== orgId || String(row.status ?? "active") !== "active") return false;
  if (!(["approved", "not_required"] as unknown[]).includes(row.review_status ?? "not_required")) return false;
  const nowMs = Date.parse(nowIso);
  const validFrom = Date.parse(String(row.valid_from ?? ""));
  const observedAt = Date.parse(String(row.observed_at ?? ""));
  const validTo = row.valid_to == null ? null : Date.parse(String(row.valid_to));
  return Number.isFinite(nowMs) && Number.isFinite(validFrom) && validFrom <= nowMs
    && Number.isFinite(observedAt) && observedAt <= nowMs
    && (validTo === null || (Number.isFinite(validTo) && nowMs < validTo));
}

/**
 * Strict Dream reads the current tenant snapshot from Supabase. The explicit
 * temporal/review predicates are duplicated in the query and local guard so a
 * stale or malformed row cannot enter an autonomous run.
 */
export async function readMuninSnapshotFromSupabase(orgId: string, now = new Date()): Promise<MuninMemory[]> {
  if (!hasSupabaseWriteEnv()) {
    throw new Error("Munin Dream requires a Supabase service environment in strict runtime");
  }
  const nowIso = now.toISOString();
  const { data, error } = await createServiceSupabaseClient()
    .from("munin_memory")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active")
    .in("review_status", ["approved", "not_required"])
    .lte("valid_from", nowIso)
    .lte("observed_at", nowIso)
    .or(`valid_to.is.null,valid_to.gt.${nowIso}`)
    .in("memory_class", ["fact", "procedure"]);
  if (error) throw new Error(`Munin Dream memory read failed: ${error.message}`);
  return (data ?? [])
    .map((row) => row as Record<string, unknown>)
    .filter((row) => isDreamRowTemporallyUsable(row, orgId, nowIso))
    .map((row) => rowToDreamMemory(row as Record<string, unknown>))
    .filter((memory) => memory.orgId === orgId && isMemoryCurrentlyUsable({ memory, now }) && !memory.isSeed);
}

function strictDreamRuntime() {
  return isProductionRuntime() || process.env.REPOSITORY_SUPABASE_STRICT === "true";
}

function shouldFallbackFromSupabaseError(message: string) {
  if (strictDreamRuntime()) return false;
  return /schema cache|does not exist|Could not find the (?:table|function)|relation .* does not exist|function .* does not exist|column .* does not exist/i.test(message);
}

async function tryAcquireDreamLock(orgId: string, runId: string) {
  if (!hasSupabaseWriteEnv()) return undefined;
  const { data, error } = await createServiceSupabaseClient().rpc("munin_try_acquire_dream_lock", {
    p_org_id: orgId,
    p_run_id: runId,
    p_lease_seconds: 900
  });
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return undefined;
    throw new Error(`Munin Dream lock acquisition failed: ${error.message}`);
  }
  return boolValue(data);
}

async function releaseDreamLock(orgId: string, runId: string) {
  if (!hasSupabaseWriteEnv()) return;
  const { error } = await createServiceSupabaseClient().rpc("munin_release_dream_lock", {
    p_org_id: orgId,
    p_run_id: runId
  });
  if (error && !shouldFallbackFromSupabaseError(error.message)) {
    throw new Error(`Munin Dream lock release failed: ${error.message}`);
  }
}

async function recordDreamRun(run: DreamRun) {
  if (!hasSupabaseWriteEnv()) return run;
  const { error } = await createServiceSupabaseClient().from("munin_dream_runs").upsert({
    id: run.runId,
    org_id: run.orgId,
    phase_summary: run.phaseSummary,
    diff: run.diff,
    status: run.status,
    proposal_ids: run.proposalIds
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`Munin Dream run write failed: ${error.message}`);
  return run;
}

function runIdFor(orgId: string, snapshot: MuninMemory[], reason?: string) {
  return deterministicUuid("munin_dream_run", {
    orgId,
    snapshot: snapshot.map((memory) => memory.id).sort(),
    reason: reason ?? "proposal-only"
  });
}

function contradictionIds(contradictions: ReturnType<typeof detectContradictions>) {
  return new Set(contradictions.flatMap((item) => [item.left.id, item.right.id]));
}

/**
 * Dream is intentionally proposal-only in v3. It never archives inputs,
 * writes active memory, or creates precomputed answers before review.
 */
export async function dreamJob(input: { orgId: string; memories?: MuninMemory[]; now?: Date }) {
  if (!input.orgId) throw new Error("orgId is required for Munin Dream");
  const strict = strictDreamRuntime();
  if (strict && !hasSupabaseWriteEnv()) {
    throw new Error("Munin Dream is fail-closed: Supabase service environment is required");
  }
  if (dreamRunningByOrg.has(input.orgId)) {
    const run: DreamRun = {
      runId: runIdFor(input.orgId, [], "concurrent_run"),
      orgId: input.orgId,
      phaseSummary: { skipped: true, reason: "concurrent_run" },
      diff: { proposals: [], supersededByMvcc: [], precomputed: [] },
      status: "pending_review",
      proposalIds: []
    };
    return recordDreamRun(run);
  }
  dreamRunningByOrg.add(input.orgId);
  let crossProcessLockId: string | undefined;
  let crossProcessLockHeld = false;
  try {
    if (process.env.DREAM_ENABLED !== "true" && (process.env.AI_PROVIDER ?? "mock") !== "mock") {
      const run: DreamRun = {
        runId: runIdFor(input.orgId, [], "disabled"),
        orgId: input.orgId,
        phaseSummary: { skipped: true, reason: "disabled" },
        diff: { proposals: [], supersededByMvcc: [], precomputed: [] },
        status: "pending_review",
        proposalIds: []
      };
      return recordDreamRun(run);
    }

    crossProcessLockId = randomUUID();
    const acquired = await tryAcquireDreamLock(input.orgId, crossProcessLockId);
    if (acquired === false) {
      const run: DreamRun = {
        runId: runIdFor(input.orgId, [], "cross_process_run"),
        orgId: input.orgId,
        phaseSummary: { skipped: true, reason: "cross_process_run" },
        diff: { proposals: [], supersededByMvcc: [], precomputed: [] },
        status: "pending_review",
        proposalIds: []
      };
      return recordDreamRun(run);
    }
    crossProcessLockHeld = acquired === true;

    const now = input.now ?? new Date();
    const snapshot = strict
      ? await readMuninSnapshotFromSupabase(input.orgId, now)
      : input.memories
        ? readFixtureSnapshot(input.orgId, input.memories, now)
        : hasSupabaseWriteEnv()
          ? await readMuninSnapshotFromSupabase(input.orgId, now)
          : readFixtureSnapshot(input.orgId, buildFixtureMemories(input.orgId), now);
    const runId = runIdFor(input.orgId, snapshot);
    const clusters = clusterByEmbedding(snapshot);
    const contradictions = detectContradictions(snapshot);
    const conflictedIds = contradictionIds(contradictions);
    const consolidationClusters = clusters.filter(
      (cluster) => cluster.length >= 2 && !cluster.some((memory) => conflictedIds.has(memory.id))
    );
    const consolidated = consolidationClusters.map(consolidateCluster);
    const promoted = extractRecurringPatterns(snapshot).filter(
      (candidate) => !(candidate.parentMemoryIds ?? []).some((id) => conflictedIds.has(id))
    );
    const proposals: MuninMemoryProposal[] = [];

    for (const item of [
      ...consolidated.map((value, index) => ({ ...value, memoryClass: "fact" as const, parentMemoryIds: consolidationClusters[index]?.map((memory) => memory.id) ?? [] })),
      ...promoted.map((value) => ({ ...value, memoryClass: "procedure" as const }))
    ]) {
      const proposal = buildMemoryProposal({
        orgId: input.orgId,
        content: item.content,
        sourceType: "odim_derived",
        memoryClass: item.memoryClass,
        agentScope: item.memoryClass === "procedure" ? "core" : "archival",
        novelty: 0.8,
        reliability: 0.8,
        certainty: 0.75,
        sourceRefs: item.sourceRefs,
        parentMemoryIds: item.parentMemoryIds,
        runId,
        origin: "munin_dream",
        now
      });
      if (proposal.reviewStatus === "pending_review") {
        await persistMemoryProposal(proposal);
        proposals.push(proposal);
      }
    }

    const run: DreamRun = {
      runId,
      orgId: input.orgId,
      phaseSummary: {
        cluster: { clusters: clusters.length },
        consolidate: { candidates: consolidated.length, created: 0 },
        contradict: { detected: contradictions.length, unresolved: contradictions.length },
        promote: { candidates: promoted.length, created: 0 },
        proposals: { created: proposals.length, status: "pending_review" },
        preCompute: { created: 0, skipped: "approval_required" }
      },
      diff: {
        immutableInputs: snapshot.map((memory) => memory.id),
        supersededByMvcc: [],
        createdRows: [],
        proposalIds: proposals.map((proposal) => proposal.id),
        contradictions: contradictions.map((item) => ({
          left: item.left.id,
          right: item.right.id,
          resolution: "needs_review"
        }))
      },
      status: "pending_review",
      proposalIds: proposals.map((proposal) => proposal.id)
    };
    return recordDreamRun(run);
  } finally {
    if (crossProcessLockId && crossProcessLockHeld) {
      await releaseDreamLock(input.orgId, crossProcessLockId);
    }
    dreamRunningByOrg.delete(input.orgId);
  }
}

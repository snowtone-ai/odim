import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import type { MuninMemory, MuninOpinion } from "./memory.ts";
import { normalizeMuninMemory, normalizeMuninOpinion, toMuninMemoryRow, toMuninOpinionRow, type MuninProvenance } from "./memory.ts";
import type { MemoryClass } from "./types.ts";
import { writeGate } from "./write-gate.ts";
import { isProductionRuntime } from "../env/runtime.ts";

export type SeedMemoryRecord =
  | ({ kind: "memory" } & MuninMemory)
  | ({ kind: "opinion" } & MuninOpinion);

const fallbackSeeds = new Map<string, SeedMemoryRecord[]>();

function nowIso(now = new Date()) {
  return now.toISOString();
}

function seedId(table: string, input: { orgId: string; content: string; validFrom: string }) {
  return deterministicUuid(table, input);
}

function scopedRows(orgId: string) {
  return (fallbackSeeds.get(orgId) ?? []).filter((row) => row.orgId === orgId && row.validTo === null);
}

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the table|relation .* does not exist|column .* does not exist/i.test(message);
}

export async function listSeedMemories(orgId: string): Promise<SeedMemoryRecord[]> {
  if (!orgId) throw new Error("orgId is required for seed memory");
  if (!hasSupabaseWriteEnv()) return scopedRows(orgId);
  const client = createServiceSupabaseClient();
  const [memories, opinions] = await Promise.all([
    client.from("munin_memory").select("*").eq("org_id", orgId).eq("is_seed", true).is("valid_to", null),
    client.from("munin_opinions").select("*").eq("org_id", orgId).eq("is_seed", true).is("valid_to", null)
  ]);
  if (memories.error) {
    if (shouldFallbackFromSupabaseError(memories.error.message)) return scopedRows(orgId);
    throw new Error(`seed memory read failed: ${memories.error.message}`);
  }
  if (opinions.error) {
    if (shouldFallbackFromSupabaseError(opinions.error.message)) return scopedRows(orgId);
    throw new Error(`seed opinion read failed: ${opinions.error.message}`);
  }
  return [
    ...(memories.data ?? []).map((row) => ({
      kind: "memory" as const,
      ...normalizeMuninMemory({
        id: String(row.id),
        orgId: String(row.org_id),
        userId: row.user_id ? String(row.user_id) : undefined,
        agentScope: String(row.agent_scope ?? "core") as "core" | "archival" | "recall",
        memoryClass: "seed" as const,
        sourceType: "user_seed" as const,
        content: String(row.content),
        salienceScore: Number(row.salience_score ?? 1),
        importance: Number(row.importance ?? 1),
        decayScore: Number(row.decay_score ?? 1),
        isSeed: true,
        status: String(row.status ?? "active") as "active" | "archived" | "retired",
        linkedMemoryIds: Array.isArray(row.linked_memory_ids) ? row.linked_memory_ids.map(String) : [],
        sourceRefs: Array.isArray(row.source_refs) ? row.source_refs : [],
        validFrom: String(row.valid_from ?? row.created_at),
        validTo: row.valid_to ? String(row.valid_to) : null,
        createdAt: String(row.created_at),
        lastAccessedAt: String(row.last_accessed_at ?? row.created_at),
        provenance: row.provenance as MuninProvenance | undefined,
        sourceHash: row.source_hash ? String(row.source_hash) : undefined,
        observedAt: row.observed_at ? String(row.observed_at) : undefined,
        ingestedAt: row.ingested_at ? String(row.ingested_at) : undefined,
        supersedes: Array.isArray(row.supersedes) ? row.supersedes.map(String) : undefined,
        parentMemoryIds: Array.isArray(row.parent_memory_ids) ? row.parent_memory_ids.map(String) : undefined,
        reviewStatus: row.review_status ? String(row.review_status) as "not_required" | "pending_review" | "approved" | "rejected" : undefined
      })
    })),
    ...(opinions.data ?? []).map((row) => ({
      kind: "opinion" as const,
      ...normalizeMuninOpinion({
        id: String(row.id),
        orgId: String(row.org_id),
        userId: row.user_id ? String(row.user_id) : undefined,
        sourceType: "user_seed" as const,
        content: String(row.content),
        isSeed: true,
        validFrom: String(row.valid_from ?? row.created_at),
        validTo: row.valid_to ? String(row.valid_to) : null,
        createdAt: String(row.created_at),
        provenance: row.provenance as MuninProvenance | undefined,
        sourceHash: row.source_hash ? String(row.source_hash) : undefined,
        observedAt: row.observed_at ? String(row.observed_at) : undefined,
        ingestedAt: row.ingested_at ? String(row.ingested_at) : undefined,
        supersedes: Array.isArray(row.supersedes) ? row.supersedes.map(String) : undefined,
        parentMemoryIds: Array.isArray(row.parent_memory_ids) ? row.parent_memory_ids.map(String) : undefined,
        reviewStatus: row.review_status ? String(row.review_status) as "not_required" | "pending_review" | "approved" | "rejected" : undefined
      })
    }))
  ];
}

type SeedMemoryInput = {
  orgId: string;
  userId?: string;
  content: string;
  memoryClass: Extract<MemoryClass, "fact" | "opinion">;
  sourceRefs?: import("../pipeline/types.ts").SourceRef[];
  observedAt?: string;
  supersedes?: string[];
  now?: Date;
};

function buildSeedRecord(input: SeedMemoryInput, validFrom: string): SeedMemoryRecord {
  const gate = writeGate({
    orgId: input.orgId,
    userId: input.userId,
    content: input.content,
    sourceType: "user_seed",
    memoryClass: input.memoryClass === "opinion" ? "opinion" : "seed",
    isSeed: true,
    sourceRefs: input.sourceRefs,
    observedAt: input.observedAt,
    supersedes: input.supersedes
  });

  if (gate.action === "WRITTEN_TO_OPINIONS") {
    return {
      kind: "opinion",
      ...normalizeMuninOpinion({
      id: seedId("munin_opinions", { orgId: input.orgId, content: input.content, validFrom }),
      orgId: input.orgId,
      userId: input.userId,
      sourceType: "user_seed",
      content: input.content,
      isSeed: true,
      sourceRefs: input.sourceRefs,
      validFrom,
      validTo: null,
      createdAt: validFrom,
      observedAt: input.observedAt,
      supersedes: input.supersedes,
      reviewStatus: "approved"
      })
    };
  }

  return {
    kind: "memory",
    ...normalizeMuninMemory({
    id: seedId("munin_memory", { orgId: input.orgId, content: input.content, validFrom }),
    orgId: input.orgId,
    userId: input.userId,
    agentScope: "core",
    memoryClass: "seed",
    sourceType: "user_seed",
    content: input.content,
    salienceScore: 1,
    importance: 1,
    decayScore: 1,
    isSeed: true,
    status: "active",
    linkedMemoryIds: [],
    sourceRefs: input.sourceRefs ?? [],
    validFrom,
    validTo: null,
    createdAt: validFrom,
    lastAccessedAt: validFrom,
    observedAt: input.observedAt,
    supersedes: input.supersedes,
    reviewStatus: "approved"
    })
  };
}

async function persistSeedRecord(record: SeedMemoryRecord) {
  if (hasSupabaseWriteEnv()) {
    const client = createServiceSupabaseClient();
    const { error } = record.kind === "opinion"
      ? await client.from("munin_opinions").insert(toMuninOpinionRow(record))
      : await client.from("munin_memory").insert(toMuninMemoryRow(record));
    if (error) {
      if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`seed ${record.kind} write failed: ${error.message}`);
      fallbackSeeds.set(record.orgId, [...(fallbackSeeds.get(record.orgId) ?? []), record]);
    }
  } else fallbackSeeds.set(record.orgId, [...(fallbackSeeds.get(record.orgId) ?? []), record]);
  return record;
}

export async function createSeedMemory(input: SeedMemoryInput): Promise<SeedMemoryRecord> {
  const validFrom = nowIso(input.now);
  const record = buildSeedRecord(input, validFrom);
  return persistSeedRecord(record);
}

async function supersedeSeedAtomically(input: {
  current: SeedMemoryRecord;
  replacement: SeedMemoryRecord;
  orgId: string;
  validTo: string;
}) {
  const client = createServiceSupabaseClient();
  const { data, error } = await client.rpc("munin_supersede_seed", {
    p_org_id: input.orgId,
    p_old_id: input.current.id,
    p_kind: input.current.kind,
    p_valid_to: input.validTo,
    p_record: input.replacement.kind === "opinion" ? toMuninOpinionRow(input.replacement) : toMuninMemoryRow(input.replacement)
  });
  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) return false;
    throw new Error(`seed supersession failed: ${error.message}`);
  }
  if (data === false || (data && typeof data === "object" && (data as { applied?: unknown }).applied === false)) {
    throw new Error("seed memory is no longer current");
  }
  return true;
}

export async function updateSeedMemory(input: { id: string; orgId: string; content: string; now?: Date }) {
  const current = (await listSeedMemories(input.orgId)).find((row) => row.id === input.id);
  if (!current) throw new Error("seed memory not found");
  const validFrom = nowIso(input.now);
  const currentValidFrom = Date.parse(current.validFrom);
  const nextValidFrom = Date.parse(validFrom);
  if (!Number.isFinite(currentValidFrom) || !Number.isFinite(nextValidFrom) || nextValidFrom <= currentValidFrom) {
    throw new Error("seed replacement must start after the current version");
  }
  const replacement = buildSeedRecord({
    orgId: input.orgId,
    userId: current.userId,
    content: input.content,
    memoryClass: current.kind === "opinion" ? "opinion" : "fact",
    sourceRefs: "sourceRefs" in current ? current.sourceRefs : current.provenance?.sourceRefs,
    supersedes: [current.id],
    now: input.now
  }, validFrom);
  // A new seed is an append-only MVCC version. In Supabase-backed operation,
  // lock/close/insert are one transaction so a failed insert cannot leave the
  // old row closed with no replacement.
  if (hasSupabaseWriteEnv()) {
    const atomic = await supersedeSeedAtomically({ current, replacement, orgId: input.orgId, validTo: validFrom });
    if (atomic) return replacement;
    // Local schema compatibility only. Strict/production runtimes fail in the
    // RPC above rather than using this non-atomic fallback.
    await persistSeedRecord(replacement);
    const client = createServiceSupabaseClient();
    const table = current.kind === "opinion" ? "munin_opinions" : "munin_memory";
    const result = await client.from(table).update({ valid_to: validFrom }).eq("id", current.id).eq("org_id", input.orgId).eq("is_seed", true).is("valid_to", null);
    if (result.error && !shouldFallbackFromSupabaseError(result.error.message)) {
      throw new Error(`seed version close failed: ${result.error.message}`);
    }
    return replacement;
  }

  await persistSeedRecord(replacement);
  const fallbackCurrent = (fallbackSeeds.get(input.orgId) ?? []).find((row) => row.id === current.id);
  if (fallbackCurrent) fallbackCurrent.validTo = validFrom;
  return replacement;
}

export async function deleteSeedMemory(input: { id: string; orgId: string; now?: Date }) {
  const validTo = nowIso(input.now);
  if (hasSupabaseWriteEnv()) {
    const client = createServiceSupabaseClient();
    const results = await Promise.all([
      client.from("munin_memory").update({ valid_to: validTo, status: "retired" }).eq("id", input.id).eq("org_id", input.orgId).eq("is_seed", true),
      client.from("munin_opinions").update({ valid_to: validTo }).eq("id", input.id).eq("org_id", input.orgId).eq("is_seed", true)
    ]);
    const error = results.find((result) => result.error)?.error;
    if (error) {
      if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`seed memory retire failed: ${error.message}`);
    }
    return { id: input.id, validTo };
  }
  const rows = fallbackSeeds.get(input.orgId) ?? [];
  for (const row of rows) {
    if (row.id === input.id && row.orgId === input.orgId) row.validTo = validTo;
  }
  return { id: input.id, validTo };
}

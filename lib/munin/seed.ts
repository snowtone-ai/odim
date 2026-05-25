import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import type { MuninMemory, MuninOpinion } from "./memory.ts";
import { toMuninMemoryRow, toMuninOpinionRow } from "./memory.ts";
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
      id: String(row.id),
      orgId: String(row.org_id),
      userId: row.user_id ? String(row.user_id) : undefined,
      agentScope: "core" as const,
      memoryClass: "seed" as const,
      sourceType: "user_seed" as const,
      content: String(row.content),
      salienceScore: Number(row.salience_score ?? 1),
      importance: Number(row.importance ?? 1),
      decayScore: Number(row.decay_score ?? 1),
      isSeed: true,
      status: "active" as const,
      linkedMemoryIds: Array.isArray(row.linked_memory_ids) ? row.linked_memory_ids.map(String) : [],
      sourceRefs: Array.isArray(row.source_refs) ? row.source_refs : [],
      validFrom: String(row.valid_from),
      validTo: row.valid_to ? String(row.valid_to) : null,
      createdAt: String(row.created_at),
      lastAccessedAt: String(row.last_accessed_at ?? row.created_at)
    })),
    ...(opinions.data ?? []).map((row) => ({
      kind: "opinion" as const,
      id: String(row.id),
      orgId: String(row.org_id),
      userId: row.user_id ? String(row.user_id) : undefined,
      sourceType: "user_seed" as const,
      content: String(row.content),
      isSeed: true,
      validFrom: String(row.valid_from),
      validTo: row.valid_to ? String(row.valid_to) : null,
      createdAt: String(row.created_at)
    }))
  ];
}

export async function createSeedMemory(input: {
  orgId: string;
  userId?: string;
  content: string;
  memoryClass: Extract<MemoryClass, "fact" | "opinion">;
  now?: Date;
}): Promise<SeedMemoryRecord> {
  const validFrom = nowIso(input.now);
  const gate = writeGate({
    orgId: input.orgId,
    userId: input.userId,
    content: input.content,
    sourceType: "user_seed",
    memoryClass: input.memoryClass === "opinion" ? "opinion" : "seed",
    isSeed: true
  });

  if (gate.action === "WRITTEN_TO_OPINIONS") {
    const opinion: SeedMemoryRecord = {
      kind: "opinion",
      id: seedId("munin_opinions", { orgId: input.orgId, content: input.content, validFrom }),
      orgId: input.orgId,
      userId: input.userId,
      sourceType: "user_seed",
      content: input.content,
      isSeed: true,
      validFrom,
      validTo: null,
      createdAt: validFrom
    };
    if (hasSupabaseWriteEnv()) {
      const { error } = await createServiceSupabaseClient().from("munin_opinions").insert(toMuninOpinionRow(opinion));
      if (error) {
        if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`seed opinion write failed: ${error.message}`);
        fallbackSeeds.set(input.orgId, [...(fallbackSeeds.get(input.orgId) ?? []), opinion]);
      }
    } else fallbackSeeds.set(input.orgId, [...(fallbackSeeds.get(input.orgId) ?? []), opinion]);
    return opinion;
  }

  const memory: SeedMemoryRecord = {
    kind: "memory",
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
    sourceRefs: [],
    validFrom,
    validTo: null,
    createdAt: validFrom,
    lastAccessedAt: validFrom
  };
  if (hasSupabaseWriteEnv()) {
    const { error } = await createServiceSupabaseClient().from("munin_memory").insert(toMuninMemoryRow(memory));
    if (error) {
      if (!shouldFallbackFromSupabaseError(error.message)) throw new Error(`seed memory write failed: ${error.message}`);
      fallbackSeeds.set(input.orgId, [...(fallbackSeeds.get(input.orgId) ?? []), memory]);
    }
  } else fallbackSeeds.set(input.orgId, [...(fallbackSeeds.get(input.orgId) ?? []), memory]);
  return memory;
}

export async function updateSeedMemory(input: { id: string; orgId: string; content: string; now?: Date }) {
  const current = (await listSeedMemories(input.orgId)).find((row) => row.id === input.id);
  if (!current) throw new Error("seed memory not found");
  await deleteSeedMemory({ id: input.id, orgId: input.orgId, now: input.now });
  return createSeedMemory({
    orgId: input.orgId,
    userId: current.userId,
    content: input.content,
    memoryClass: current.kind === "opinion" ? "opinion" : "fact",
    now: input.now
  });
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

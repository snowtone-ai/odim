import { isProductionRuntime } from "../env/runtime.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import type { SourceRef } from "../pipeline/types.ts";
import {
  buildFixtureMemories,
  buildFixtureOpinions,
  isMemoryCurrentlyUsable,
  normalizeMuninMemory,
  normalizeMuninOpinion,
  searchMuninMemory,
  searchOpinions,
  type MuninMemory,
  type MuninOpinion,
  type RetrievedMemory
} from "./memory.ts";
import type { TemporalMemoryReader } from "../huginn/orchestrator/types.ts";

type ReaderError = { message?: string } | null | undefined;
type ReaderResult = { data: unknown; error: ReaderError };

/**
 * The Supabase client is deliberately kept behind this small structural
 * boundary.  It keeps the reader testable without adding a database adapter
 * dependency, while the production instance remains the service-role client.
 */
export type MuninReaderClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<ReaderResult> | ReaderResult;
  from: (table: string) => MuninReaderQuery;
};

export type MuninReaderQuery = {
  select: (columns?: string) => MuninReaderQuery;
  eq: (column: string, value: unknown) => MuninReaderQuery;
  in: (column: string, values: unknown[]) => MuninReaderQuery;
  lte: (column: string, value: unknown) => MuninReaderQuery;
  or: (filters: string) => MuninReaderQuery;
  limit: (count: number) => MuninReaderQuery;
  abortSignal?: (signal: AbortSignal) => MuninReaderQuery;
  then: PromiseLike<ReaderResult>["then"];
};

export type MuninTemporalMemoryReader = TemporalMemoryReader<RetrievedMemory, MuninOpinion> & {
  source: "fallback" | "supabase";
};

export function isMuninReaderStrictRuntime() {
  return isProductionRuntime() || process.env.REPOSITORY_SUPABASE_STRICT === "true";
}

function shouldFallbackFromSupabaseError(message: string) {
  if (isMuninReaderStrictRuntime()) return false;
  return /schema cache|does not exist|Could not find the function|Could not find the table|relation .* does not exist|column .* does not exist/i.test(message);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "database error");
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    : [];
}

function errorMessage(error: ReaderError, fallback: string) {
  return error && typeof error.message === "string" && error.message.trim() ? error.message : fallback;
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Munin reader request was cancelled");
}

function bindAbortSignal<T>(request: T, signal?: AbortSignal) {
  const abortable = request as T & { abortSignal?: (value: AbortSignal) => unknown };
  if (signal && typeof abortable.abortSignal === "function") abortable.abortSignal(signal);
  return request;
}

function asOfDate(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) throw new Error("Munin reader requires a valid as-of timestamp");
  return parsed;
}

function boundedTopK(value?: number) {
  const parsed = Number(value ?? 8);
  if (!Number.isFinite(parsed)) return 8;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function sourceRefs(value: unknown): SourceRef[] {
  return Array.isArray(value)
    ? value.flatMap((ref) => {
        if (!ref || typeof ref !== "object") return [];
        const record = ref as Record<string, unknown>;
        const sourceId = String(record.sourceId ?? record.source_id ?? "").trim();
        if (!sourceId) return [];
        return [{
          sourceId,
          url: String(record.url ?? "").trim(),
          title: String(record.title ?? sourceId).trim() || sourceId,
          ...(record.externalId || record.external_id ? { externalId: String(record.externalId ?? record.external_id) } : {}),
          ...(record.observedAt || record.observed_at ? { observedAt: String(record.observedAt ?? record.observed_at) } : {})
        }];
      })
    : [];
}

const agentScopes = new Set<MuninMemory["agentScope"]>(["core", "archival", "recall"]);
const memoryClasses = new Set<MuninMemory["memoryClass"]>(["fact", "procedure", "seed"]);
const sourceTypes = new Set<MuninMemory["sourceType"]>(["primary_filing", "official_ir", "odim_derived", "huginn_inference", "user_seed"]);
const memoryStatuses = new Set<MuninMemory["status"]>(["active", "archived", "retired"]);

function rowToMemory(row: Record<string, unknown>, asOf: string): MuninMemory {
  const createdAt = String(row.created_at ?? asOf);
  const sourceRefsValue = sourceRefs(row.source_refs);
  const memory = {
    id: String(row.id ?? ""),
    orgId: String(row.org_id ?? ""),
    userId: row.user_id ? String(row.user_id) : undefined,
    agentScope: agentScopes.has(row.agent_scope as MuninMemory["agentScope"]) ? row.agent_scope as MuninMemory["agentScope"] : "archival",
    memoryClass: memoryClasses.has(row.memory_class as MuninMemory["memoryClass"]) ? row.memory_class as MuninMemory["memoryClass"] : "fact",
    sourceType: sourceTypes.has(row.source_type as MuninMemory["sourceType"]) ? row.source_type as MuninMemory["sourceType"] : "odim_derived",
    content: String(row.content ?? ""),
    salienceScore: Number(row.salience_score ?? 0),
    importance: Number(row.importance ?? 0),
    decayScore: Number(row.decay_score ?? 1),
    isSeed: row.is_seed === true || row.is_seed === "true" || row.is_seed === 1,
    status: memoryStatuses.has(row.status as MuninMemory["status"]) ? row.status as MuninMemory["status"] : "active",
    linkedMemoryIds: Array.isArray(row.linked_memory_ids) ? row.linked_memory_ids.map(String) : [],
    sourceRefs: sourceRefsValue,
    validFrom: String(row.valid_from ?? createdAt),
    validTo: row.valid_to ? String(row.valid_to) : null,
    createdAt,
    lastAccessedAt: String(row.last_accessed_at ?? createdAt),
    provenance: row.provenance && typeof row.provenance === "object" ? row.provenance as MuninMemory["provenance"] : undefined,
    sourceHash: row.source_hash ? String(row.source_hash) : undefined,
    observedAt: row.observed_at ? String(row.observed_at) : null,
    ingestedAt: row.ingested_at ? String(row.ingested_at) : undefined,
    supersedes: Array.isArray(row.supersedes) ? row.supersedes.map(String) : [],
    parentMemoryIds: Array.isArray(row.parent_memory_ids) ? row.parent_memory_ids.map(String) : [],
    reviewStatus: String(row.review_status ?? "not_required") as MuninMemory["reviewStatus"],
    runId: row.run_id ? String(row.run_id) : undefined
  } satisfies MuninMemory;
  return normalizeMuninMemory(memory);
}

function rowToOpinion(row: Record<string, unknown>, asOf: string): MuninOpinion {
  const createdAt = String(row.created_at ?? asOf);
  const opinion = {
    id: String(row.id ?? ""),
    orgId: String(row.org_id ?? ""),
    userId: row.user_id ? String(row.user_id) : undefined,
    sourceType: sourceTypes.has(row.source_type as MuninMemory["sourceType"]) ? row.source_type as MuninOpinion["sourceType"] : "odim_derived",
    content: String(row.content ?? ""),
    sourceRefs: sourceRefs(row.source_refs),
    isSeed: row.is_seed === true || row.is_seed === "true" || row.is_seed === 1,
    validFrom: String(row.valid_from ?? createdAt),
    validTo: row.valid_to ? String(row.valid_to) : null,
    createdAt,
    provenance: row.provenance && typeof row.provenance === "object" ? row.provenance as MuninOpinion["provenance"] : undefined,
    sourceHash: row.source_hash ? String(row.source_hash) : undefined,
    observedAt: row.observed_at ? String(row.observed_at) : null,
    ingestedAt: row.ingested_at ? String(row.ingested_at) : undefined,
    supersedes: Array.isArray(row.supersedes) ? row.supersedes.map(String) : [],
    parentMemoryIds: Array.isArray(row.parent_memory_ids) ? row.parent_memory_ids.map(String) : [],
    reviewStatus: String(row.review_status ?? "not_required") as MuninOpinion["reviewStatus"],
    runId: row.run_id ? String(row.run_id) : undefined
  } satisfies MuninOpinion;
  return normalizeMuninOpinion(opinion);
}

function assertOrgRows(rows: Array<Record<string, unknown>>, orgId: string) {
  for (const row of rows) {
    if (String(row.org_id ?? "") !== orgId) throw new Error("Munin reader org isolation violation");
  }
}

/**
 * The SQL predicates are the primary guard. Keep the same checks at the
 * application boundary because a service-role response can be malformed (or
 * a test adapter can accidentally omit a predicate). In strict/production
 * mode, missing temporal metadata is not legacy-compatible and is rejected.
 */
function isStrictTemporalRow(row: Record<string, unknown>, orgId: string, nowIso: string) {
  if (String(row.org_id ?? "") !== orgId) return false;
  if (String(row.status ?? "active") !== "active") return false;
  if (!(["approved", "not_required"] as unknown[]).includes(row.review_status ?? "not_required")) return false;
  const validFrom = Date.parse(String(row.valid_from ?? ""));
  const observedAt = Date.parse(String(row.observed_at ?? ""));
  const now = Date.parse(nowIso);
  const validTo = row.valid_to == null ? null : Date.parse(String(row.valid_to));
  return Number.isFinite(now) && Number.isFinite(validFrom) && validFrom <= now
    && Number.isFinite(observedAt) && observedAt <= now
    && (validTo === null || (Number.isFinite(validTo) && now < validTo));
}

function eligibleMemoryQuery(client: MuninReaderClient, orgId: string, nowIso: string) {
  return client
    .from("munin_memory")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active")
    .in("review_status", ["approved", "not_required"])
    .lte("valid_from", nowIso)
    .lte("observed_at", nowIso)
    .or(`valid_to.is.null,valid_to.gt.${nowIso}`);
}

async function hybridRows(client: MuninReaderClient, input: { orgId: string; question: string; nowIso: string; topK: number; signal?: AbortSignal }) {
  assertNotAborted(input.signal);
  const request = client.rpc("munin_hybrid_search", {
    p_org_id: input.orgId,
    p_query: input.question,
    p_query_embedding: null,
    p_match_count: input.topK,
    p_now: input.nowIso
  });
  bindAbortSignal(request, input.signal);
  const result = await request;
  if (result.error) throw new Error(`Munin hybrid search failed: ${errorMessage(result.error, "database error")}`);
  const rows = asRows(result.data);
  assertOrgRows(rows, input.orgId);
  return rows;
}

async function searchSupabaseMemories(client: MuninReaderClient, input: { orgId: string; question: string; asOf: string; signal?: AbortSignal }) {
  const now = asOfDate(input.asOf);
  const nowIso = now.toISOString();
  const topK = boundedTopK(8);
  const ranked = await hybridRows(client, { ...input, nowIso, topK });
  const ids = ranked.map((row) => String(row.id ?? "").trim()).filter(Boolean);
  const rankById = new Map(ids.map((id, index) => [id, Number(ranked[index]?.rank ?? 0)]));
  const fullRows: Array<Record<string, unknown>> = [];

  if (ids.length) {
    const result = await bindAbortSignal(eligibleMemoryQuery(client, input.orgId, nowIso).in("id", ids), input.signal);
    if (result.error) throw new Error(`Munin memory read failed: ${errorMessage(result.error, "database error")}`);
    fullRows.push(...asRows(result.data));
  }

  const seedResult = await bindAbortSignal(eligibleMemoryQuery(client, input.orgId, nowIso).eq("is_seed", true), input.signal);
  if (seedResult.error) throw new Error(`Munin seed read failed: ${errorMessage(seedResult.error, "database error")}`);
  fullRows.push(...asRows(seedResult.data));
  assertOrgRows(fullRows, input.orgId);

  const uniqueRows = [...new Map(fullRows.map((row) => [String(row.id ?? ""), row])).values()]
    .filter((row) => !isMuninReaderStrictRuntime() || isStrictTemporalRow(row, input.orgId, nowIso));
  const memories = uniqueRows
    .map((row) => rowToMemory(row, nowIso))
    .filter((memory) => memory.orgId === input.orgId && isMemoryCurrentlyUsable({ memory, now }))
    .map((memory) => {
      const hybridRank = rankById.get(memory.id);
      return {
        ...memory,
        retrievalScore: memory.isSeed ? 1 : Number.isFinite(hybridRank) ? hybridRank as number : 0,
        scoreParts: { semantic: 0, recency: 0, importance: 0, linkProximity: 0 }
      };
    })
    .filter((memory) => memory.isSeed || rankById.has(memory.id))
    .sort((left, right) => Number(right.isSeed) - Number(left.isSeed) || right.retrievalScore - left.retrievalScore || left.id.localeCompare(right.id));
  const seeds = memories.filter((memory) => memory.isSeed);
  const nonSeeds = memories.filter((memory) => !memory.isSeed).slice(0, Math.max(0, topK - seeds.length));
  return [...seeds, ...nonSeeds].slice(0, Math.max(topK, seeds.length));
}

async function searchSupabaseOpinions(client: MuninReaderClient, input: { orgId: string; question: string; asOf: string; signal?: AbortSignal }) {
  assertNotAborted(input.signal);
  const now = asOfDate(input.asOf);
  const nowIso = now.toISOString();
  const request = client
    .from("munin_opinions")
    .select("*")
    .eq("org_id", input.orgId)
    .in("review_status", ["approved", "not_required"])
    .lte("valid_from", nowIso)
    .lte("observed_at", nowIso)
    .or(`valid_to.is.null,valid_to.gt.${nowIso}`);
  bindAbortSignal(request, input.signal);
  const result = await request;
  if (result.error) throw new Error(`Munin opinion read failed: ${errorMessage(result.error, "database error")}`);
  const rows = asRows(result.data)
    .filter((row) => !isMuninReaderStrictRuntime() || isStrictTemporalRow(row, input.orgId, nowIso));
  assertOrgRows(rows, input.orgId);
  return searchOpinions({
    orgId: input.orgId,
    question: input.question,
    opinions: rows.map((row) => rowToOpinion(row, nowIso)),
    topK: 4,
    now
  });
}

export function createSupabaseTemporalMemoryReader(input: { client?: MuninReaderClient } = {}): MuninTemporalMemoryReader {
  const client = input.client ?? (createServiceSupabaseClient() as unknown as MuninReaderClient);
  return {
    source: "supabase",
    search: (request) => searchSupabaseMemories(client, request),
    searchOpinions: (request) => searchSupabaseOpinions(client, request)
  };
}

export function createMuninTemporalMemoryReader(): MuninTemporalMemoryReader {
  if (!isMuninReaderStrictRuntime() && !hasSupabaseWriteEnv()) {
    return {
      source: "fallback",
      search: ({ orgId, question, asOf }) => searchMuninMemory({
        orgId,
        question,
        memories: buildFixtureMemories(orgId),
        topK: 8,
        now: asOfDate(asOf)
      }),
      searchOpinions: ({ orgId, question, asOf }) => searchOpinions({
        orgId,
        question,
        opinions: buildFixtureOpinions(orgId),
        topK: 4,
        now: asOfDate(asOf)
      })
    };
  }
  if (!hasSupabaseWriteEnv()) {
    return {
      source: "supabase",
      search: async () => { throw new Error("Munin reader is fail-closed: Supabase service environment is required"); },
      searchOpinions: async () => { throw new Error("Munin reader is fail-closed: Supabase service environment is required"); }
    };
  }
  const supabaseReader = createSupabaseTemporalMemoryReader();
  return {
    source: "supabase",
    search: async (request) => {
      try {
        return await supabaseReader.search?.(request) ?? [];
      } catch (error) {
        if (!shouldFallbackFromSupabaseError(errorText(error))) throw error;
        return searchMuninMemory({
          orgId: request.orgId,
          question: request.question,
          memories: buildFixtureMemories(request.orgId),
          topK: 8,
          now: asOfDate(request.asOf)
        });
      }
    },
    searchOpinions: async (request) => {
      try {
        return await supabaseReader.searchOpinions?.(request) ?? [];
      } catch (error) {
        if (!shouldFallbackFromSupabaseError(errorText(error))) throw error;
        return searchOpinions({
          orgId: request.orgId,
          question: request.question,
          opinions: buildFixtureOpinions(request.orgId),
          topK: 4,
          now: asOfDate(request.asOf)
        });
      }
    }
  };
}

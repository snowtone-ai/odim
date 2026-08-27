import { createHash } from "node:crypto";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import type { SourceRef } from "../pipeline/types.ts";
import type { AgentScope, MemoryClass, MemoryReviewStatus, MemoryStatus, SourceType } from "./types.ts";

export type MuninProvenance = {
  sourceHash: string;
  sourceRefs: SourceRef[];
  observedAt: string | null;
  ingestedAt: string;
  supersedes: string[];
  parentMemoryIds: string[];
  origin?: string;
  actorId?: string;
  runId?: string;
  model?: string;
  promptVersion?: string;
};

export type MuninMemory = {
  id: string;
  orgId: string;
  userId?: string;
  agentScope: AgentScope;
  memoryClass: Exclude<MemoryClass, "opinion">;
  sourceType: Exclude<SourceType, "web_narrative">;
  content: string;
  salienceScore: number;
  importance: number;
  decayScore: number;
  isSeed: boolean;
  status: MemoryStatus;
  linkedMemoryIds: string[];
  sourceRefs: SourceRef[];
  validFrom: string;
  validTo: string | null;
  createdAt: string;
  lastAccessedAt: string;
  /** v3 fields are optional on the compatibility type; normalize before use. */
  provenance?: MuninProvenance;
  sourceHash?: string;
  observedAt?: string | null;
  ingestedAt?: string;
  supersedes?: string[];
  parentMemoryIds?: string[];
  reviewStatus?: MemoryReviewStatus;
  runId?: string;
};

export type MuninOpinion = {
  id: string;
  orgId: string;
  userId?: string;
  sourceType: Extract<SourceType, "huginn_inference" | "user_seed" | "odim_derived">;
  content: string;
  sourceRefs?: SourceRef[];
  isSeed: boolean;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
  provenance?: MuninProvenance;
  sourceHash?: string;
  observedAt?: string | null;
  ingestedAt?: string;
  supersedes?: string[];
  parentMemoryIds?: string[];
  reviewStatus?: MemoryReviewStatus;
  runId?: string;
};

export type RetrievedMemory = MuninMemory & {
  retrievalScore: number;
  scoreParts: {
    semantic: number;
    recency: number;
    importance: number;
    linkProximity: number;
  };
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function uniqueStrings(values: Iterable<string> | undefined) {
  return [...new Set([...values ?? []].map((value) => value.trim()).filter(Boolean))];
}

/**
 * Unicode-aware tokenization used by both the in-memory fallback and the
 * deterministic fixture search.  Latin words retain the v2 minimum length;
 * CJK/Kana runs also emit bigrams so a Japanese query can match a longer
 * phrase without introducing a tokenizer dependency.
 */
export function tokenize(value: string) {
  const normalized = String(value ?? "").normalize("NFKC").toLocaleLowerCase();
  const chunks = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const tokens = new Set<string>();
  for (const chunk of chunks) {
    const codePoints = [...chunk];
    const isCjk = codePoints.some((character) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character));
    if (isCjk) {
      if (codePoints.length >= 2) tokens.add(chunk);
      for (let index = 0; index < codePoints.length - 1; index += 1) {
        tokens.add(codePoints.slice(index, index + 2).join(""));
      }
      if (codePoints.length === 1) tokens.add(chunk);
      continue;
    }
    if (codePoints.length > 2) tokens.add(chunk);
  }
  return tokens;
}

export function semanticScore(question: string, content: string) {
  const questionTokens = tokenize(question);
  const contentTokens = tokenize(content);
  if (!questionTokens.size || !contentTokens.size) return 0;
  const overlap = [...questionTokens].filter((token) => contentTokens.has(token)).length;
  return overlap / Math.sqrt(questionTokens.size * contentTokens.size);
}

function stableSourcePayload(sourceRefs: SourceRef[], observedAt: string | null, content: string) {
  const refs = sourceRefs.map((source) => ({
    sourceId: source.sourceId,
    url: source.url,
    title: source.title,
    observedAt: source.observedAt ?? null
  }));
  return JSON.stringify({ refs, observedAt, content: refs.length ? undefined : content });
}

export function computeSourceHash(input: { sourceRefs?: SourceRef[]; observedAt?: string | null; content?: string }) {
  const sourceRefs = input.sourceRefs ?? [];
  const observedAt = input.observedAt ?? sourceRefs.find((source) => source.observedAt)?.observedAt ?? null;
  return createHash("sha256").update(stableSourcePayload(sourceRefs, observedAt, input.content ?? "")).digest("hex");
}

function firstObservedAt(sourceRefs: SourceRef[], fallback: string) {
  return sourceRefs.find((source) => source.observedAt)?.observedAt ?? fallback;
}

export function normalizeMuninProvenance(input: {
  content: string;
  sourceRefs?: SourceRef[];
  provenance?: Partial<MuninProvenance>;
  sourceHash?: string;
  observedAt?: string | null;
  ingestedAt?: string;
  createdAt: string;
  supersedes?: string[];
  parentMemoryIds?: string[];
  linkedMemoryIds?: string[];
  actorId?: string;
  runId?: string;
}) : MuninProvenance {
  const sourceRefs = input.sourceRefs ?? input.provenance?.sourceRefs ?? [];
  const observedAt = input.observedAt ?? input.provenance?.observedAt ?? firstObservedAt(sourceRefs, input.createdAt);
  const ingestedAt = input.ingestedAt ?? input.provenance?.ingestedAt ?? input.createdAt;
  const supersedes = uniqueStrings(input.supersedes ?? input.provenance?.supersedes);
  const parentMemoryIds = uniqueStrings(input.parentMemoryIds ?? input.provenance?.parentMemoryIds ?? input.linkedMemoryIds);
  const sourceHash = input.sourceHash ?? input.provenance?.sourceHash ?? computeSourceHash({ sourceRefs, observedAt, content: input.content });
  return {
    sourceHash,
    sourceRefs,
    observedAt,
    ingestedAt,
    supersedes,
    parentMemoryIds,
    origin: input.provenance?.origin,
    actorId: input.actorId ?? input.provenance?.actorId,
    runId: input.runId ?? input.provenance?.runId,
    model: input.provenance?.model,
    promptVersion: input.provenance?.promptVersion
  };
}

export type NormalizedMuninMemory = MuninMemory & {
  provenance: MuninProvenance;
  sourceHash: string;
  observedAt: string | null;
  ingestedAt: string;
  supersedes: string[];
  parentMemoryIds: string[];
  reviewStatus: MemoryReviewStatus;
};

export type NormalizedMuninOpinion = MuninOpinion & {
  sourceRefs: SourceRef[];
  provenance: MuninProvenance;
  sourceHash: string;
  observedAt: string | null;
  ingestedAt: string;
  supersedes: string[];
  parentMemoryIds: string[];
  reviewStatus: MemoryReviewStatus;
};

export function normalizeMuninMemory(memory: MuninMemory): NormalizedMuninMemory {
  const provenance = normalizeMuninProvenance(memory);
  return {
    ...memory,
    sourceRefs: provenance.sourceRefs,
    provenance,
    sourceHash: provenance.sourceHash,
    observedAt: provenance.observedAt,
    ingestedAt: provenance.ingestedAt,
    supersedes: provenance.supersedes,
    parentMemoryIds: provenance.parentMemoryIds,
    reviewStatus: memory.reviewStatus ?? (memory.isSeed ? "approved" : "not_required")
  };
}

export function normalizeMuninOpinion(opinion: MuninOpinion): NormalizedMuninOpinion {
  const provenance = normalizeMuninProvenance(opinion);
  return {
    ...opinion,
    sourceRefs: provenance.sourceRefs,
    provenance,
    sourceHash: provenance.sourceHash,
    observedAt: provenance.observedAt,
    ingestedAt: provenance.ingestedAt,
    supersedes: provenance.supersedes,
    parentMemoryIds: provenance.parentMemoryIds,
    reviewStatus: opinion.reviewStatus ?? (opinion.isSeed ? "approved" : "not_required")
  };
}

export function isMemoryCurrentlyUsable(input: {
  memory: { status?: MemoryStatus; validFrom: string; validTo: string | null; observedAt?: string | null; reviewStatus?: MemoryReviewStatus };
  now?: Date;
}) {
  const now = (input.now ?? new Date()).valueOf();
  const validFrom = new Date(input.memory.validFrom).valueOf();
  const validTo = input.memory.validTo === null ? null : new Date(input.memory.validTo).valueOf();
  const observedAt = input.memory.observedAt == null ? null : new Date(input.memory.observedAt).valueOf();
  if (!Number.isFinite(validFrom) || (validTo !== null && !Number.isFinite(validTo))) return false;
  if (observedAt !== null && !Number.isFinite(observedAt)) return false;
  const reviewStatus = input.memory.reviewStatus ?? "not_required";
  return (
    (input.memory.status ?? "active") === "active" &&
    (reviewStatus === "approved" || reviewStatus === "not_required") &&
    validFrom <= now &&
    (observedAt === null || observedAt <= now) &&
    (validTo === null || now < validTo)
  );
}

function recencyScore(lastAccessedAt: string, now = new Date()) {
  const accessed = new Date(lastAccessedAt);
  if (Number.isNaN(accessed.valueOf())) return 0;
  const days = Math.max(0, (now.valueOf() - accessed.valueOf()) / 86_400_000);
  return clamp01(1 / (1 + days / 30));
}

function linkProximityScore(memory: MuninMemory, selectedIds: Set<string>) {
  if (!memory.linkedMemoryIds.length || !selectedIds.size) return 0;
  return memory.linkedMemoryIds.some((id) => selectedIds.has(id)) ? 1 : 0;
}

function buildMemory(input: Omit<MuninMemory, "id">) {
  const memory = {
    ...input,
    id: deterministicUuid("munin_memory", {
      content: input.content,
      createdAt: input.createdAt,
      orgId: input.orgId,
      scope: input.agentScope
    })
  };
  return normalizeMuninMemory(memory);
}

function buildOpinion(input: Omit<MuninOpinion, "id">) {
  const opinion = {
    ...input,
    id: deterministicUuid("munin_opinions", {
      content: input.content,
      createdAt: input.createdAt,
      orgId: input.orgId
    })
  };
  return normalizeMuninOpinion(opinion);
}

export function buildFixtureMemories(orgId = "demo-org"): MuninMemory[] {
  const sourceRefs = [
    {
      sourceId: "fixture:munin",
      url: "https://example.local/munin/reality-playbook",
      title: "Fixture Munin reality playbook",
      observedAt: "2026-05-21T00:00:00.000Z"
    }
  ];
  const core = buildMemory({
    orgId,
    userId: "demo-user",
    agentScope: "core",
    memoryClass: "procedure",
    sourceType: "user_seed",
    content:
      "Org mandate: prioritize source-backed data center, power, water, and SPV signals. Never treat narrative as truth.",
    salienceScore: 1,
    importance: 0.95,
    decayScore: 1,
    isSeed: true,
    status: "active",
    linkedMemoryIds: [],
    sourceRefs,
    validFrom: "2026-05-21T00:00:00.000Z",
    validTo: null,
    createdAt: "2026-05-21T00:00:00.000Z",
    lastAccessedAt: "2026-05-21T00:00:00.000Z"
  });
  const archival = buildMemory({
    orgId,
    userId: "demo-user",
    agentScope: "archival",
    memoryClass: "fact",
    sourceType: "primary_filing",
    content:
      "Laidley LLC pattern: Louisiana building permit, water request, and large-load FERC evidence should be reviewed as an SPV cluster before official announcement.",
    salienceScore: 0.88,
    importance: 0.87,
    decayScore: 0.93,
    isSeed: false,
    status: "active",
    linkedMemoryIds: [core.id],
    sourceRefs,
    validFrom: "2026-05-20T00:00:00.000Z",
    validTo: null,
    createdAt: "2026-05-20T00:00:00.000Z",
    lastAccessedAt: "2026-05-22T00:00:00.000Z"
  });
  const recall = buildMemory({
    orgId,
    userId: "demo-user",
    agentScope: "recall",
    memoryClass: "fact",
    sourceType: "huginn_inference",
    content:
      "Previous Huginn answer emphasized confidence, source refs, and Reality-to-Narrative divergence for Meta and Entergy infrastructure evidence.",
    salienceScore: 0.56,
    importance: 0.72,
    decayScore: 0.88,
    isSeed: false,
    status: "active",
    linkedMemoryIds: [archival.id],
    sourceRefs,
    validFrom: "2026-05-22T00:00:00.000Z",
    validTo: null,
    createdAt: "2026-05-22T00:00:00.000Z",
    lastAccessedAt: "2026-05-22T12:00:00.000Z"
  });
  const otherOrg = buildMemory({
    orgId: "other-org",
    userId: "other-user",
    agentScope: "core",
    memoryClass: "seed",
    sourceType: "user_seed",
    content: "Other org confidential thesis: this memory must never appear in demo-org responses.",
    salienceScore: 1,
    importance: 1,
    decayScore: 1,
    isSeed: true,
    status: "active",
    linkedMemoryIds: [],
    sourceRefs,
    validFrom: "2026-05-22T00:00:00.000Z",
    validTo: null,
    createdAt: "2026-05-22T00:00:00.000Z",
    lastAccessedAt: "2026-05-22T12:00:00.000Z"
  });
  const archived = buildMemory({
    orgId,
    userId: "demo-user",
    agentScope: "archival",
    memoryClass: "fact",
    sourceType: "odim_derived",
    content: "Archived low-salience memory should not be used as Huginn evidence.",
    salienceScore: 0.2,
    importance: 0.2,
    decayScore: 0.5,
    isSeed: false,
    status: "archived",
    linkedMemoryIds: [],
    sourceRefs,
    validFrom: "2026-05-19T00:00:00.000Z",
    validTo: null,
    createdAt: "2026-05-19T00:00:00.000Z",
    lastAccessedAt: "2026-05-19T00:00:00.000Z"
  });
  const expired = buildMemory({
    orgId,
    userId: "demo-user",
    agentScope: "archival",
    memoryClass: "fact",
    sourceType: "primary_filing",
    content: "Expired MVCC version should not be returned.",
    salienceScore: 0.8,
    importance: 0.8,
    decayScore: 1,
    isSeed: false,
    status: "active",
    linkedMemoryIds: [],
    sourceRefs,
    validFrom: "2026-05-18T00:00:00.000Z",
    validTo: "2026-05-20T00:00:00.000Z",
    createdAt: "2026-05-18T00:00:00.000Z",
    lastAccessedAt: "2026-05-18T00:00:00.000Z"
  });

  return [core, archival, recall, otherOrg, archived, expired];
}

export function buildFixtureOpinions(orgId = "demo-org"): MuninOpinion[] {
  return [
    buildOpinion({
      orgId,
      userId: "demo-user",
      sourceType: "huginn_inference",
      content: "Prior opinion: AI infrastructure remains attractive only when backed by primary grid evidence.",
      isSeed: false,
      validFrom: "2026-05-22T00:00:00.000Z",
      validTo: null,
      createdAt: "2026-05-22T00:00:00.000Z"
    }),
    buildOpinion({
      orgId,
      userId: "demo-user",
      sourceType: "user_seed",
      content: "Opinion seed: be skeptical of narrative-only semiconductor theses.",
      isSeed: true,
      validFrom: "2026-05-22T00:00:00.000Z",
      validTo: null,
      createdAt: "2026-05-22T00:00:00.000Z"
    }),
    buildOpinion({
      orgId: "other-org",
      userId: "other-user",
      sourceType: "huginn_inference",
      content: "Other org opinion must never appear.",
      isSeed: false,
      validFrom: "2026-05-22T00:00:00.000Z",
      validTo: null,
      createdAt: "2026-05-22T00:00:00.000Z"
    })
  ];
}

export function assertOrgScoped<T extends { orgId: string }>(memory: T, orgId: string) {
  if (memory.orgId !== orgId) throw new Error("Munin memory org isolation violation");
  return memory;
}

export function assertOrgScopedMemories<T extends { orgId: string }>(memories: T[], orgId: string) {
  return memories.map((memory) => assertOrgScoped(memory, orgId));
}

export function searchMuninMemory(input: {
  orgId: string;
  question: string;
  memories?: MuninMemory[];
  topK?: number;
  now?: Date;
}): RetrievedMemory[] {
  if (!input.orgId) throw new Error("orgId is required for Munin search");
  const topK = input.topK ?? 8;
  const selectedIds = new Set<string>();
  const scoped = assertOrgScopedMemories(
    (input.memories ?? buildFixtureMemories(input.orgId)).filter(
      (memory) => memory.orgId === input.orgId
    ).map(normalizeMuninMemory).filter((memory) => isMemoryCurrentlyUsable({ memory, now: input.now })),
    input.orgId
  );

  const scored = scoped
    .map((memory) => {
      const parts = {
        semantic: semanticScore(input.question, memory.content),
        recency: recencyScore(memory.lastAccessedAt, input.now),
        importance: clamp01(memory.importance * memory.decayScore),
        linkProximity: linkProximityScore(memory, selectedIds)
      };
      const retrievalScore =
        parts.semantic * 0.45 + parts.recency * 0.2 + parts.importance * 0.3 + parts.linkProximity * 0.05;
      selectedIds.add(memory.id);
      return { ...memory, retrievalScore: Math.round(retrievalScore * 1000) / 1000, scoreParts: parts };
    })
    .filter((memory) => memory.isSeed || memory.agentScope === "core" || memory.retrievalScore > 0.15)
    .sort((left, right) => Number(right.isSeed) - Number(left.isSeed) || right.retrievalScore - left.retrievalScore);
  const seeds = scored.filter((memory) => memory.isSeed);
  const nonSeeds = scored.filter((memory) => !memory.isSeed).slice(0, Math.max(0, topK - seeds.length));
  return [...seeds, ...nonSeeds].slice(0, Math.max(topK, seeds.length));
}

export function searchOpinions(input: {
  orgId: string;
  question: string;
  opinions?: MuninOpinion[];
  topK?: number;
  now?: Date;
}): MuninOpinion[] {
  if (!input.orgId) throw new Error("orgId is required for Munin opinion search");
  const scoped = assertOrgScopedMemories(
    (input.opinions ?? buildFixtureOpinions(input.orgId))
      .filter((opinion) => opinion.orgId === input.orgId)
      .map(normalizeMuninOpinion)
      .filter((opinion) => isMemoryCurrentlyUsable({ memory: opinion, now: input.now })),
    input.orgId
  );
  return scoped
    .map((opinion) => ({ opinion, score: opinion.isSeed ? 1 : semanticScore(input.question, opinion.content) }))
    .filter(({ opinion, score }) => opinion.isSeed || score > 0.05)
    .sort((left, right) => Number(right.opinion.isSeed) - Number(left.opinion.isSeed) || right.score - left.score)
    .slice(0, input.topK ?? 4)
    .map(({ opinion }) => opinion);
}

export function buildRecallMemoryDraft(input: {
  orgId: string;
  userId?: string;
  question: string;
  answer: string;
  sourceRefs: SourceRef[];
  now?: Date;
}): MuninMemory {
  const nowIso = (input.now ?? new Date()).toISOString();
  return buildMemory({
    orgId: input.orgId,
    userId: input.userId,
    agentScope: "recall",
    memoryClass: "fact",
    sourceType: "huginn_inference",
    content: `Q: ${input.question}\nA: ${input.answer}`,
    salienceScore: 0.55,
    importance: 0.55,
    decayScore: 1,
    isSeed: false,
    status: "active",
    linkedMemoryIds: [],
    sourceRefs: input.sourceRefs,
    validFrom: nowIso,
    validTo: null,
    createdAt: nowIso,
    lastAccessedAt: nowIso
  });
}

export function toMuninMemoryRow(memory: MuninMemory) {
  const normalized = normalizeMuninMemory(memory);
  return {
    id: normalized.id,
    org_id: normalized.orgId,
    user_id: normalized.userId ?? null,
    memory_class: normalized.memoryClass,
    agent_scope: normalized.agentScope,
    source_type: normalized.sourceType,
    content: normalized.content,
    source_refs: normalized.sourceRefs,
    salience_score: normalized.salienceScore,
    importance: normalized.importance,
    decay_score: normalized.decayScore,
    is_seed: normalized.isSeed,
    status: normalized.status,
    linked_memory_ids: normalized.linkedMemoryIds,
    valid_from: normalized.validFrom,
    valid_to: normalized.validTo,
    created_at: normalized.createdAt,
    last_accessed_at: normalized.lastAccessedAt,
    provenance: normalized.provenance,
    source_hash: normalized.sourceHash,
    observed_at: normalized.observedAt,
    ingested_at: normalized.ingestedAt,
    supersedes: normalized.supersedes,
    parent_memory_ids: normalized.parentMemoryIds,
    review_status: normalized.reviewStatus
  };
}

export function toMuninOpinionRow(opinion: MuninOpinion) {
  const normalized = normalizeMuninOpinion(opinion);
  return {
    id: normalized.id,
    org_id: normalized.orgId,
    user_id: normalized.userId ?? null,
    source_type: normalized.sourceType,
    content: normalized.content,
    is_seed: normalized.isSeed,
    valid_from: normalized.validFrom,
    valid_to: normalized.validTo,
    created_at: normalized.createdAt,
    provenance: normalized.provenance,
    source_hash: normalized.sourceHash,
    observed_at: normalized.observedAt,
    ingested_at: normalized.ingestedAt,
    supersedes: normalized.supersedes,
    parent_memory_ids: normalized.parentMemoryIds,
    review_status: normalized.reviewStatus
  };
}

import { deterministicUuid } from "../pipeline/idempotency.ts";
import type { SourceRef } from "../pipeline/types.ts";
import type { AgentScope, MemoryClass, MemoryStatus, SourceType } from "./types.ts";

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
};

export type MuninOpinion = {
  id: string;
  orgId: string;
  userId?: string;
  sourceType: Extract<SourceType, "huginn_inference" | "user_seed" | "odim_derived">;
  content: string;
  isSeed: boolean;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
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

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token.length > 2)
  );
}

function semanticScore(question: string, content: string) {
  const questionTokens = tokenize(question);
  const contentTokens = tokenize(content);
  if (!questionTokens.size || !contentTokens.size) return 0;
  const overlap = [...questionTokens].filter((token) => contentTokens.has(token)).length;
  return overlap / Math.sqrt(questionTokens.size * contentTokens.size);
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
  return {
    ...input,
    id: deterministicUuid("munin_memory", {
      content: input.content,
      createdAt: input.createdAt,
      orgId: input.orgId,
      scope: input.agentScope
    })
  };
}

function buildOpinion(input: Omit<MuninOpinion, "id">) {
  return {
    ...input,
    id: deterministicUuid("munin_opinions", {
      content: input.content,
      createdAt: input.createdAt,
      orgId: input.orgId
    })
  };
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
      (memory) =>
        memory.orgId === input.orgId &&
        memory.status === "active" &&
        memory.validTo === null
    ),
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
}): MuninOpinion[] {
  if (!input.orgId) throw new Error("orgId is required for Munin opinion search");
  const scoped = assertOrgScopedMemories(
    (input.opinions ?? buildFixtureOpinions(input.orgId)).filter((opinion) => opinion.orgId === input.orgId && opinion.validTo === null),
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
  return {
    id: memory.id,
    org_id: memory.orgId,
    user_id: memory.userId ?? null,
    memory_class: memory.memoryClass,
    agent_scope: memory.agentScope,
    source_type: memory.sourceType,
    content: memory.content,
    source_refs: memory.sourceRefs,
    salience_score: memory.salienceScore,
    importance: memory.importance,
    decay_score: memory.decayScore,
    is_seed: memory.isSeed,
    status: memory.status,
    linked_memory_ids: memory.linkedMemoryIds,
    valid_from: memory.validFrom,
    valid_to: memory.validTo,
    created_at: memory.createdAt,
    last_accessed_at: memory.lastAccessedAt
  };
}

export function toMuninOpinionRow(opinion: MuninOpinion) {
  return {
    id: opinion.id,
    org_id: opinion.orgId,
    user_id: opinion.userId ?? null,
    source_type: opinion.sourceType,
    content: opinion.content,
    is_seed: opinion.isSeed,
    valid_from: opinion.validFrom,
    valid_to: opinion.validTo,
    created_at: opinion.createdAt
  };
}

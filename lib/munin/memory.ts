import { deterministicUuid } from "../pipeline/idempotency.ts";
import type { SourceRef } from "../pipeline/types.ts";

export type MuninMemory = {
  id: string;
  orgId: string;
  userId?: string;
  agentScope: "core" | "archival" | "recall";
  content: string;
  importance: number;
  decayScore: number;
  linkedMemoryIds: string[];
  sourceRefs: SourceRef[];
  createdAt: string;
  lastAccessedAt: string;
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
    content:
      "Org mandate: prioritize source-backed data center, power, water, and SPV signals. Never treat narrative as truth.",
    importance: 0.95,
    decayScore: 1,
    linkedMemoryIds: [],
    sourceRefs,
    createdAt: "2026-05-21T00:00:00.000Z",
    lastAccessedAt: "2026-05-21T00:00:00.000Z"
  });
  const archival = buildMemory({
    orgId,
    userId: "demo-user",
    agentScope: "archival",
    content:
      "Laidley LLC pattern: Louisiana building permit, water request, and large-load FERC evidence should be reviewed as an SPV cluster before official announcement.",
    importance: 0.87,
    decayScore: 0.93,
    linkedMemoryIds: [core.id],
    sourceRefs,
    createdAt: "2026-05-20T00:00:00.000Z",
    lastAccessedAt: "2026-05-22T00:00:00.000Z"
  });
  const recall = buildMemory({
    orgId,
    userId: "demo-user",
    agentScope: "recall",
    content:
      "Previous Huginn answer emphasized confidence, source refs, and Reality-to-Narrative divergence for Meta and Entergy infrastructure evidence.",
    importance: 0.72,
    decayScore: 0.88,
    linkedMemoryIds: [archival.id],
    sourceRefs,
    createdAt: "2026-05-22T00:00:00.000Z",
    lastAccessedAt: "2026-05-22T12:00:00.000Z"
  });
  const otherOrg = buildMemory({
    orgId: "other-org",
    userId: "other-user",
    agentScope: "core",
    content: "Other org confidential thesis: this memory must never appear in demo-org responses.",
    importance: 1,
    decayScore: 1,
    linkedMemoryIds: [],
    sourceRefs,
    createdAt: "2026-05-22T00:00:00.000Z",
    lastAccessedAt: "2026-05-22T12:00:00.000Z"
  });

  return [core, archival, recall, otherOrg];
}

export function assertOrgScoped(memory: MuninMemory, orgId: string) {
  if (memory.orgId !== orgId) throw new Error("Munin memory org isolation violation");
  return memory;
}

export function assertOrgScopedMemories(memories: MuninMemory[], orgId: string) {
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
  const scoped = assertOrgScopedMemories((input.memories ?? buildFixtureMemories(input.orgId)).filter((memory) => memory.orgId === input.orgId), input.orgId);

  return scoped
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
    .filter((memory) => memory.agentScope === "core" || memory.retrievalScore > 0.15)
    .sort((left, right) => right.retrievalScore - left.retrievalScore)
    .slice(0, topK);
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
    content: `Q: ${input.question}\nA: ${input.answer}`,
    importance: 0.55,
    decayScore: 1,
    linkedMemoryIds: [],
    sourceRefs: input.sourceRefs,
    createdAt: nowIso,
    lastAccessedAt: nowIso
  });
}

export function toMuninMemoryRow(memory: MuninMemory) {
  return {
    id: memory.id,
    org_id: memory.orgId,
    user_id: memory.userId ?? null,
    agent_scope: memory.agentScope,
    content: memory.content,
    source_refs: memory.sourceRefs,
    importance: memory.importance,
    decay_score: memory.decayScore,
    linked_memory_ids: memory.linkedMemoryIds,
    created_at: memory.createdAt,
    last_accessed_at: memory.lastAccessedAt
  };
}

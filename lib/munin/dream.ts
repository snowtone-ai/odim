import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import { buildFixtureMemories, toMuninMemoryRow, type MuninMemory } from "./memory.ts";
import { writeGate } from "./write-gate.ts";
import { clusterByEmbedding, consolidateCluster, detectContradictions, extractRecurringPatterns, resolveByRecency } from "./dream-phases.ts";
import { seedPrecomputedAnswer } from "../huginn/precompute.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";

export type DreamRun = {
  orgId: string;
  phaseSummary: Record<string, unknown>;
  diff: Record<string, unknown>;
  status: "pending_review";
};

let dreamRunning = false;

function readMuninSnapshot(orgId: string, memories = buildFixtureMemories(orgId)) {
  return memories.filter(
    (memory) =>
      memory.orgId === orgId &&
      memory.validTo === null &&
      memory.status === "active" &&
      !memory.isSeed &&
      (memory.memoryClass === "fact" || memory.memoryClass === "procedure")
  );
}

async function recordDreamRun(run: DreamRun) {
  if (!hasSupabaseWriteEnv()) return run;
  await createServiceSupabaseClient().from("munin_dream_runs").insert({
    org_id: run.orgId,
    phase_summary: run.phaseSummary,
    diff: run.diff,
    status: run.status
  });
  return run;
}

export async function dreamJob(input: { orgId: string; memories?: MuninMemory[] }) {
  if (dreamRunning) {
    console.warn("Dream job already running; skipping concurrent invocation", { orgId: input.orgId });
    return recordDreamRun({ orgId: input.orgId, phaseSummary: { skipped: true, reason: "concurrent_run" }, diff: {}, status: "pending_review" });
  }
  dreamRunning = true;
  try {
    if (process.env.DREAM_ENABLED !== "true" && (process.env.AI_PROVIDER ?? "mock") !== "mock") {
      return recordDreamRun({ orgId: input.orgId, phaseSummary: { skipped: true }, diff: {}, status: "pending_review" });
    }
    const snapshot = readMuninSnapshot(input.orgId, input.memories);
    const clusters = clusterByEmbedding(snapshot);
    const consolidationClusters = clusters.filter((cluster) => cluster.length >= 2);
    const consolidated = consolidationClusters.map(consolidateCluster);
    const contradictions = resolveByRecency(detectContradictions(snapshot));
    const promoted = extractRecurringPatterns(snapshot);
    const createdRows: MuninMemory[] = [];

  for (const item of [...consolidated.map((value) => ({ ...value, memoryClass: "fact" as const })), ...promoted.map((value) => ({ ...value, memoryClass: "procedure" as const }))]) {
    const gate = writeGate({
      orgId: input.orgId,
      content: item.content,
      sourceType: "odim_derived",
      memoryClass: item.memoryClass,
      novelty: 0.8,
      reliability: 0.8,
      certainty: 0.75
    });
    if (gate.action !== "WRITTEN_TO_MEMORY") continue;
    const now = new Date().toISOString();
    createdRows.push({
      id: deterministicUuid("munin_dream_memory", { orgId: input.orgId, content: item.content, memoryClass: item.memoryClass }),
      orgId: input.orgId,
      agentScope: item.memoryClass === "procedure" ? "core" : "archival",
      memoryClass: item.memoryClass,
      sourceType: "odim_derived",
      content: item.content,
      salienceScore: gate.salienceScore,
      importance: 0.8,
      decayScore: 1,
      isSeed: false,
      status: gate.status ?? "active",
      linkedMemoryIds: [],
      sourceRefs: item.sourceRefs,
      validFrom: now,
      validTo: null,
      createdAt: now,
      lastAccessedAt: now
    });
  }

  const supersededIds = consolidationClusters.flatMap((cluster) => cluster.map((memory) => memory.id));
  if (hasSupabaseWriteEnv() && createdRows.length) {
    const client = createServiceSupabaseClient();
    const { error } = await client.from("munin_memory").upsert(createdRows.map(toMuninMemoryRow), { onConflict: "id" });
    if (error) {
      console.error("Dream memory upsert failed", { orgId: input.orgId, error: error.message });
      throw new Error(`Dream memory upsert failed: ${error.message}`);
    }
    if (supersededIds.length) {
      await client
        .from("munin_memory")
        .update({ valid_to: new Date().toISOString(), status: "archived" })
        .in("id", supersededIds)
        .eq("org_id", input.orgId)
        .eq("is_seed", false);
    }
  }

  for (const row of createdRows.slice(0, 5)) {
    await seedPrecomputedAnswer({
      orgId: input.orgId,
      questionPattern: row.content,
      answer: `Precomputed from Dream: ${row.content}`,
      evidenceSnapshot: row.sourceRefs,
      confidence: 0.72,
      computedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      status: "active"
    });
  }

    return recordDreamRun({
      orgId: input.orgId,
      phaseSummary: {
        cluster: { clusters: clusters.length },
        consolidate: { created: consolidated.length },
        contradict: { detected: contradictions.length },
        promote: { created: promoted.length },
        preCompute: { created: createdRows.slice(0, 5).length }
      },
      diff: {
        immutableInputs: snapshot.map((memory) => memory.id),
        supersededByMvcc: supersededIds,
        createdRows: createdRows.map((memory) => ({ id: memory.id, memoryClass: memory.memoryClass })),
        contradictions: contradictions.map((item) => ({ left: item.left.id, right: item.right.id, winner: item.winner.id }))
      },
      status: "pending_review"
    });
  } finally {
    dreamRunning = false;
  }
}

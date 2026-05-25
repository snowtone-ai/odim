import type { MuninMemory } from "./memory.ts";

function tokens(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((token) => token.length > 2));
}

export function tokenOverlap(left: string, right: string) {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  return [...leftTokens].filter((token) => rightTokens.has(token)).length / Math.sqrt(leftTokens.size * rightTokens.size);
}

function sourceOverlap(left: MuninMemory, right: MuninMemory) {
  const leftSources = new Set(left.sourceRefs.map((source) => source.sourceId));
  const rightSources = new Set(right.sourceRefs.map((source) => source.sourceId));
  if (!leftSources.size || !rightSources.size) return 0;
  return [...leftSources].filter((source) => rightSources.has(source)).length / Math.sqrt(leftSources.size * rightSources.size);
}

function polarity(content: string) {
  const positive = /\b(increase|increased|approved|high|true|confirmed|executed|active)\b/i.test(content);
  const negative = /\b(decrease|decreased|denied|low|false|rejected|withdrawn|inactive)\b/i.test(content);
  if (positive && !negative) return "positive";
  if (negative && !positive) return "negative";
  return "mixed";
}

export function clusterByEmbedding(memories: MuninMemory[], threshold = 0.35) {
  const clusters: MuninMemory[][] = [];
  for (const memory of memories) {
    const cluster = clusters.find((candidate) =>
      candidate.some((item) => tokenOverlap(item.content, memory.content) * 0.8 + sourceOverlap(item, memory) * 0.2 >= threshold)
    );
    if (cluster) cluster.push(memory);
    else clusters.push([memory]);
  }
  return clusters;
}

export function consolidateCluster(cluster: MuninMemory[]) {
  const sourceRefs = cluster.flatMap((memory) => memory.sourceRefs);
  const uniqueContents = [...new Set(cluster.map((memory) => memory.content.trim()).filter(Boolean))];
  return {
    content: `Consolidated ${cluster.length} source-backed memories: ${uniqueContents.join(" | ")}`,
    sourceRefs
  };
}

export function detectContradictions(memories: MuninMemory[]) {
  const contradictions: Array<{ left: MuninMemory; right: MuninMemory; reason: string }> = [];
  for (const left of memories) {
    for (const right of memories) {
      if (left.id >= right.id) continue;
      const sameTopic = tokenOverlap(left.content, right.content) > 0.25 || sourceOverlap(left, right) > 0.5;
      const polarityConflict =
        (polarity(left.content) === "positive" && polarity(right.content) === "negative") ||
        (polarity(left.content) === "negative" && polarity(right.content) === "positive");
      if (sameTopic && polarityConflict) contradictions.push({ left, right, reason: "token-overlap polarity conflict" });
    }
  }
  return contradictions;
}

export function resolveByRecency(contradictions: Array<{ left: MuninMemory; right: MuninMemory; reason: string }>) {
  return contradictions.map((item) => {
    const leftTime = new Date(item.left.createdAt).valueOf();
    const rightTime = new Date(item.right.createdAt).valueOf();
    return { ...item, winner: leftTime >= rightTime ? item.left : item.right };
  });
}

export function extractRecurringPatterns(memories: MuninMemory[]) {
  const groups = clusterByEmbedding(memories, 0.28).filter((cluster) => cluster.length >= 3);
  return groups.map((cluster) => ({
    frequency: cluster.length,
    content: `Procedure pattern promoted from ${cluster.length} recurring facts: ${cluster[0]?.content ?? ""}`,
    sourceRefs: cluster.flatMap((memory) => memory.sourceRefs)
  }));
}

import type { SourceType, WriteGateCandidate, WriteGateResult } from "./types.ts";
import { invalidatePrecomputedAnswers } from "../huginn/precompute.ts";

const sourceReputation: Record<SourceType, number> = {
  primary_filing: 1,
  official_ir: 0.9,
  user_seed: 1,
  odim_derived: 0.7,
  huginn_inference: 0.5,
  web_narrative: 0
};

function clamp01(value: number | undefined, fallback = 1) {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

export function muninSalienceThreshold(env: NodeJS.ProcessEnv = process.env) {
  const value = Number(env.MUNIN_SALIENCE_THRESHOLD);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.55;
}

export function scoreSalience(candidate: WriteGateCandidate) {
  if (candidate.isSeed || candidate.memoryClass === "seed") return 1;
  return (
    sourceReputation[candidate.sourceType] *
    clamp01(candidate.novelty) *
    clamp01(candidate.reliability) *
    clamp01(candidate.certainty)
  );
}

export function writeGate(candidate: WriteGateCandidate, env: NodeJS.ProcessEnv = process.env): WriteGateResult {
  const salienceScore = Math.round(scoreSalience(candidate) * 1000) / 1000;

  if (candidate.sourceType === "web_narrative") {
    return {
      action: "REJECTED_FROM_MEMORY",
      table: "raw_signals",
      salienceScore,
      memoryClass: candidate.memoryClass,
      sourceType: candidate.sourceType,
      reason: "web_narrative is structurally blocked from munin_memory"
    };
  }

  if (candidate.memoryClass === "opinion") {
    return {
      action: "WRITTEN_TO_OPINIONS",
      table: "munin_opinions",
      salienceScore,
      memoryClass: candidate.memoryClass,
      sourceType: candidate.sourceType,
      reason: "opinion is physically separated from default Huginn evidence"
    };
  }

  const status = candidate.isSeed || candidate.memoryClass === "seed" || salienceScore >= muninSalienceThreshold(env) ? "active" : "archived";
  invalidatePrecomputedAnswers({ orgId: candidate.orgId, content: candidate.content });
  return {
    action: "WRITTEN_TO_MEMORY",
    table: "munin_memory",
    status,
    salienceScore,
    memoryClass: candidate.memoryClass,
    sourceType: candidate.sourceType,
    reason: status === "active" ? "salience met write-gate threshold" : "salience below threshold; retained as archived MVCC memory"
  };
}

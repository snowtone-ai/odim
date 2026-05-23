export type SpvCandidate = {
  parentName: string;
  confidence: number;
  evidence: string[];
};

export function rankSpvCandidates(candidates: SpvCandidate[]) {
  return [...candidates].sort((a, b) => b.confidence - a.confidence);
}

export function computeRealityDivergenceScore(realityScore: number, narrativeScore: number) {
  const boundedReality = Math.max(0, Math.min(100, realityScore));
  const boundedNarrative = Math.max(0, Math.min(100, narrativeScore));
  return boundedReality - boundedNarrative;
}

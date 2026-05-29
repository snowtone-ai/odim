import type { AlertDraft, NormalizedSignal } from "./types.ts";

export type SourceAttribution = {
  sourceId: string;
  signalCount: number;
  alertCount: number;
  averageConfidence: number;
  averageFreshness: number;
  contributionScore: number;
  qualityScore: number;
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeSourceAttribution(
  signals: NormalizedSignal[],
  alerts: AlertDraft[]
): SourceAttribution[] {
  const bySource = new Map<string, NormalizedSignal[]>();
  for (const signal of signals) {
    const current = bySource.get(signal.source) ?? [];
    current.push(signal);
    bySource.set(signal.source, current);
  }

  return Array.from(bySource.entries())
    .map(([sourceId, sourceSignals]) => {
      const alertCount = alerts.filter((alert) =>
        sourceSignals.some((signal) => signal.fingerprint === alert.signalFingerprint)
      ).length;
      const averageConfidence =
        sourceSignals.reduce((sum, signal) => sum + signal.confidence, 0) / Math.max(1, sourceSignals.length);
      const averageFreshness =
        sourceSignals.reduce((sum, signal) => sum + signal.freshness, 0) / Math.max(1, sourceSignals.length);
      const contributionScore = sourceSignals.length * 0.45 + alertCount * 2.5 + averageConfidence * 25;
      const qualityScore = averageConfidence * 0.65 + averageFreshness * 0.35;
      return {
        sourceId,
        signalCount: sourceSignals.length,
        alertCount,
        averageConfidence: round(averageConfidence, 3),
        averageFreshness: round(averageFreshness, 3),
        contributionScore: round(contributionScore),
        qualityScore: round(qualityScore, 3)
      };
    })
    .sort((left, right) => right.contributionScore - left.contributionScore);
}

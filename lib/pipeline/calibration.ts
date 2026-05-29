import type { AlertDraft, NormalizedSignal } from "./types.ts";

export type CalibrationObservation = {
  confidence: number;
  actual: boolean;
  signalId: string;
  source: string;
};

export type CalibrationBucket = {
  range: [number, number];
  predicted: number;
  actual: number;
  count: number;
  brier: number;
};

export type CalibrationReport = {
  buckets: CalibrationBucket[];
  overallBrier: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function bucketIndex(confidence: number) {
  return Math.min(9, Math.max(0, Math.floor(clamp(confidence, 0, 0.9999) * 10)));
}

export function buildCalibrationObservations(
  signals: NormalizedSignal[],
  alerts: AlertDraft[]
): CalibrationObservation[] {
  const alertedFingerprints = new Set(alerts.map((alert) => alert.signalFingerprint));
  return signals.map((signal) => ({
    confidence: clamp(signal.confidence, 0, 1),
    actual:
      alertedFingerprints.has(signal.fingerprint) ||
      signal.confidence >= 0.8 ||
      signal.freshness >= 0.9,
    signalId: signal.fingerprint,
    source: signal.source
  }));
}

export function buildCalibrationReport(observations: CalibrationObservation[]): CalibrationReport {
  const buckets = Array.from({ length: 10 }, (_, index) => {
    const lower = index / 10;
    const upper = lower + 0.1;
    const items = observations.filter((observation) => bucketIndex(observation.confidence) === index);
    const predicted =
      items.reduce((sum, observation) => sum + observation.confidence, 0) / Math.max(1, items.length);
    const actual =
      items.reduce((sum, observation) => sum + (observation.actual ? 1 : 0), 0) / Math.max(1, items.length);
    const brier =
      items.reduce((sum, observation) => sum + (observation.confidence - (observation.actual ? 1 : 0)) ** 2, 0) /
      Math.max(1, items.length);
    return {
      range: [round(lower, 1), round(upper, 1)] as [number, number],
      predicted: round(items.length ? predicted : (lower + upper) / 2),
      actual: round(items.length ? actual : 0),
      count: items.length,
      brier: round(items.length ? brier : 0)
    };
  });

  const overallBrier =
    observations.reduce(
      (sum, observation) => sum + (observation.confidence - (observation.actual ? 1 : 0)) ** 2,
      0
    ) / Math.max(1, observations.length);

  return { buckets, overallBrier: round(overallBrier) };
}

export function adjustConfidence(rawConfidence: number, report: CalibrationReport) {
  const index = bucketIndex(rawConfidence);
  const bucket = report.buckets[index];
  if (!bucket || bucket.count === 0) return clamp(rawConfidence, 0, 1);
  return round(clamp(bucket.actual, 0, 1));
}

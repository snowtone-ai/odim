import type { NormalizedSignal } from "./types.ts";

export type AnomalyEvent = {
  entityId: string;
  day: string;
  zScore: number;
  severity: "anomaly" | "critical";
  direction: "spike" | "drop";
  layer: string;
  count: number;
  baseline: number;
};

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function stddev(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
}

function matchesEntity(signal: NormalizedSignal, entityName: string) {
  const lower = entityName.toLowerCase();
  return [
    text(signal.payload.companyName),
    text(signal.payload.applicantRaw),
    text(signal.payload.applicant),
    text(signal.payload.entityName),
    text(signal.payload.subjectCompany),
    text(signal.payload.provider)
  ]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(lower) || lower.includes(value.toLowerCase()));
}

export function detectAnomalies(
  signals: NormalizedSignal[],
  entityId: string,
  entityName: string,
  windowDays = 30
): AnomalyEvent[] {
  const relevant = signals.filter((signal) => matchesEntity(signal, entityName));
  const grouped = new Map<string, Map<string, number>>();
  for (const signal of relevant) {
    const day = signal.observedAt.slice(0, 10);
    const perLayer = grouped.get(day) ?? new Map<string, number>();
    perLayer.set(signal.layer, (perLayer.get(signal.layer) ?? 0) + 1);
    grouped.set(day, perLayer);
  }

  const days = Array.from(grouped.keys()).sort();
  const events: AnomalyEvent[] = [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const historyDays = days.slice(Math.max(0, dayIndex - windowDays), dayIndex);
    if (historyDays.length < 5) continue;
    const current = grouped.get(days[dayIndex]) ?? new Map<string, number>();
    const layers = new Set<string>([
      ...Array.from(current.keys()),
      ...historyDays.flatMap((day) => Array.from(grouped.get(day)?.keys() ?? []))
    ]);

    for (const layer of layers) {
      const history = historyDays.map((day) => grouped.get(day)?.get(layer) ?? 0);
      const baseline = mean(history);
      const deviation = stddev(history);
      const count = current.get(layer) ?? 0;
      const zScore = deviation === 0 ? (count > baseline + 1 ? 3.5 : 0) : (count - baseline) / deviation;
      if (Math.abs(zScore) < 2) continue;
      events.push({
        entityId,
        day: days[dayIndex],
        zScore: round(zScore),
        severity: Math.abs(zScore) >= 3 ? "critical" : "anomaly",
        direction: zScore > 0 ? "spike" : "drop",
        layer,
        count,
        baseline: round(baseline)
      });
    }
  }
  return events.sort((left, right) => Math.abs(right.zScore) - Math.abs(left.zScore));
}

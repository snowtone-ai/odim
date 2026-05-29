export type FreshnessStatus = "fresh" | "stale" | "critical";

export type SourceWatermark = {
  sourceId: string;
  lastSuccessAt: string | null;
  lastObservedAt?: string | null;
  rawSignalCount?: number;
};

export type FreshnessReport = {
  sourceId: string;
  status: FreshnessStatus;
  hoursSinceUpdate: number;
  slaHours: number;
};

export const DEFAULT_SOURCE_SLA_HOURS: Record<string, number> = {
  "sec-edgar": 48,
  "sec-edgar-form4": 48,
  "sec-edgar-8k": 48,
  "sec-edgar-13dg": 72,
  "sec-edgar-13f": 24 * 90,
  "federal-register": 48,
  "fred-economic": 24,
  edinet: 72,
  "companies-house": 72,
  usaspending: 48
};

function hoursSince(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - Date.parse(value)) / (1000 * 60 * 60));
}

export function checkFreshness(
  watermarks: SourceWatermark[],
  slaMap: Record<string, number> = DEFAULT_SOURCE_SLA_HOURS
) {
  return watermarks.map((entry) => {
    const slaHours = slaMap[entry.sourceId] ?? 72;
    const hours = hoursSince(entry.lastSuccessAt ?? entry.lastObservedAt ?? null);
    const status: FreshnessStatus =
      !Number.isFinite(hours) || hours >= slaHours ? "critical" : hours >= slaHours * 0.75 ? "stale" : "fresh";
    return {
      sourceId: entry.sourceId,
      status,
      hoursSinceUpdate: Number.isFinite(hours) ? Math.round(hours * 10) / 10 : 9999,
      slaHours
    };
  });
}

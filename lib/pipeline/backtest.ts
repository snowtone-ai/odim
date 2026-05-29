import { sourceBackedPlan } from "../data.ts";

export type BacktestConfig = {
  startDate: string;
  endDate: string;
  sources: string[];
  entityFilter?: string;
  metric: "score" | "alert_accuracy" | "lead_time";
};

export type SourceBacktest = {
  hitRate: number;
  averageLeadTimeDays: number;
  falsePositiveRate: number;
  informationCoefficient: number;
};

export type BacktestResult = {
  hitRate: number;
  avgLeadTimeDays: number;
  falsePositiveRate: number;
  IC: number;
  bySource: Record<string, SourceBacktest>;
};

function daysBetween(left: string, right: string) {
  return Math.round((Date.parse(right) - Date.parse(left)) / 86_400_000);
}

export function runBacktest(config: BacktestConfig): BacktestResult {
  const start = Date.parse(config.startDate);
  const end = Date.parse(config.endDate);
  const relevantSignals = sourceBackedPlan.rawSignals.filter((signal) => {
    const observed = Date.parse(signal.observedAt);
    return observed >= start && observed <= end && (!config.sources.length || config.sources.includes(signal.source));
  });
  const relevantAlerts = sourceBackedPlan.alerts.filter((alert) => {
    const observed = Date.parse(alert.createdAt ?? alert.evidence[0]?.observedAt ?? config.startDate);
    return observed >= start && observed <= end;
  });

  const bySource = Object.fromEntries(
    [...new Set(relevantSignals.map((signal) => signal.source))].map((sourceId) => {
      const signals = relevantSignals.filter((signal) => signal.source === sourceId);
      const matchingAlerts = relevantAlerts.filter((alert) => alert.evidence.some((evidence) => evidence.sourceId === sourceId));
      const hitRate = Math.round((matchingAlerts.length / Math.max(1, signals.length)) * 100) / 100;
      const leadTimes = matchingAlerts.map((alert) => {
        const sourceDate = alert.evidence[0]?.observedAt ?? alert.createdAt ?? config.startDate;
        return Math.max(0, daysBetween(sourceDate, alert.createdAt ?? sourceDate));
      });
      const avgLeadTimeDays = leadTimes.reduce((sum, value) => sum + value, 0) / Math.max(1, leadTimes.length);
      const falsePositiveRate = Math.round((Math.max(0, signals.length - matchingAlerts.length) / Math.max(1, signals.length)) * 100) / 100;
      const informationCoefficient =
        Math.round(
          ((signals.reduce((sum, signal) => sum + signal.confidence, 0) / Math.max(1, signals.length)) - falsePositiveRate) * 100
        ) / 100;
      return [
        sourceId,
        {
          hitRate,
          averageLeadTimeDays: Math.round(avgLeadTimeDays * 100) / 100,
          falsePositiveRate,
          informationCoefficient
        }
      ];
    })
  ) as Record<string, SourceBacktest>;

  const rows = Object.values(bySource);
  return {
    hitRate: Math.round((rows.reduce((sum, row) => sum + row.hitRate, 0) / Math.max(1, rows.length)) * 100) / 100,
    avgLeadTimeDays:
      Math.round((rows.reduce((sum, row) => sum + row.averageLeadTimeDays, 0) / Math.max(1, rows.length)) * 100) / 100,
    falsePositiveRate:
      Math.round((rows.reduce((sum, row) => sum + row.falsePositiveRate, 0) / Math.max(1, rows.length)) * 100) / 100,
    IC: Math.round((rows.reduce((sum, row) => sum + row.informationCoefficient, 0) / Math.max(1, rows.length)) * 100) / 100,
    bySource
  };
}

import type { IngestionPlan } from "./types.ts";

export type DailyDiff = {
  newSignals: number;
  newAlerts: { critical: number; high: number; medium: number; low: number };
  entityScoreChanges: Array<{ entityId: string; name: string; scoreDelta: number; direction: "up" | "down" }>;
  newEntities: string[];
  topMovers: Array<{ entityId: string; name: string; reason: string }>;
  sourceUpdates: Array<{ sourceId: string; signalCount: number; lastUpdate: string }>;
};

function objectName(plan: IngestionPlan, entityId: string) {
  return String(plan.ontologyObjects.find((object) => object.id === entityId)?.attributes.name ?? entityId);
}

export function computeDailyDiff(today: IngestionPlan, yesterday: IngestionPlan): DailyDiff {
  const yesterdaySignals = new Set(yesterday.rawSignals.map((signal) => signal.fingerprint));
  const newSignals = today.rawSignals.filter((signal) => !yesterdaySignals.has(signal.fingerprint));
  const newAlerts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const alert of today.alerts) {
    if (alert.priority in newAlerts) newAlerts[alert.priority] += 1;
  }

  const yesterdayById = new Map(
    yesterday.ontologyObjects
      .filter((object) => object.objectType === "decision_maker")
      .map((object) => [object.id, Number(object.attributes.reality_score ?? 0)])
  );
  const entityScoreChanges = today.ontologyObjects
    .filter((object) => object.objectType === "decision_maker")
    .map((object) => {
      const score = Number(object.attributes.reality_score ?? 0);
      const previous = yesterdayById.get(object.id) ?? 0;
      return {
        entityId: object.id,
        name: String(object.attributes.name ?? object.id),
        scoreDelta: Math.round((score - previous) * 100) / 100,
        direction: score - previous >= 0 ? "up" : "down"
      } as const;
    })
    .filter((item) => item.scoreDelta !== 0)
    .sort((left, right) => Math.abs(right.scoreDelta) - Math.abs(left.scoreDelta));

  return {
    newSignals: newSignals.length,
    newAlerts,
    entityScoreChanges,
    newEntities: today.ontologyObjects
      .filter((object) => object.objectType === "decision_maker")
      .filter((object) => !yesterdayById.has(object.id))
      .map((object) => String(object.attributes.name ?? object.id)),
    topMovers: entityScoreChanges.slice(0, 5).map((item) => ({
      entityId: item.entityId,
      name: item.name,
      reason: item.direction === "up" ? "Score accelerated on new evidence" : "Score faded against prior baseline"
    })),
    sourceUpdates: Array.from(
      newSignals.reduce((map, signal) => {
        const current = map.get(signal.source) ?? { sourceId: signal.source, signalCount: 0, lastUpdate: signal.observedAt };
        current.signalCount += 1;
        current.lastUpdate = current.lastUpdate > signal.observedAt ? current.lastUpdate : signal.observedAt;
        map.set(signal.source, current);
        return map;
      }, new Map<string, { sourceId: string; signalCount: number; lastUpdate: string }>())
    ).map(([, value]) => value)
  };
}

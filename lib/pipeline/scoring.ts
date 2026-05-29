import type { NormalizedSignal, OntologyLinkDraft, OntologyObjectDraft } from "./types.ts";

export type EntityScore = {
  score: number;
  confidence: number;
  components: Record<string, number>;
};

type EntityMetrics = {
  entityId: string;
  signalVolume: number;
  signalDiversity: number;
  capitalIntensity: number;
  insiderSentiment: number;
  institutionalMove: number;
  regulatoryExposure: number;
  narrativeGap: number;
  confidenceBase: number;
};

const SCORE_WEIGHTS: Record<keyof Omit<EntityMetrics, "entityId" | "confidenceBase">, number> = {
  signalVolume: 0.2,
  signalDiversity: 0.15,
  capitalIntensity: 0.25,
  insiderSentiment: 0.15,
  institutionalMove: 0.1,
  regulatoryExposure: 0.1,
  narrativeGap: 0.05
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", "").replaceAll("$", ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[], avg: number) {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function zscore(value: number, values: number[]) {
  const avg = mean(values);
  const deviation = stddev(values, avg);
  if (deviation === 0) return 0;
  return (value - avg) / deviation;
}

function zscoreToPercent(value: number) {
  return clamp(Math.round((50 + value * 15) * 100) / 100, 0, 100);
}

function relatedSignalNames(signal: NormalizedSignal) {
  return [
    text(signal.payload.companyName),
    text(signal.payload.applicantRaw),
    text(signal.payload.applicant),
    text(signal.payload.assigneeName),
    text(signal.payload.provider),
    text(signal.payload.operator),
    text(signal.payload.facilityName),
    text(signal.payload.entityName),
    text(signal.payload.subjectCompany),
    text(signal.payload.reportingOwner)
  ]
    .filter(Boolean)
    .map((item) => item.toLowerCase());
}

function signalMatchesEntity(signal: NormalizedSignal, name: string) {
  const lowerName = name.toLowerCase();
  return relatedSignalNames(signal).some((candidate) => candidate.includes(lowerName) || lowerName.includes(candidate));
}

function signalsForEntity(entity: OntologyObjectDraft, signals: NormalizedSignal[]) {
  const name = text(entity.attributes.name);
  return signals.filter((signal) => signalMatchesEntity(signal, name));
}

function linkCountForEntity(entityId: string, links: OntologyLinkDraft[], linkType: string) {
  return links.filter((link) => link.fromObjectId === entityId && link.linkType === linkType).length;
}

function buildMetrics(
  entities: OntologyObjectDraft[],
  signals: NormalizedSignal[],
  links: OntologyLinkDraft[]
) {
  const now = Date.now();
  return entities.map((entity) => {
    const entitySignals = signalsForEntity(entity, signals).filter((signal) => {
      const observedAt = Date.parse(signal.observedAt);
      return Number.isFinite(observedAt) ? now - observedAt <= 30 * 24 * 60 * 60 * 1000 : true;
    });
    const realitySignals = entitySignals.filter((signal) => signal.layer !== "narrative");
    const narrativeSignals = entitySignals.filter((signal) => signal.layer === "narrative");
    const insiderSignals = entitySignals.filter((signal) => signal.source === "sec-edgar-form4");
    const holdingsSignals = entitySignals.filter((signal) => signal.source === "sec-edgar-13f");
    const regulatorySignals = entitySignals.filter((signal) =>
      ["federal-register", "state-puc-filings", "sec-edgar-8k", "edinet", "companies-house"].includes(signal.source)
    );

    return {
      entityId: entity.id,
      signalVolume: entitySignals.length,
      signalDiversity: new Set(realitySignals.map((signal) => signal.layer)).size,
      capitalIntensity:
        entitySignals.reduce((sum, signal) => sum + numberValue(signal.payload.amountUsd), 0) / 1_000_000 +
        linkCountForEntity(entity.id, links, "commits_capital_to") * 10,
      insiderSentiment: insiderSignals.reduce((sum, signal) => sum + numberValue(signal.payload.sentiment), 0),
      institutionalMove: holdingsSignals.reduce((sum, signal) => sum + numberValue(signal.payload.positionDeltaRatio), 0),
      regulatoryExposure: regulatorySignals.length,
      narrativeGap: realitySignals.length / Math.max(1, narrativeSignals.length || 1),
      confidenceBase: entitySignals.length
        ? mean(entitySignals.map((signal) => clamp(signal.confidence, 0, 1)))
        : 0.35
    } satisfies EntityMetrics;
  });
}

export function computeBatchEntityScores(
  entities: OntologyObjectDraft[],
  signals: NormalizedSignal[],
  links: OntologyLinkDraft[]
) {
  const decisionMakers = entities.filter((entity) => entity.objectType === "decision_maker");
  const metrics = buildMetrics(decisionMakers, signals, links);
  const scoreById = new Map<string, EntityScore>();

  for (const metric of metrics) {
    const components = Object.fromEntries(
      Object.keys(SCORE_WEIGHTS).map((key) => {
        const values = metrics.map((item) => item[key as keyof typeof SCORE_WEIGHTS]);
        return [key, zscoreToPercent(zscore(metric[key as keyof typeof SCORE_WEIGHTS], values))];
      })
    ) as Record<string, number>;
    const weighted = Object.entries(SCORE_WEIGHTS).reduce(
      (sum, [key, weight]) => sum + components[key] * weight,
      0
    );
    const completeness =
      Object.values(metric).filter((value) => typeof value === "number" && value > 0).length /
      Object.keys(metric).length;
    scoreById.set(metric.entityId, {
      score: Math.round(weighted * 100) / 100,
      confidence: Math.round(clamp(metric.confidenceBase * completeness, 0.2, 0.99) * 100) / 100,
      components
    });
  }

  return scoreById;
}

export function computeEntityScore(
  entityId: string,
  entities: OntologyObjectDraft[],
  signals: NormalizedSignal[],
  links: OntologyLinkDraft[]
) {
  return computeBatchEntityScores(entities, signals, links).get(entityId) ?? {
    score: 0,
    confidence: 0.2,
    components: {}
  };
}

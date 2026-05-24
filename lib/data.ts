import { buildFixtureRawSignals } from "./pipeline/fixtures.ts";
import { buildIngestionPlan } from "./pipeline/ontologize.ts";

const fixturePlan = buildIngestionPlan(buildFixtureRawSignals());

const layerLabels: Record<string, string> = {
  cash: "Cash",
  compute: "Compute",
  energy: "Energy",
  land: "Land",
  logistics: "Logistics",
  raw_materials: "Raw Materials",
  water: "Water"
};

export const layers = ["Energy", "Cash", "Land", "Compute", "Water", "Raw Materials", "Logistics"];

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", "").replaceAll("$", ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function formatCommitted(value: unknown) {
  const amount = numberValue(value);
  if (!amount) return "Source-backed";
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M`;
  return `$${amount.toLocaleString("en-US")}`;
}

export const entities = fixturePlan.ontologyObjects
  .filter((object) => object.objectType === "decision_maker")
  .slice(0, 6)
  .map((object, index) => ({
    name: String(object.attributes.name ?? "Unknown entity"),
    score: Number(object.attributes.reality_score) > 0 ? Number(object.attributes.reality_score) : 62 + index * 4,
    committed: formatCommitted(object.attributes.amount_usd),
    lead: 72 + index * 11,
    confidence: 0.62 + index * 0.04
  }));

export const alerts = fixturePlan.alerts.map((alert) => ({
  priority: alert.priority,
  title: alert.title,
  source: alert.evidence[0]?.sourceId ?? "source-backed",
  confidence: alert.confidence,
  description: alert.description,
  evidence: alert.evidence
}));

export const auditEvents = fixturePlan.auditEvents.slice(0, 12).map((event) => ({
  event: event.eventType,
  actor: event.actor,
  confidence: event.confidence,
  source: event.sourceRefs[0]?.sourceId ?? "source-backed",
  detail: event.detail
}));

export const signals = fixturePlan.rawSignals.map((signal) => ({
  layer: layerLabels[signal.layer] ?? signal.layer,
  source: signal.source,
  title: signal.sourceRefs[0]?.title ?? signal.externalId,
  confidence: signal.confidence,
  observedAt: signal.observedAt,
  payload: signal.payload
}));

export const sourceBackedPlan = fixturePlan;

export const layerActivity = layers.map((label) => {
  const layerKey = Object.entries(layerLabels).find(([, value]) => value === label)?.[0] ?? label.toLowerCase();
  const layerSignals = fixturePlan.rawSignals.filter((signal) => signal.layer === layerKey);
  const averageConfidence =
    layerSignals.reduce((sum, signal) => sum + signal.confidence, 0) / Math.max(1, layerSignals.length);
  return {
    layer: label,
    count: layerSignals.length,
    confidence: Math.round(averageConfidence * 100) / 100,
    source: layerSignals[0]?.source ?? "configured-source"
  };
});

export const capitalFlows = fixturePlan.ontologyLinks.slice(0, 8).map((link, index) => {
  const from = fixturePlan.ontologyObjects.find((object) => object.id === link.fromObjectId);
  const to = fixturePlan.ontologyObjects.find((object) => object.id === link.toObjectId);
  return {
    id: link.id,
    from: String(from?.attributes.name ?? from?.attributes.projectName ?? from?.objectType ?? "source object"),
    to: String(to?.attributes.name ?? to?.attributes.projectName ?? to?.objectType ?? "target object"),
    type: link.linkType,
    confidence: link.confidence,
    source: link.sourceRefs[0]?.sourceId ?? "source-backed",
    width: 18 + index * 7
  };
});

export const timelineEvents = fixturePlan.rawSignals
  .slice()
  .sort((left, right) => left.observedAt.localeCompare(right.observedAt))
  .map((signal) => ({
    date: signal.observedAt.slice(0, 10),
    layer: layerLabels[signal.layer] ?? signal.layer,
    title: signal.sourceRefs[0]?.title ?? signal.externalId,
    source: signal.source,
    confidence: signal.confidence
  }));

export const ontologyLinks = fixturePlan.ontologyLinks.map((link) => {
  const from = fixturePlan.ontologyObjects.find((object) => object.id === link.fromObjectId);
  const to = fixturePlan.ontologyObjects.find((object) => object.id === link.toObjectId);
  return {
    type: link.linkType,
    from: String(from?.attributes.name ?? from?.attributes.projectName ?? from?.objectType ?? "source object"),
    to: String(to?.attributes.name ?? to?.attributes.projectName ?? to?.objectType ?? "target object"),
    confidence: link.confidence,
    source: link.sourceRefs[0]?.sourceId ?? "source-backed"
  };
});

export const reasoningPreview = [
  {
    step: "scope",
    summary: "Org-scoped Munin memory and public ontology context are loaded separately.",
    source: "munin_org_isolation",
    confidence: 1
  },
  {
    step: "memory",
    summary: "Laidley LLC pattern is retrieved from org-scoped archival memory.",
    source: "fixture:munin",
    confidence: 0.87
  },
  {
    step: "ontology",
    summary: "FERC, permit, water, and narrative trigger evidence are assembled with source_refs.",
    source: "source-backed-plan",
    confidence: 0.74
  },
  {
    step: "answer",
    summary: "Huginn responds with confidence and cites evidence instead of predicting price.",
    source: "provider",
    confidence: 0.72
  }
];

export const watchlistBriefs = entities.slice(0, 4).map((entity, index) => ({
  name: entity.name,
  status: "tracked",
  brief: `${entity.name} has ${timelineEvents[index]?.layer ?? "Reality"} evidence with ${Math.round(entity.confidence * 100)}% confidence.`,
  source: timelineEvents[index]?.source ?? "source-backed"
}));

export const settingsControls = [
  {
    name: "Alert rules",
    status: "source-backed",
    detail: `${alerts.length} deterministic alert rules generated from source-backed signals.`
  },
  {
    name: "API access",
    status: "org-scoped",
    detail: "API reads apply public-or-org filters and Huginn requires orgId."
  },
  {
    name: "Team permissions",
    status: "rls-backed",
    detail: "Supabase RLS policies exist for Munin, ontology, alerts, and audit logs."
  },
  {
    name: "Ontology explorer",
    status: "typed",
    detail: `${fixturePlan.ontologyObjects.length} objects and ${fixturePlan.ontologyLinks.length} links are available for inspection.`
  }
];

export const realityLayers = [
  "energy",
  "cash",
  "land",
  "compute",
  "water",
  "raw_materials",
  "logistics"
] as const;

export const signalLayers = [...realityLayers, "narrative"] as const;

export type RealityLayer = (typeof realityLayers)[number];
export type SignalLayer = (typeof signalLayers)[number];

export type SourceRef = {
  sourceId: string;
  url: string;
  title: string;
  externalId?: string;
  observedAt?: string;
};

export type RawSignal = {
  layer: SignalLayer | string;
  source: string;
  externalId: string;
  orgId?: string | null;
  payload: Record<string, unknown>;
  observedAt: string;
  sourceRefs: SourceRef[];
  confidence?: number;
  freshness?: number;
  isProprietary?: boolean;
};

export type NormalizedSignal = RawSignal & {
  id: string;
  layer: SignalLayer;
  observedAt: string;
  fingerprint: string;
  confidence: number;
  freshness: number;
  isProprietary: boolean;
};

export type OntologyObjectDraft = {
  id: string;
  objectType: string;
  attributes: Record<string, unknown>;
  orgVisible: string | null;
  sourceRefs: SourceRef[];
};

export type OntologyLinkDraft = {
  id: string;
  fromObjectId: string;
  toObjectId: string;
  linkType: string;
  confidence: number;
  orgVisible: string | null;
  sourceRefs: SourceRef[];
};

export type AuditEventDraft = {
  id: string;
  dedupeKey: string;
  eventType: string;
  objectId?: string;
  orgId: string | null;
  actor: string;
  detail: Record<string, unknown>;
  confidence: number;
  sourceRefs: SourceRef[];
  createdAt: string;
};

export type AlertDraft = {
  id: string;
  dedupeKey: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  relatedObjectId?: string;
  evidence: SourceRef[];
  orgId: string | null;
  confidence: number;
  signalFingerprint: string;
  createdAt: string;
};

export type IngestionPlan = {
  rawSignals: NormalizedSignal[];
  ontologyObjects: OntologyObjectDraft[];
  ontologyLinks: OntologyLinkDraft[];
  alerts: AlertDraft[];
  auditEvents: AuditEventDraft[];
};

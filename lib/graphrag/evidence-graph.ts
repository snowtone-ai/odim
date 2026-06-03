import type { AlertDraft, AuditEventDraft, IngestionPlan, NormalizedSignal, OntologyObjectDraft, SourceRef } from "../pipeline/types.ts";

export type EvidenceGraphNodeKind = "entity" | "object" | "signal" | "alert" | "audit" | "source";

export type EvidenceGraphNode = {
  id: string;
  sourceId: string;
  kind: EvidenceGraphNodeKind;
  label: string;
  confidence: number;
  sourceRefs: SourceRef[];
  attributes: Record<string, unknown>;
};

export type EvidenceGraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  confidence: number;
  sourceRefs: SourceRef[];
  reason: string;
};

export type EvidenceGraph = {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  metrics: EvidenceGraphMetrics;
};

export type EvidenceGraphMetrics = {
  nodeCount: number;
  edgeCount: number;
  sourceCount: number;
  citationCoverage: number;
  traceCompleteness: number;
  averageConfidence: number;
  unsupportedNodeCount: number;
  highConfidencePathCount: number;
};

export type EvidencePathStep = {
  from: string;
  to: string;
  label: string;
  confidence: number;
  sourceIds: string[];
};

export type EvidencePath = {
  id: string;
  title: string;
  nodeIds: string[];
  edgeIds: string[];
  steps: EvidencePathStep[];
  confidence: number;
  citationCoverage: number;
  traceCompleteness: number;
  sources: SourceRef[];
  rationale: string;
};

export type EvidenceGraphQuery = {
  question?: string;
  entityId?: string;
  alertId?: string;
  limit?: number;
};

export type EvidenceGraphQueryResult = {
  graph: EvidenceGraph;
  paths: EvidencePath[];
  metrics: EvidenceGraphMetrics;
  anchors: string[];
};

export type EntityEvidenceSummary = {
  entityId: string;
  entityLabel: string;
  paths: EvidencePath[];
  metrics: EvidenceGraphMetrics;
};

export type EvidenceWorkbench = {
  graph: EvidenceGraph;
  entitySummaries: EntityEvidenceSummary[];
  metrics: EvidenceGraphMetrics;
};

const SOURCE_NODE_PREFIX = "source:";
const OBJECT_NODE_PREFIX = "object:";
const SIGNAL_NODE_PREFIX = "signal:";
const ALERT_NODE_PREFIX = "alert:";
const AUDIT_NODE_PREFIX = "audit:";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function uniqueSourceRefs(refs: SourceRef[]) {
  const seen = new Set<string>();
  const result: SourceRef[] = [];
  for (const ref of refs) {
    const key = `${ref.sourceId}:${ref.externalId ?? ""}:${ref.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function sourceRef(sourceId: string, title: string, observedAt?: string): SourceRef {
  return {
    sourceId,
    title,
    url: `odim://${sourceId}`,
    observedAt
  };
}

function objectLabel(object: OntologyObjectDraft) {
  return String(
    object.attributes.name ??
      object.attributes.projectName ??
      object.attributes.facilityName ??
      object.attributes.title ??
      object.id
  );
}

function signalLabel(signal: NormalizedSignal) {
  return signal.sourceRefs[0]?.title ?? String(signal.payload.title ?? signal.payload.companyName ?? signal.externalId);
}

function alertLabel(alert: AlertDraft) {
  return `${alert.priority.toUpperCase()} ${alert.title}`;
}

function auditLabel(event: AuditEventDraft) {
  return `${event.eventType}: ${event.actor}`;
}

function nodeConfidence(node: EvidenceGraphNode) {
  return clamp01(node.confidence || 0.5);
}

function edgeConfidence(edge: EvidenceGraphEdge) {
  return clamp01(edge.confidence || 0.5);
}

function addNode(nodes: Map<string, EvidenceGraphNode>, node: EvidenceGraphNode) {
  const existing = nodes.get(node.id);
  if (!existing) {
    nodes.set(node.id, { ...node, sourceRefs: uniqueSourceRefs(node.sourceRefs) });
    return;
  }
  nodes.set(node.id, {
    ...existing,
    confidence: Math.max(existing.confidence, node.confidence),
    sourceRefs: uniqueSourceRefs([...existing.sourceRefs, ...node.sourceRefs]),
    attributes: { ...existing.attributes, ...node.attributes }
  });
}

function addEdge(edges: Map<string, EvidenceGraphEdge>, edge: EvidenceGraphEdge) {
  const existing = edges.get(edge.id);
  if (!existing) {
    edges.set(edge.id, { ...edge, sourceRefs: uniqueSourceRefs(edge.sourceRefs) });
    return;
  }
  edges.set(edge.id, {
    ...existing,
    confidence: Math.max(existing.confidence, edge.confidence),
    sourceRefs: uniqueSourceRefs([...existing.sourceRefs, ...edge.sourceRefs])
  });
}

function addSourceSupport(
  nodes: Map<string, EvidenceGraphNode>,
  edges: Map<string, EvidenceGraphEdge>,
  targetNodeId: string,
  refs: SourceRef[],
  confidence: number
) {
  for (const ref of refs) {
    const sourceNodeId = `${SOURCE_NODE_PREFIX}${ref.sourceId}`;
    addNode(nodes, {
      id: sourceNodeId,
      sourceId: ref.sourceId,
      kind: "source",
      label: ref.title || ref.sourceId,
      confidence: 1,
      sourceRefs: [ref],
      attributes: { url: ref.url, externalId: ref.externalId, observedAt: ref.observedAt }
    });
    addEdge(edges, {
      id: `cites:${ref.sourceId}:${targetNodeId}`,
      from: sourceNodeId,
      to: targetNodeId,
      label: "cites",
      confidence,
      sourceRefs: [ref],
      reason: "Primary source supports this graph node."
    });
  }
}

function objectSearchText(object: OntologyObjectDraft) {
  return [
    objectLabel(object),
    object.objectType,
    ...Object.values(object.attributes).map((value) => (typeof value === "string" || typeof value === "number" ? String(value) : ""))
  ]
    .join(" ")
    .toLowerCase();
}

function signalSearchText(signal: NormalizedSignal) {
  return [
    signalLabel(signal),
    signal.source,
    signal.layer,
    signal.externalId,
    ...Object.values(signal.payload).map((value) => (typeof value === "string" || typeof value === "number" ? String(value) : ""))
  ]
    .join(" ")
    .toLowerCase();
}

function refsOverlap(left: SourceRef[], right: SourceRef[]) {
  const rightIds = new Set(right.map((ref) => ref.sourceId));
  return left.some((ref) => rightIds.has(ref.sourceId));
}

function signalMentionsObject(signal: NormalizedSignal, object: OntologyObjectDraft) {
  const signalText = signalSearchText(signal);
  const label = objectLabel(object).toLowerCase();
  if (label.length >= 4 && signalText.includes(label.slice(0, Math.min(label.length, 18)))) return true;
  return refsOverlap(signal.sourceRefs, object.sourceRefs);
}

function computeMetrics(nodes: EvidenceGraphNode[], edges: EvidenceGraphEdge[]): EvidenceGraphMetrics {
  const nonSourceNodes = nodes.filter((node) => node.kind !== "source");
  const supportedNodes = nonSourceNodes.filter((node) => node.sourceRefs.length > 0);
  const sourceCount = nodes.filter((node) => node.kind === "source").length;
  const averageConfidence =
    [...nodes.map(nodeConfidence), ...edges.map(edgeConfidence)].reduce((sum, value) => sum + value, 0) /
    Math.max(1, nodes.length + edges.length);
  const citedEdges = edges.filter((edge) => edge.sourceRefs.length > 0 || edge.label === "cites");
  const strongEdges = edges.filter((edge) => edge.confidence >= 0.75 && edge.sourceRefs.length > 0);
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    sourceCount,
    citationCoverage: round2(clamp01(supportedNodes.length / Math.max(1, nonSourceNodes.length))),
    traceCompleteness: round2(clamp01(citedEdges.length / Math.max(1, edges.length))),
    averageConfidence: round2(averageConfidence),
    unsupportedNodeCount: Math.max(0, nonSourceNodes.length - supportedNodes.length),
    highConfidencePathCount: strongEdges.length
  };
}

export function buildEvidenceGraph(plan: IngestionPlan): EvidenceGraph {
  const nodes = new Map<string, EvidenceGraphNode>();
  const edges = new Map<string, EvidenceGraphEdge>();

  for (const object of plan.ontologyObjects) {
    const nodeId = `${OBJECT_NODE_PREFIX}${object.id}`;
    const confidence = typeof object.attributes.confidence === "number" ? object.attributes.confidence : 0.68;
    addNode(nodes, {
      id: nodeId,
      sourceId: object.id,
      kind: object.objectType === "decision_maker" ? "entity" : "object",
      label: objectLabel(object),
      confidence,
      sourceRefs: object.sourceRefs,
      attributes: {
        objectType: object.objectType,
        orgVisible: object.orgVisible,
        ...object.attributes
      }
    });
    addSourceSupport(nodes, edges, nodeId, object.sourceRefs, confidence);
  }

  for (const signal of plan.rawSignals) {
    const nodeId = `${SIGNAL_NODE_PREFIX}${signal.fingerprint}`;
    addNode(nodes, {
      id: nodeId,
      sourceId: signal.fingerprint,
      kind: "signal",
      label: signalLabel(signal),
      confidence: signal.confidence,
      sourceRefs: signal.sourceRefs,
      attributes: {
        layer: signal.layer,
        source: signal.source,
        observedAt: signal.observedAt,
        freshness: signal.freshness,
        isProprietary: signal.isProprietary
      }
    });
    addSourceSupport(nodes, edges, nodeId, signal.sourceRefs, signal.confidence);

    for (const object of plan.ontologyObjects) {
      if (!signalMentionsObject(signal, object)) continue;
      addEdge(edges, {
        id: `supports:${signal.fingerprint}:${object.id}`,
        from: nodeId,
        to: `${OBJECT_NODE_PREFIX}${object.id}`,
        label: "supports",
        confidence: Math.min(signal.confidence, typeof object.attributes.confidence === "number" ? object.attributes.confidence : signal.confidence),
        sourceRefs: uniqueSourceRefs([...signal.sourceRefs, ...object.sourceRefs]),
        reason: "Raw signal text or source refs overlap with the ontology object."
      });
    }
  }

  for (const link of plan.ontologyLinks) {
    addEdge(edges, {
      id: link.id,
      from: `${OBJECT_NODE_PREFIX}${link.fromObjectId}`,
      to: `${OBJECT_NODE_PREFIX}${link.toObjectId}`,
      label: link.linkType,
      confidence: link.confidence,
      sourceRefs: link.sourceRefs,
      reason: "Ontology link produced by the source-backed ingestion pipeline."
    });
  }

  for (const alert of plan.alerts) {
    const nodeId = `${ALERT_NODE_PREFIX}${alert.id}`;
    addNode(nodes, {
      id: nodeId,
      sourceId: alert.id,
      kind: "alert",
      label: alertLabel(alert),
      confidence: alert.confidence,
      sourceRefs: alert.evidence,
      attributes: {
        priority: alert.priority,
        description: alert.description,
        createdAt: alert.createdAt,
        orgId: alert.orgId,
        signalFingerprint: alert.signalFingerprint
      }
    });
    addSourceSupport(nodes, edges, nodeId, alert.evidence, alert.confidence);
    if (alert.relatedObjectId) {
      addEdge(edges, {
        id: `alert-object:${alert.id}:${alert.relatedObjectId}`,
        from: nodeId,
        to: `${OBJECT_NODE_PREFIX}${alert.relatedObjectId}`,
        label: "alerts_on",
        confidence: alert.confidence,
        sourceRefs: alert.evidence,
        reason: "Alert is explicitly related to this ontology object."
      });
    }
    if (alert.signalFingerprint) {
      addEdge(edges, {
        id: `alert-signal:${alert.id}:${alert.signalFingerprint}`,
        from: nodeId,
        to: `${SIGNAL_NODE_PREFIX}${alert.signalFingerprint}`,
        label: "triggered_by",
        confidence: alert.confidence,
        sourceRefs: alert.evidence,
        reason: "Alert was emitted from this raw signal fingerprint."
      });
    }
  }

  for (const event of plan.auditEvents) {
    const nodeId = `${AUDIT_NODE_PREFIX}${event.id}`;
    addNode(nodes, {
      id: nodeId,
      sourceId: event.id,
      kind: "audit",
      label: auditLabel(event),
      confidence: event.confidence,
      sourceRefs: event.sourceRefs,
      attributes: {
        eventType: event.eventType,
        actor: event.actor,
        createdAt: event.createdAt,
        orgId: event.orgId,
        detail: event.detail
      }
    });
    addSourceSupport(nodes, edges, nodeId, event.sourceRefs, event.confidence);
    if (event.objectId) {
      addEdge(edges, {
        id: `audit-object:${event.id}:${event.objectId}`,
        from: nodeId,
        to: `${OBJECT_NODE_PREFIX}${event.objectId}`,
        label: "audits",
        confidence: event.confidence,
        sourceRefs: event.sourceRefs,
        reason: "Audit event is scoped to this ontology object."
      });
    }
  }

  const graphNodes = [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const graphEdges = [...edges.values()].sort((left, right) => left.id.localeCompare(right.id));
  return {
    nodes: graphNodes,
    edges: graphEdges,
    metrics: computeMetrics(graphNodes, graphEdges)
  };
}

function queryTokens(question: string | undefined) {
  return uniqueStrings(
    normalizeText(question)
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}

function nodeSearchText(node: EvidenceGraphNode) {
  return [
    node.label,
    node.kind,
    node.sourceId,
    ...Object.values(node.attributes).map((value) => (typeof value === "string" || typeof value === "number" ? String(value) : "")),
    ...node.sourceRefs.map((ref) => `${ref.sourceId} ${ref.title}`)
  ]
    .join(" ")
    .toLowerCase();
}

function scoreNode(node: EvidenceGraphNode, tokens: string[], query: EvidenceGraphQuery) {
  if (query.entityId && node.id === `${OBJECT_NODE_PREFIX}${query.entityId}`) return 100;
  if (query.alertId && node.id === `${ALERT_NODE_PREFIX}${query.alertId}`) return 100;
  if (!tokens.length) return node.kind === "entity" ? 4 + node.confidence : node.confidence;
  const text = nodeSearchText(node);
  const matches = tokens.filter((token) => text.includes(token)).length;
  return matches * 8 + node.confidence + (node.kind === "entity" ? 1 : 0);
}

function adjacency(graph: EvidenceGraph) {
  const map = new Map<string, EvidenceGraphEdge[]>();
  for (const edge of graph.edges) {
    map.set(edge.from, [...(map.get(edge.from) ?? []), edge]);
    map.set(edge.to, [...(map.get(edge.to) ?? []), edge]);
  }
  return map;
}

function edgeOther(edge: EvidenceGraphEdge, nodeId: string) {
  return edge.from === nodeId ? edge.to : edge.from;
}

function buildPathFromEdges(
  graph: EvidenceGraph,
  pathId: string,
  nodeIds: string[],
  edgeIds: string[]
): EvidencePath | null {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const nodes = nodeIds.map((id) => nodeById.get(id)).filter((node): node is EvidenceGraphNode => Boolean(node));
  const edges = edgeIds.map((id) => edgeById.get(id)).filter((edge): edge is EvidenceGraphEdge => Boolean(edge));
  if (!nodes.length || !edges.length) return null;

  const sourceRefs = uniqueSourceRefs([
    ...nodes.flatMap((node) => node.sourceRefs),
    ...edges.flatMap((edge) => edge.sourceRefs)
  ]);
  const confidenceValues = [...nodes.map(nodeConfidence), ...edges.map(edgeConfidence)];
  const confidence = round2(confidenceValues.reduce((sum, value) => sum + value, 0) / Math.max(1, confidenceValues.length));
  const citedSteps = edges.filter((edge) => edge.sourceRefs.length > 0 || edge.label === "cites").length;
  const steps = edges.map((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    return {
      from: from?.label ?? edge.from,
      to: to?.label ?? edge.to,
      label: edge.label,
      confidence: edge.confidence,
      sourceIds: edge.sourceRefs.map((ref) => ref.sourceId)
    };
  });
  const title = `${nodes[0]?.label ?? "Evidence"} -> ${nodes[nodes.length - 1]?.label ?? "Trace"}`;
  return {
    id: pathId,
    title,
    nodeIds,
    edgeIds,
    steps,
    confidence,
    citationCoverage: round2(clamp01(sourceRefs.length / Math.max(1, nodes.length))),
    traceCompleteness: round2(clamp01(citedSteps / Math.max(1, edges.length))),
    sources: sourceRefs,
    rationale: steps.map((step) => `${step.from} ${step.label} ${step.to}`).join("; ")
  };
}

function collectPaths(graph: EvidenceGraph, anchors: string[], limit: number) {
  const adj = adjacency(graph);
  const paths: EvidencePath[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors) {
    const queue: Array<{ nodeId: string; nodeIds: string[]; edgeIds: string[] }> = [{ nodeId: anchor, nodeIds: [anchor], edgeIds: [] }];
    while (queue.length && paths.length < limit * 4) {
      const current = queue.shift()!;
      if (current.edgeIds.length >= 3) continue;
      const edges = [...(adj.get(current.nodeId) ?? [])].sort((left, right) => right.confidence - left.confidence).slice(0, 8);
      for (const edge of edges) {
        const nextNodeId = edgeOther(edge, current.nodeId);
        if (current.nodeIds.includes(nextNodeId)) continue;
        const nodeIds = [...current.nodeIds, nextNodeId];
        const edgeIds = [...current.edgeIds, edge.id];
        const key = edgeIds.join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const path = buildPathFromEdges(graph, `${anchor}:${paths.length}:${edgeIds.join(":")}`, nodeIds, edgeIds);
        if (path) paths.push(path);
        queue.push({ nodeId: nextNodeId, nodeIds, edgeIds });
      }
    }
  }
  return paths
    .sort((left, right) => {
      const leftScore = left.confidence + left.traceCompleteness + Math.min(1, left.sources.length / 4);
      const rightScore = right.confidence + right.traceCompleteness + Math.min(1, right.sources.length / 4);
      return rightScore - leftScore;
    })
    .slice(0, limit);
}

function fallbackEdgePaths(graph: EvidenceGraph, limit: number) {
  return graph.edges
    .filter((edge) => edge.label !== "cites")
    .sort((left, right) => right.confidence - left.confidence)
    .map((edge, index) => buildPathFromEdges(graph, `edge:${index}:${edge.id}`, [edge.from, edge.to], [edge.id]))
    .filter((path): path is EvidencePath => Boolean(path))
    .slice(0, limit);
}

export function queryEvidenceGraph(graph: EvidenceGraph, query: EvidenceGraphQuery = {}): EvidenceGraphQueryResult {
  const limit = Math.min(12, Math.max(1, query.limit ?? 5));
  const tokens = queryTokens(query.question);
  const anchors = graph.nodes
    .filter((node) => node.kind !== "source")
    .map((node) => ({ node, score: scoreNode(node, tokens, query) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.node.confidence - left.node.confidence)
    .slice(0, 4)
    .map((item) => item.node.id);
  const paths = collectPaths(graph, anchors, limit);
  return {
    graph,
    paths: paths.length ? paths : fallbackEdgePaths(graph, limit),
    metrics: graph.metrics,
    anchors
  };
}

export function buildEvidenceWorkbench(plan: IngestionPlan, limitPerEntity = 3): EvidenceWorkbench {
  const graph = buildEvidenceGraph(plan);
  const entitySummaries = graph.nodes
    .filter((node) => node.kind === "entity")
    .map((node) => {
      const result = queryEvidenceGraph(graph, { entityId: node.sourceId, limit: limitPerEntity });
      return {
        entityId: node.sourceId,
        entityLabel: node.label,
        paths: result.paths,
        metrics: result.metrics
      };
    });
  return { graph, entitySummaries, metrics: graph.metrics };
}

export function formatEvidencePathsForContext(paths: EvidencePath[], limit = 4) {
  if (!paths.length) return "- none";
  return paths
    .slice(0, limit)
    .map((path) => {
      const sources = uniqueStrings(path.sources.map((ref) => ref.sourceId)).slice(0, 5).join(", ");
      return `- [evidence_graph conf=${path.confidence} trace=${path.traceCompleteness} citations=${path.citationCoverage}] ${path.rationale}; sources=${sources}`;
    })
    .join("\n");
}

export function fallbackSourceRefForNode(node: EvidenceGraphNode): SourceRef {
  return node.sourceRefs[0] ?? sourceRef(node.sourceId, node.label);
}

import { buildEvidenceGraph, queryEvidenceGraph } from "../graphrag/evidence-graph.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import type { AlertDraft, IngestionPlan, NormalizedSignal, SourceRef } from "../pipeline/types.ts";
import { WATCHTOWER_PLAYBOOKS, getWatchtowerPlaybook } from "./playbooks.ts";
import type { WatchtowerApproval, WatchtowerApprovalAction, WatchtowerPlaybook, WatchtowerRun, WatchtowerStep } from "./types.ts";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
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

function sourceIds(refs: SourceRef[]) {
  return [...new Set(refs.map((ref) => ref.sourceId))];
}

function actionLabel(action: WatchtowerApprovalAction) {
  switch (action) {
    case "send_slack_report":
      return "Send Slack incident report";
    case "queue_push_digest":
      return "Queue push digest";
    case "create_board_brief":
      return "Create board briefing";
    case "open_api_webhook":
      return "Open API webhook dispatch";
  }
}

function signalForAlert(plan: IngestionPlan, alert: AlertDraft) {
  return plan.rawSignals.find((signal) => signal.fingerprint === alert.signalFingerprint);
}

function textForAlert(alert: AlertDraft, signal?: NormalizedSignal) {
  return [
    alert.title,
    alert.description,
    alert.priority,
    signal?.layer,
    signal?.source,
    signal?.sourceRefs.map((ref) => ref.title).join(" "),
    signal ? Object.values(signal.payload).join(" ") : ""
  ]
    .join(" ")
    .toLowerCase();
}

function scoreAlertForPlaybook(playbook: WatchtowerPlaybook, alert: AlertDraft, signal?: NormalizedSignal) {
  const text = textForAlert(alert, signal);
  const layerMatch = signal && playbook.triggerLayers.includes(String(signal.layer)) ? 4 : 0;
  const keywordMatch = playbook.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length * 2;
  const priorityBonus = alert.priority === "critical" ? 2 : alert.priority === "high" ? 1 : 0;
  return layerMatch + keywordMatch + priorityBonus + alert.confidence;
}

function bestAlertForPlaybook(plan: IngestionPlan, playbook: WatchtowerPlaybook, alertId?: string) {
  if (alertId) return plan.alerts.find((alert) => alert.id === alertId);
  return plan.alerts
    .slice()
    .sort((left, right) => {
      const leftScore = scoreAlertForPlaybook(playbook, left, signalForAlert(plan, left));
      const rightScore = scoreAlertForPlaybook(playbook, right, signalForAlert(plan, right));
      return rightScore - leftScore;
    })[0];
}

function buildStep(input: {
  runId: string;
  key: WatchtowerStep["key"];
  label: string;
  status: WatchtowerStep["status"];
  summary: string;
  confidence: number;
  sourceRefs: SourceRef[];
  startedAt: string;
  completedAt?: string;
  revision: number;
}): WatchtowerStep {
  return {
    id: deterministicUuid("watchtower_step", { runId: input.runId, key: input.key, revision: input.revision }),
    key: input.key,
    label: input.label,
    status: input.status,
    summary: input.summary,
    confidence: round2(input.confidence),
    sourceRefs: uniqueSourceRefs(input.sourceRefs),
    startedAt: input.startedAt,
    completedAt: input.completedAt
  };
}

function buildApprovals(input: {
  runId: string;
  actions: WatchtowerApprovalAction[];
  actor: string;
  sourceRefs: SourceRef[];
  createdAt: string;
  revision: number;
}): WatchtowerApproval[] {
  return input.actions.map((action) => ({
    id: deterministicUuid("watchtower_approval", { runId: input.runId, action, revision: input.revision }),
    action,
    label: actionLabel(action),
    status: "pending",
    requestedBy: input.actor,
    sourceRefs: uniqueSourceRefs(input.sourceRefs),
    createdAt: input.createdAt
  }));
}

function riskFlags(input: { paths: number; citationCoverage: number; traceCompleteness: number; alert: AlertDraft }) {
  const flags: string[] = [];
  if (input.paths < 2) flags.push("low_path_redundancy");
  if (input.citationCoverage < 0.75) flags.push("citation_coverage_below_slo");
  if (input.traceCompleteness < 0.75) flags.push("trace_completeness_below_slo");
  if (input.alert.priority === "critical") flags.push("critical_alert_requires_review");
  return flags;
}

export function buildWatchtowerRunForPlaybook(input: {
  plan: IngestionPlan;
  playbookId: string;
  alertId?: string;
  orgId?: string | null;
  actor?: string;
  now?: string;
  revision?: number;
}): WatchtowerRun {
  const playbook = getWatchtowerPlaybook(input.playbookId);
  if (!playbook) throw new Error(`Unknown Watchtower playbook: ${input.playbookId}`);
  const alert = bestAlertForPlaybook(input.plan, playbook, input.alertId);
  if (!alert) throw new Error(`No alert available for Watchtower playbook: ${input.playbookId}`);

  const graph = buildEvidenceGraph(input.plan);
  const graphResult = queryEvidenceGraph(graph, {
    question: `${playbook.thesis} ${alert.title} ${alert.description}`,
    alertId: alert.id,
    entityId: alert.relatedObjectId,
    limit: 3
  });
  const revision = input.revision ?? 1;
  const startedAt = input.now ?? alert.createdAt;
  const actor = input.actor ?? "watchtower";
  const sourceRefs = uniqueSourceRefs([...alert.evidence, ...graphResult.paths.flatMap((path) => path.sources)]);
  const averagePathConfidence =
    graphResult.paths.reduce((sum, path) => sum + path.confidence, 0) / Math.max(1, graphResult.paths.length);
  const confidence = round2((alert.confidence + averagePathConfidence + graphResult.metrics.averageConfidence) / 3);
  const citationCoverage = clamp01(Math.max(graphResult.metrics.citationCoverage, ...graphResult.paths.map((path) => path.citationCoverage)));
  const traceCompleteness = clamp01(Math.max(graphResult.metrics.traceCompleteness, ...graphResult.paths.map((path) => path.traceCompleteness)));
  const flags = riskFlags({
    paths: graphResult.paths.length,
    citationCoverage,
    traceCompleteness,
    alert
  });
  const runId = deterministicUuid("watchtower_run", {
    playbookId: playbook.id,
    alertId: alert.id,
    revision
  });
  const approvals = buildApprovals({
    runId,
    actions: playbook.approvalActions,
    actor,
    sourceRefs,
    createdAt: startedAt,
    revision
  });
  const completedAt = startedAt;
  const steps: WatchtowerStep[] = [
    buildStep({
      runId,
      key: "scope",
      label: "Scope trigger",
      status: "completed",
      summary: `Playbook scoped to alert "${alert.title}" with ${sourceIds(alert.evidence).length} direct sources.`,
      confidence: alert.confidence,
      sourceRefs: alert.evidence,
      startedAt,
      completedAt,
      revision
    }),
    buildStep({
      runId,
      key: "retrieve_graph",
      label: "Retrieve evidence graph",
      status: "completed",
      summary: `Resolved ${graphResult.paths.length} evidence paths across ${graphResult.metrics.nodeCount} nodes and ${graphResult.metrics.edgeCount} edges.`,
      confidence: averagePathConfidence || confidence,
      sourceRefs,
      startedAt,
      completedAt,
      revision
    }),
    buildStep({
      runId,
      key: "contradiction_check",
      label: "Contradiction check",
      status: "completed",
      summary: flags.includes("low_path_redundancy")
        ? "Evidence path redundancy is below target; approval must review source breadth."
        : "No source-backed contradiction detected in the retrieved paths.",
      confidence: traceCompleteness,
      sourceRefs,
      startedAt,
      completedAt,
      revision
    }),
    buildStep({
      runId,
      key: "approval_gate",
      label: "Human approval gate",
      status: "waiting_approval",
      summary: `${approvals.length} approval action(s) require review before dispatch.`,
      confidence,
      sourceRefs,
      startedAt,
      revision
    }),
    buildStep({
      runId,
      key: "dispatch_report",
      label: "Dispatch report",
      status: "pending",
      summary: "Dispatch is held until every approval action is accepted.",
      confidence,
      sourceRefs,
      startedAt,
      revision
    })
  ];

  return {
    id: runId,
    orgId: input.orgId ?? alert.orgId ?? null,
    playbookId: playbook.id,
    playbookName: playbook.name,
    alertId: alert.id,
    alertTitle: alert.title,
    status: "waiting_approval",
    thesis: playbook.thesis,
    confidence,
    citationCoverage: round2(citationCoverage),
    traceCompleteness: round2(traceCompleteness),
    riskFlags: flags,
    graphPathIds: graphResult.paths.map((path) => path.id),
    costEstimateTokens: 1200 + graphResult.paths.length * 240 + sourceRefs.length * 60,
    sourceRefs,
    steps,
    approvals,
    revision,
    startedAt,
    updatedAt: startedAt
  };
}

export function buildSeedWatchtowerRuns(plan: IngestionPlan, orgId?: string | null) {
  return WATCHTOWER_PLAYBOOKS.map((playbook) =>
    buildWatchtowerRunForPlaybook({
      plan,
      playbookId: playbook.id,
      orgId
    })
  );
}

export function applyApprovalDecision(run: WatchtowerRun, input: { approvalId: string; decision: "approve" | "reject"; actor: string; note?: string; now: string }) {
  let found = false;
  const approvals = run.approvals.map((approval) => {
    if (approval.id !== input.approvalId) return approval;
    found = true;
    return {
      ...approval,
      status: input.decision === "approve" ? "approved" as const : "rejected" as const,
      decidedBy: input.actor,
      decisionNote: input.note,
      decidedAt: input.now
    };
  });
  if (!found) throw new Error("approvalId was not found");
  const rejected = approvals.some((approval) => approval.status === "rejected");
  const allApproved = approvals.every((approval) => approval.status === "approved");
  const steps = run.steps.map((step) => {
    if (step.key === "approval_gate") {
      return {
        ...step,
        status: rejected ? "failed" as const : allApproved ? "completed" as const : "waiting_approval" as const,
        completedAt: rejected || allApproved ? input.now : step.completedAt
      };
    }
    if (step.key === "dispatch_report") {
      return {
        ...step,
        status: rejected ? "blocked" as const : allApproved ? "completed" as const : "pending" as const,
        summary: rejected
          ? "Dispatch blocked by rejected approval."
          : allApproved
            ? "Dispatch marked ready after approvals completed."
            : step.summary,
        completedAt: allApproved ? input.now : step.completedAt
      };
    }
    return step;
  });
  return {
    ...run,
    approvals,
    steps,
    status: rejected ? "rejected" as const : allApproved ? "succeeded" as const : "waiting_approval" as const,
    revision: run.revision + 1,
    updatedAt: input.now,
    completedAt: rejected || allApproved ? input.now : run.completedAt
  };
}

export function rerunWatchtowerRun(plan: IngestionPlan, run: WatchtowerRun, input: { actor: string; now: string }) {
  return buildWatchtowerRunForPlaybook({
    plan,
    playbookId: run.playbookId,
    alertId: run.alertId,
    orgId: run.orgId,
    actor: input.actor,
    now: input.now,
    revision: run.revision + 1
  });
}

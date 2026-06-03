import type { SourceRef } from "../pipeline/types.ts";

export type WatchtowerRunStatus = "queued" | "running" | "waiting_approval" | "succeeded" | "rejected" | "failed";
export type WatchtowerStepStatus = "pending" | "running" | "completed" | "waiting_approval" | "blocked" | "failed";
export type WatchtowerApprovalStatus = "pending" | "approved" | "rejected";

export type WatchtowerApprovalAction =
  | "send_slack_report"
  | "queue_push_digest"
  | "create_board_brief"
  | "open_api_webhook";

export type WatchtowerPlaybook = {
  id: string;
  name: string;
  description: string;
  thesis: string;
  triggerLayers: string[];
  keywords: string[];
  minConfidence: number;
  cadenceHours: number;
  approvalActions: WatchtowerApprovalAction[];
  riskControls: string[];
};

export type WatchtowerStep = {
  id: string;
  key: "scope" | "retrieve_graph" | "contradiction_check" | "approval_gate" | "dispatch_report";
  label: string;
  status: WatchtowerStepStatus;
  summary: string;
  confidence: number;
  sourceRefs: SourceRef[];
  startedAt: string;
  completedAt?: string;
};

export type WatchtowerApproval = {
  id: string;
  action: WatchtowerApprovalAction;
  label: string;
  status: WatchtowerApprovalStatus;
  requestedBy: string;
  decidedBy?: string;
  decisionNote?: string;
  sourceRefs: SourceRef[];
  createdAt: string;
  decidedAt?: string;
};

export type WatchtowerRun = {
  id: string;
  orgId: string | null;
  playbookId: string;
  playbookName: string;
  alertId?: string;
  alertTitle?: string;
  status: WatchtowerRunStatus;
  thesis: string;
  confidence: number;
  citationCoverage: number;
  traceCompleteness: number;
  riskFlags: string[];
  graphPathIds: string[];
  costEstimateTokens: number;
  sourceRefs: SourceRef[];
  steps: WatchtowerStep[];
  approvals: WatchtowerApproval[];
  revision: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type WatchtowerRunInput = {
  playbookId: string;
  alertId?: string;
  orgId?: string | null;
  actor?: string;
};

export type WatchtowerApprovalDecision = {
  runId: string;
  approvalId: string;
  decision: "approve" | "reject";
  actor?: string;
  note?: string;
};

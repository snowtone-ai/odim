import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tenantOrPublicFilter, type OrgContext } from "../api/org.ts";
import { sourceBackedPlan } from "../data.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import { loadEvidencePlan } from "./evidence-graph.ts";
import { createServerSupabaseReadClient, createServiceSupabaseClient, hasSupabaseReadEnv, hasSupabaseWriteEnv } from "../supabase/client.ts";
import { WATCHTOWER_PLAYBOOKS } from "../watchtower/playbooks.ts";
import {
  applyApprovalDecision,
  buildSeedWatchtowerRuns,
  buildWatchtowerRunForPlaybook,
  rerunWatchtowerRun
} from "../watchtower/workflows.ts";
import type { WatchtowerApproval, WatchtowerApprovalDecision, WatchtowerRun, WatchtowerRunInput, WatchtowerStep } from "../watchtower/types.ts";

type JsonRecord = Record<string, unknown>;

const LOCAL_STORE_DIR = path.join(process.cwd(), ".odim");
const LOCAL_STORE_FILE = path.join(LOCAL_STORE_DIR, "watchtower-runs.json");
const MAX_LOCAL_RUNS = 100;
let localWriteQueue: Promise<unknown> = Promise.resolve();

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the table|relation .* does not exist/i.test(message);
}

function assertSupabaseWriteEnv() {
  if (!hasSupabaseWriteEnv() && isProductionRuntime()) {
    throw new Error("Supabase write environment is required in production");
  }
}

function assertWatchtowerWriteScope(orgId: string | null | undefined) {
  if (!hasSupabaseWriteEnv()) return;
  if (orgId) return;
  if (process.env.WATCHTOWER_ALLOW_PUBLIC_RUNS === "true") return;
  throw new Error("orgId is required for Watchtower Supabase writes");
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toRunRow(run: WatchtowerRun) {
  return {
    id: run.id,
    org_id: run.orgId,
    playbook_id: run.playbookId,
    playbook_name: run.playbookName,
    alert_id: run.alertId ?? null,
    alert_title: run.alertTitle ?? null,
    status: run.status,
    thesis: run.thesis,
    confidence: run.confidence,
    citation_coverage: run.citationCoverage,
    trace_completeness: run.traceCompleteness,
    risk_flags: run.riskFlags,
    graph_path_ids: run.graphPathIds,
    cost_estimate_tokens: run.costEstimateTokens,
    source_refs: run.sourceRefs,
    revision: run.revision,
    started_at: run.startedAt,
    updated_at: run.updatedAt,
    completed_at: run.completedAt ?? null
  };
}

function toStepRow(runId: string, step: WatchtowerStep) {
  return {
    id: step.id,
    run_id: runId,
    step_key: step.key,
    label: step.label,
    status: step.status,
    summary: step.summary,
    confidence: step.confidence,
    source_refs: step.sourceRefs,
    started_at: step.startedAt,
    completed_at: step.completedAt ?? null
  };
}

function toApprovalRow(runId: string, approval: WatchtowerApproval) {
  return {
    id: approval.id,
    run_id: runId,
    action: approval.action,
    label: approval.label,
    status: approval.status,
    requested_by: approval.requestedBy,
    decided_by: approval.decidedBy ?? null,
    decision_note: approval.decisionNote ?? null,
    source_refs: approval.sourceRefs,
    created_at: approval.createdAt,
    decided_at: approval.decidedAt ?? null
  };
}

function fromRunRow(row: JsonRecord, steps: WatchtowerStep[], approvals: WatchtowerApproval[]): WatchtowerRun {
  return {
    id: String(row.id),
    orgId: row.org_id ? String(row.org_id) : null,
    playbookId: String(row.playbook_id),
    playbookName: String(row.playbook_name),
    alertId: row.alert_id ? String(row.alert_id) : undefined,
    alertTitle: row.alert_title ? String(row.alert_title) : undefined,
    status: String(row.status) as WatchtowerRun["status"],
    thesis: String(row.thesis),
    confidence: Number(row.confidence ?? 0),
    citationCoverage: Number(row.citation_coverage ?? 0),
    traceCompleteness: Number(row.trace_completeness ?? 0),
    riskFlags: jsonArray(row.risk_flags).map(String),
    graphPathIds: jsonArray(row.graph_path_ids).map(String),
    costEstimateTokens: Number(row.cost_estimate_tokens ?? 0),
    sourceRefs: jsonArray(row.source_refs) as WatchtowerRun["sourceRefs"],
    revision: Number(row.revision ?? 1),
    startedAt: String(row.started_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    steps,
    approvals
  };
}

function fromStepRow(row: JsonRecord): WatchtowerStep {
  return {
    id: String(row.id),
    key: String(row.step_key) as WatchtowerStep["key"],
    label: String(row.label),
    status: String(row.status) as WatchtowerStep["status"],
    summary: String(row.summary),
    confidence: Number(row.confidence ?? 0),
    sourceRefs: jsonArray(row.source_refs) as WatchtowerStep["sourceRefs"],
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined
  };
}

function fromApprovalRow(row: JsonRecord): WatchtowerApproval {
  return {
    id: String(row.id),
    action: String(row.action) as WatchtowerApproval["action"],
    label: String(row.label),
    status: String(row.status) as WatchtowerApproval["status"],
    requestedBy: String(row.requested_by),
    decidedBy: row.decided_by ? String(row.decided_by) : undefined,
    decisionNote: row.decision_note ? String(row.decision_note) : undefined,
    sourceRefs: jsonArray(row.source_refs) as WatchtowerApproval["sourceRefs"],
    createdAt: String(row.created_at),
    decidedAt: row.decided_at ? String(row.decided_at) : undefined
  };
}

function localSeedRuns(context: OrgContext = {}) {
  return buildSeedWatchtowerRuns(sourceBackedPlan, context.orgId);
}

function readLocalRuns(context: OrgContext = {}) {
  const seed = localSeedRuns(context);
  if (!existsSync(LOCAL_STORE_FILE)) return seed;
  const parsed = JSON.parse(readFileSync(LOCAL_STORE_FILE, "utf8")) as WatchtowerRun[];
  const scoped = parsed.filter((run) => !context.orgId || !run.orgId || run.orgId === context.orgId);
  const byId = new Map(seed.map((run) => [run.id, run]));
  for (const run of scoped) byId.set(run.id, run);
  return [...byId.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function writeLocalRuns(runs: WatchtowerRun[]) {
  mkdirSync(LOCAL_STORE_DIR, { recursive: true });
  const bounded = runs
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_LOCAL_RUNS);
  const tempFile = `${LOCAL_STORE_FILE}.${process.pid}.tmp`;
  writeFileSync(tempFile, JSON.stringify(bounded, null, 2));
  renameSync(tempFile, LOCAL_STORE_FILE);
}

async function withLocalRunsLock<T>(operation: () => T | Promise<T>) {
  const previous = localWriteQueue;
  let release: () => void = () => {};
  localWriteQueue = new Promise((resolve) => {
    release = () => resolve(undefined);
  });
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
  }
}

async function listSupabaseRuns(context: OrgContext = {}) {
  const client = createServerSupabaseReadClient();
  const { data, error } = await client
    .from("watchtower_runs")
    .select(
      "id, org_id, playbook_id, playbook_name, alert_id, alert_title, status, thesis, confidence, citation_coverage, trace_completeness, risk_flags, graph_path_ids, cost_estimate_tokens, source_refs, revision, started_at, updated_at, completed_at"
    )
    .or(tenantOrPublicFilter("org_id", context.orgId))
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as JsonRecord[];
  if (!rows.length) return [];
  const runIds = rows.map((row) => String(row.id));
  const [stepsResult, approvalsResult] = await Promise.all([
    client
      .from("watchtower_run_steps")
      .select("id, run_id, step_key, label, status, summary, confidence, source_refs, started_at, completed_at")
      .in("run_id", runIds)
      .order("started_at", { ascending: true }),
    client
      .from("watchtower_approvals")
      .select("id, run_id, action, label, status, requested_by, decided_by, decision_note, source_refs, created_at, decided_at")
      .in("run_id", runIds)
      .order("created_at", { ascending: true })
  ]);
  if (stepsResult.error) throw new Error(stepsResult.error.message);
  if (approvalsResult.error) throw new Error(approvalsResult.error.message);
  const stepsByRun = new Map<string, WatchtowerStep[]>();
  for (const row of (stepsResult.data ?? []) as JsonRecord[]) {
    const runId = String(row.run_id);
    stepsByRun.set(runId, [...(stepsByRun.get(runId) ?? []), fromStepRow(row)]);
  }
  const approvalsByRun = new Map<string, WatchtowerApproval[]>();
  for (const row of (approvalsResult.data ?? []) as JsonRecord[]) {
    const runId = String(row.run_id);
    approvalsByRun.set(runId, [...(approvalsByRun.get(runId) ?? []), fromApprovalRow(row)]);
  }
  return rows.map((row) => fromRunRow(row, stepsByRun.get(String(row.id)) ?? [], approvalsByRun.get(String(row.id)) ?? []));
}

async function upsertSupabaseRun(run: WatchtowerRun) {
  assertWatchtowerWriteScope(run.orgId);
  const client = createServiceSupabaseClient();
  const { error: runError } = await client.from("watchtower_runs").upsert(toRunRow(run), { onConflict: "id" });
  if (runError) throw new Error(runError.message);
  const { error: stepError } = await client
    .from("watchtower_run_steps")
    .upsert(run.steps.map((step) => toStepRow(run.id, step)), { onConflict: "id" });
  if (stepError) throw new Error(stepError.message);
  const { error: approvalError } = await client
    .from("watchtower_approvals")
    .upsert(run.approvals.map((approval) => toApprovalRow(run.id, approval)), { onConflict: "id" });
  if (approvalError) throw new Error(approvalError.message);
}

async function updateSupabaseRunWithRevision(run: WatchtowerRun, expectedRevision: number) {
  assertWatchtowerWriteScope(run.orgId);
  const client = createServiceSupabaseClient();
  const { data, error: runError } = await client
    .from("watchtower_runs")
    .update(toRunRow(run))
    .eq("id", run.id)
    .eq("revision", expectedRevision)
    .select("id")
    .maybeSingle();
  if (runError) throw new Error(runError.message);
  if (!data) throw new Error("Watchtower run was modified by another request; refresh and retry");
  const { error: stepError } = await client
    .from("watchtower_run_steps")
    .upsert(run.steps.map((step) => toStepRow(run.id, step)), { onConflict: "id" });
  if (stepError) throw new Error(stepError.message);
  const { error: approvalError } = await client
    .from("watchtower_approvals")
    .upsert(run.approvals.map((approval) => toApprovalRow(run.id, approval)), { onConflict: "id" });
  if (approvalError) throw new Error(approvalError.message);
}

export function listWatchtowerPlaybooks() {
  return WATCHTOWER_PLAYBOOKS;
}

export async function listWatchtowerRuns(context: OrgContext = {}) {
  if (!hasSupabaseReadEnv()) return { runs: readLocalRuns(context), source: "fallback" as const };
  try {
    const runs = await listSupabaseRuns(context);
    return { runs: runs.length ? runs : readLocalRuns(context), source: runs.length ? "supabase" as const : "fallback" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (shouldFallbackFromSupabaseError(message)) return { runs: readLocalRuns(context), source: "fallback" as const };
    throw new Error(`watchtower runs read failed: ${message}`);
  }
}

export async function startWatchtowerRun(input: WatchtowerRunInput, context: OrgContext = {}) {
  const orgId = input.orgId ?? context.orgId ?? null;
  const planResult = await loadEvidencePlan({ orgId: orgId ?? undefined });
  const existing = await listWatchtowerRuns({ orgId: orgId ?? undefined });
  const matching = existing.runs
    .filter((run) => run.playbookId === input.playbookId && (!input.alertId || run.alertId === input.alertId))
    .sort((left, right) => right.revision - left.revision)[0];
  const run = buildWatchtowerRunForPlaybook({
    plan: planResult.plan,
    playbookId: input.playbookId,
    alertId: input.alertId,
    orgId,
    actor: input.actor ?? "watchtower",
    now: new Date().toISOString(),
    revision: (matching?.revision ?? 0) + 1
  });
  if (hasSupabaseWriteEnv()) {
    await upsertSupabaseRun(run);
  } else {
    assertSupabaseWriteEnv();
    await withLocalRunsLock(() => {
      const runs = readLocalRuns({ orgId: orgId ?? undefined }).filter((candidate) => candidate.id !== run.id);
      writeLocalRuns([run, ...runs]);
    });
  }
  return run;
}

export async function updateWatchtowerApproval(input: WatchtowerApprovalDecision, context: OrgContext = {}) {
  const payload = await listWatchtowerRuns(context);
  const run = payload.runs.find((candidate) => candidate.id === input.runId);
  if (!run) throw new Error("runId was not found");
  const updated = applyApprovalDecision(run, {
    approvalId: input.approvalId,
    decision: input.decision,
    actor: input.actor ?? "watchtower",
    note: input.note,
    now: new Date().toISOString()
  });
  if (hasSupabaseWriteEnv()) {
    await updateSupabaseRunWithRevision(updated, run.revision);
  } else {
    assertSupabaseWriteEnv();
    await withLocalRunsLock(() => {
      const latestPayload = readLocalRuns(context);
      const latest = latestPayload.find((candidate) => candidate.id === input.runId);
      if (!latest) throw new Error("runId was not found");
      if (latest.revision !== run.revision) {
        throw new Error("Watchtower run was modified by another request; refresh and retry");
      }
      writeLocalRuns(latestPayload.map((candidate) => candidate.id === updated.id ? updated : candidate));
    });
  }
  return updated;
}

export async function rerunWatchtower(input: { runId: string; actor?: string }, context: OrgContext = {}) {
  const payload = await listWatchtowerRuns(context);
  const run = payload.runs.find((candidate) => candidate.id === input.runId);
  if (!run) throw new Error("runId was not found");
  const planResult = await loadEvidencePlan({ orgId: run.orgId ?? context.orgId });
  const updated = rerunWatchtowerRun(planResult.plan, run, {
    actor: input.actor ?? "watchtower",
    now: new Date().toISOString()
  });
  if (hasSupabaseWriteEnv()) {
    await upsertSupabaseRun(updated);
  } else {
    assertSupabaseWriteEnv();
    await withLocalRunsLock(() => {
      const runs = readLocalRuns(context).filter((candidate) => candidate.id !== updated.id);
      writeLocalRuns([updated, ...runs]);
    });
  }
  return updated;
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sourceBackedPlan } from "../lib/data.ts";
import { buildEvidenceGraph, queryEvidenceGraph } from "../lib/graphrag/evidence-graph.ts";
import { answerHuginnQuestion } from "../lib/huginn/query.ts";
import { WATCHTOWER_PLAYBOOKS } from "../lib/watchtower/playbooks.ts";
import {
  applyApprovalDecision,
  buildWatchtowerRunForPlaybook,
  rerunWatchtowerRun
} from "../lib/watchtower/workflows.ts";

function withoutSupabaseEnv(run) {
  const snapshot = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    REPOSITORY_SUPABASE_STRICT: process.env.REPOSITORY_SUPABASE_STRICT,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.REPOSITORY_SUPABASE_STRICT = "false";
  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

function assertBoundedMetric(value) {
  assert.ok(Number.isFinite(value));
  assert.ok(value >= 0);
  assert.ok(value <= 1);
}

test("Evidence GraphRAG materializes cited graph paths with bounded quality metrics", () => {
  const graph = buildEvidenceGraph(sourceBackedPlan);
  const result = queryEvidenceGraph(graph, {
    question: "Which compute, power, land, and water evidence supports AI infrastructure buildout?",
    limit: 5
  });

  assert.ok(graph.nodes.length > 0);
  assert.ok(graph.edges.length > 0);
  assert.ok(result.paths.length > 0);
  assert.ok(result.paths.every((path) => path.sources.length > 0));
  assert.ok(result.paths.some((path) => path.steps.some((step) => step.sourceIds.length > 0)));

  for (const metric of [
    result.metrics.citationCoverage,
    result.metrics.traceCompleteness,
    result.metrics.averageConfidence,
    ...result.paths.flatMap((path) => [path.confidence, path.citationCoverage, path.traceCompleteness])
  ]) {
    assertBoundedMetric(metric);
  }
});

test("Huginn injects evidence graph paths into reasoning and model context", async () => {
  await withoutSupabaseEnv(async () => {
    let capturedContext = "";
    const response = await answerHuginnQuestion({
      orgId: "demo-org",
      question: "Which AI data center buildout evidence is source-backed?",
      generate: async (request) => {
        capturedContext = request.context;
        return {
          answer: "Source-backed graph paths show converging compute, energy, and land evidence.",
          model: "test-model",
          confidence: 0.82,
          sources: ["test-generator"]
        };
      }
    });

    assert.ok(response.evidenceGraph);
    assert.ok(response.evidenceGraph.paths.length > 0);
    assert.ok(response.retrieval_layers_used.includes("evidence_graph"));
    assert.ok(response.reasoningTrace.some((step) => step.step === "evidence_graph"));
    assert.match(capturedContext, /Evidence graph paths:/);
    assert.match(capturedContext, /\[evidence_graph conf=/);
  });
});

test("Watchtower workflows require approval before dispatch and support deterministic reruns", () => {
  const playbook = WATCHTOWER_PLAYBOOKS[0];
  const run = buildWatchtowerRunForPlaybook({
    plan: sourceBackedPlan,
    playbookId: playbook.id,
    orgId: "demo-org",
    actor: "test-agent",
    now: "2026-06-03T00:00:00.000Z"
  });

  assert.equal(run.status, "waiting_approval");
  assert.equal(run.steps.at(-2)?.key, "approval_gate");
  assert.equal(run.steps.at(-1)?.status, "pending");
  assert.ok(run.approvals.length >= 1);
  assert.ok(run.sourceRefs.length > 0);
  assertBoundedMetric(run.citationCoverage);
  assertBoundedMetric(run.traceCompleteness);

  const partiallyApproved = applyApprovalDecision(run, {
    approvalId: run.approvals[0].id,
    decision: "approve",
    actor: "human-reviewer",
    now: "2026-06-03T00:05:00.000Z"
  });
  const fullyApproved = partiallyApproved.approvals
    .filter((approval) => approval.status === "pending")
    .reduce(
      (current, approval, index) =>
        applyApprovalDecision(current, {
          approvalId: approval.id,
          decision: "approve",
          actor: "human-reviewer",
          now: `2026-06-03T00:0${index + 6}:00.000Z`
        }),
      partiallyApproved
    );

  assert.equal(fullyApproved.status, "succeeded");
  assert.equal(fullyApproved.steps.find((step) => step.key === "dispatch_report")?.status, "completed");

  const rejected = applyApprovalDecision(run, {
    approvalId: run.approvals[0].id,
    decision: "reject",
    actor: "human-reviewer",
    now: "2026-06-03T00:10:00.000Z"
  });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.steps.find((step) => step.key === "dispatch_report")?.status, "blocked");

  const rerun = rerunWatchtowerRun(sourceBackedPlan, run, {
    actor: "test-agent",
    now: "2026-06-03T01:00:00.000Z"
  });
  assert.equal(rerun.revision, run.revision + 1);
  assert.notEqual(rerun.id, run.id);
});

test("AI-native workflow migration is registered with RLS scope policies", () => {
  const runner = readFileSync("scripts/apply-db-migrations.mjs", "utf8");
  const migration = readFileSync("supabase/migrations/0010_ai_native_workflows.sql", "utf8");

  assert.match(runner, /0010_ai_native_workflows\.sql/);
  for (const table of ["watchtower_runs", "watchtower_run_steps", "watchtower_approvals"]) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`));
    assert.match(migration, new RegExp(`alter table ${table} enable row level security`));
  }
  assert.match(migration, /org_id = current_request_org_id\(\)/);
  assert.match(migration, /grant all privileges on watchtower_runs, watchtower_run_steps, watchtower_approvals to service_role/);
});

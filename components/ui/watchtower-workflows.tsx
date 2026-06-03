"use client";

import { useMemo, useState } from "react";

type WatchtowerApproval = {
  id: string;
  label: string;
  status: "pending" | "approved" | "rejected";
};

type WatchtowerStep = {
  id: string;
  key: string;
  label: string;
  status: string;
  summary: string;
  confidence: number;
};

export type WatchtowerRunView = {
  id: string;
  playbookId: string;
  playbookName: string;
  alertId?: string;
  alertTitle?: string;
  status: string;
  thesis: string;
  confidence: number;
  citationCoverage: number;
  traceCompleteness: number;
  riskFlags: string[];
  costEstimateTokens: number;
  sourceRefs: Array<{ sourceId: string; title: string; url: string }>;
  steps: WatchtowerStep[];
  approvals: WatchtowerApproval[];
  revision: number;
  updatedAt: string;
};

export type WatchtowerPlaybookView = {
  id: string;
  name: string;
  description: string;
  thesis: string;
  triggerLayers: string[];
  cadenceHours: number;
  minConfidence: number;
};

export type WatchtowerLabels = {
  title: string;
  playbooks: string;
  runs: string;
  approvals: string;
  start: string;
  approve: string;
  reject: string;
  rerun: string;
  citations: string;
  trace: string;
  cost: string;
  risks: string;
};

const STATUS_COLOR: Record<string, string> = {
  waiting_approval: "var(--rune)",
  succeeded: "var(--positive, #22c55e)",
  rejected: "var(--critical)",
  failed: "var(--critical)",
  running: "#60a5fa",
  queued: "var(--text-tertiary)"
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

async function postAction(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  return payload as { run: WatchtowerRunView };
}

export function WatchtowerWorkflows({
  initialRuns,
  playbooks,
  labels,
  compact = false
}: Readonly<{
  initialRuns: WatchtowerRunView[];
  playbooks: WatchtowerPlaybookView[];
  labels: WatchtowerLabels;
  compact?: boolean;
}>) {
  const [runs, setRuns] = useState<WatchtowerRunView[]>(initialRuns);
  const [selectedRunId, setSelectedRunId] = useState(initialRuns[0]?.id ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0];
  const runCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const run of runs) map.set(run.playbookId, (map.get(run.playbookId) ?? 0) + 1);
    return map;
  }, [runs]);

  function upsertRun(run: WatchtowerRunView) {
    setRuns((current) => [run, ...current.filter((candidate) => candidate.id !== run.id)]);
    setSelectedRunId(run.id);
  }

  async function handleStart(playbookId: string) {
    setPending(`start:${playbookId}`);
    setError(null);
    try {
      const payload = await postAction("/api/watchtower/runs", { playbookId, actor: "dashboard" });
      upsertRun(payload.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(null);
    }
  }

  async function handleApproval(approvalId: string, decision: "approve" | "reject") {
    if (!selectedRun) return;
    setPending(`${decision}:${approvalId}`);
    setError(null);
    try {
      const payload = await postAction("/api/watchtower/approvals", {
        runId: selectedRun.id,
        approvalId,
        decision,
        actor: "dashboard"
      });
      upsertRun(payload.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(null);
    }
  }

  async function handleRerun() {
    if (!selectedRun) return;
    setPending(`rerun:${selectedRun.id}`);
    setError(null);
    try {
      const payload = await postAction("/api/watchtower/rerun", { runId: selectedRun.id, actor: "dashboard" });
      upsertRun(payload.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
            {labels.title}
          </div>
          {selectedRun ? (
            <div className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {selectedRun.thesis}
            </div>
          ) : null}
        </div>
        {selectedRun ? (
          <button
            type="button"
            onClick={handleRerun}
            disabled={pending !== null}
            className="mono rounded-[var(--radius-sm)] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] transition-colors disabled:opacity-50"
            style={{ background: "var(--ink-750)", border: "1px solid var(--line-faint)", color: "var(--text-secondary)" }}
          >
            {labels.rerun}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-[var(--radius-sm)] px-3 py-2 text-[12px]" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "var(--critical)" }}>
          {error}
        </div>
      ) : null}

      {!compact ? (
        <div>
          <div className="mono mb-2 text-[9px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
            {labels.playbooks}
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {playbooks.map((playbook) => (
              <div
                key={playbook.id}
                className="rounded-[var(--radius-sm)] px-3 py-2.5"
                style={{ background: "var(--ink-850)", border: "1px solid var(--line-faint)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {playbook.name}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                      {playbook.description}
                    </div>
                  </div>
                  <span className="mono shrink-0 text-[10px]" style={{ color: "var(--rune)" }}>
                    {runCounts.get(playbook.id) ?? 0}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="mono text-[9px] uppercase tracking-[0.08em]" style={{ color: "var(--text-quaternary)" }}>
                    {playbook.cadenceHours}h / {percent(playbook.minConfidence)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStart(playbook.id)}
                    disabled={pending !== null}
                    className="mono rounded-[var(--radius-xs)] px-2 py-1 text-[9px] uppercase tracking-[0.08em] disabled:opacity-50"
                    style={{ background: "var(--rune-wash)", border: "1px solid rgba(201,169,97,0.18)", color: "var(--rune)" }}
                  >
                    {pending === `start:${playbook.id}` ? "..." : labels.start}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,320px)_1fr]">
        <div>
          <div className="mono mb-2 text-[9px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
            {labels.runs}
          </div>
          <div className="grid gap-1.5">
            {runs.map((run) => {
              const selected = selectedRun?.id === run.id;
              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  className="w-full rounded-[var(--radius-sm)] px-3 py-2 text-left transition-colors"
                  style={{
                    background: selected ? "rgba(201,169,97,0.07)" : "var(--ink-850)",
                    border: `1px solid ${selected ? "rgba(201,169,97,0.22)" : "var(--line-faint)"}`
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>
                      {run.playbookName}
                    </span>
                    <span className="mono shrink-0 text-[9px] uppercase tracking-[0.08em]" style={{ color: STATUS_COLOR[run.status] ?? "var(--text-tertiary)" }}>
                      {run.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mono mt-1 truncate text-[9px] uppercase tracking-[0.08em]" style={{ color: "var(--text-quaternary)" }}>
                    r{run.revision} · {run.updatedAt.slice(0, 10)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedRun ? (
          <div className="rounded-[var(--radius-sm)] px-3 py-3" style={{ background: "var(--ink-850)", border: "1px solid var(--line-faint)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {selectedRun.alertTitle ?? selectedRun.playbookName}
                </div>
                <div className="mono mt-1 text-[9px] uppercase tracking-[0.1em]" style={{ color: STATUS_COLOR[selectedRun.status] ?? "var(--text-tertiary)" }}>
                  {selectedRun.status.replaceAll("_", " ")}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="mono rounded-[3px] px-2 py-1 text-[8px] uppercase tracking-[0.08em]" style={{ background: "var(--ink-900)", color: "var(--text-tertiary)" }}>
                  {labels.citations}<span className="ml-1 text-[10px]" style={{ color: "var(--rune)" }}>{percent(selectedRun.citationCoverage)}</span>
                </div>
                <div className="mono rounded-[3px] px-2 py-1 text-[8px] uppercase tracking-[0.08em]" style={{ background: "var(--ink-900)", color: "var(--text-tertiary)" }}>
                  {labels.trace}<span className="ml-1 text-[10px]" style={{ color: "var(--rune)" }}>{percent(selectedRun.traceCompleteness)}</span>
                </div>
                <div className="mono rounded-[3px] px-2 py-1 text-[8px] uppercase tracking-[0.08em]" style={{ background: "var(--ink-900)", color: "var(--text-tertiary)" }}>
                  {labels.cost}<span className="ml-1 text-[10px]" style={{ color: "var(--rune)" }}>{selectedRun.costEstimateTokens}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {selectedRun.steps.map((step) => (
                <div key={step.id} className="grid grid-cols-[92px_1fr_auto] gap-2 py-2 text-[11px]" style={{ borderTop: "1px solid var(--line-faint)" }}>
                  <span className="mono uppercase tracking-[0.08em]" style={{ color: STATUS_COLOR[step.status] ?? "var(--text-tertiary)" }}>
                    {step.status.replaceAll("_", " ")}
                  </span>
                  <span className="min-w-0" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--text-primary)" }}>{step.label}</span>
                    <span className="ml-1.5 line-clamp-1">{step.summary}</span>
                  </span>
                  <span className="mono tabular-nums" style={{ color: "var(--rune)" }}>
                    {percent(step.confidence)}
                  </span>
                </div>
              ))}
            </div>

            {selectedRun.riskFlags.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
                  {labels.risks}
                </span>
                {selectedRun.riskFlags.map((risk) => (
                  <span key={risk} className="mono rounded-[3px] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.06em]" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.16)", color: "var(--critical)" }}>
                    {risk.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-4">
              <div className="mono mb-2 text-[9px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
                {labels.approvals}
              </div>
              <div className="grid gap-2">
                {selectedRun.approvals.map((approval) => (
                  <div key={approval.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-2" style={{ background: "var(--ink-900)", border: "1px solid var(--line-faint)" }}>
                    <div>
                      <div className="text-[12px]" style={{ color: "var(--text-primary)" }}>{approval.label}</div>
                      <div className="mono mt-0.5 text-[9px] uppercase tracking-[0.08em]" style={{ color: STATUS_COLOR[approval.status] ?? "var(--text-tertiary)" }}>{approval.status}</div>
                    </div>
                    {approval.status === "pending" ? (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApproval(approval.id, "approve")}
                          disabled={pending !== null}
                          className="mono rounded-[var(--radius-xs)] px-2 py-1 text-[9px] uppercase tracking-[0.08em] disabled:opacity-50"
                          style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.18)", color: "var(--positive, #22c55e)" }}
                        >
                          {labels.approve}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproval(approval.id, "reject")}
                          disabled={pending !== null}
                          className="mono rounded-[var(--radius-xs)] px-2 py-1 text-[9px] uppercase tracking-[0.08em] disabled:opacity-50"
                          style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.18)", color: "var(--critical)" }}
                        >
                          {labels.reject}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

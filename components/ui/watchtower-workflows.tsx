"use client";

import { useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

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
  working?: string;
  noSelection?: string;
  noPlaybooks?: string;
  noRuns?: string;
  executionTrace?: string;
  noTrace?: string;
  sourceCoverage?: string;
  noSources?: string;
  view?: string;
  requestFailed?: string;
};

const STATUS_COLOR: Record<string, string> = {
  waiting_approval: "var(--signal)",
  succeeded: "var(--evidence)",
  approved: "var(--evidence)",
  rejected: "var(--critical)",
  failed: "var(--critical)",
  running: "var(--signal)",
  queued: "var(--text-tertiary)",
  pending: "var(--signal)"
};

function percent(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) + "%";
}

function statusColor(status: string) {
  return STATUS_COLOR[status] ?? "var(--text-tertiary)";
}

function statusLabel(status: string, locale: "en" | "ja") {
  if (locale === "ja") {
    return ({
      waiting_approval: "承認待ち",
      succeeded: "完了",
      approved: "承認済み",
      rejected: "却下",
      failed: "失敗",
      running: "実行中",
      queued: "待機中",
      pending: "未処理",
      completed: "完了",
      blocked: "停止"
    } as Record<string, string>)[status] ?? status;
  }
  return status.replaceAll("_", " ");
}

async function postAction(endpoint: string, body: Record<string, unknown>, requestFailed: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(requestFailed);
  return payload as { run: WatchtowerRunView };
}

const PLAYBOOK_JA: Record<string, Pick<WatchtowerPlaybookView, "name" | "description" | "thesis">> = {
  "ai-data-center-buildout": {
    name: "AIデータセンター建設",
    description: "計算資源、電力、用地、送電網接続の動きを追い、複数の根拠が揃った段階で確認します。",
    thesis: "計算資源、電力、用地、資金の動きが重なる地域で、AI基盤の建設が加速しています。"
  },
  "water-rights-stress": {
    name: "水利用権の逼迫",
    description: "水利用権、産業需要、干ばつ、許認可の変化を、人の承認を伴う監視手順にまとめます。",
    thesis: "水の確保が、エネルギー、計算資源、鉱物開発を左右する制約になりつつあります。"
  },
  "state-incentive-subsidy-watch": {
    name: "政府支援策の監視",
    description: "補助金、税額控除、調達、奨励策を根拠とともに追跡し、承認後に共有します。",
    thesis: "政府支援の流れから、企業発表に先立つ拡張の兆候を捉えます。"
  }
};

const STEP_LABEL_JA: Record<string, string> = {
  scope: "対象の設定",
  retrieve_graph: "根拠の収集",
  contradiction_check: "矛盾の確認",
  approval_gate: "人による承認",
  dispatch_report: "報告の送信"
};

const APPROVAL_LABEL_JA: Record<string, string> = {
  "Send Slack incident report": "Slackへ報告を送信",
  "Queue push digest": "プッシュ通知の要約を準備",
  "Create board briefing": "経営会議向け資料を作成",
  "Open API webhook dispatch": "API Webhookを送信"
};

const RISK_LABEL_JA: Record<string, string> = {
  low_path_redundancy: "根拠となる経路が少ないため要確認",
  citation_coverage_below_slo: "引用元の網羅率が基準未満",
  trace_completeness_below_slo: "処理記録の完全性が基準未満",
  critical_alert_requires_review: "重大アラートのため確認が必要"
};

function stepSummary(step: WatchtowerStep, locale: "en" | "ja") {
  if (locale !== "ja") return step.summary;
  if (step.key === "scope") return "対象と直接参照する情報源を確定しました。";
  if (step.key === "retrieve_graph") return "関連する根拠と、そのつながりを確認しました。";
  if (step.key === "contradiction_check") return step.status === "completed" ? "根拠の矛盾と偏りを確認しました。" : "根拠の広がりを人が確認する必要があります。";
  if (step.key === "approval_gate") return "外部へ共有する前に、人の承認を待っています。";
  if (step.key === "dispatch_report") return step.status === "completed" ? "承認済みの報告を共有できます。" : "すべての承認が終わるまで共有を保留します。";
  return "処理結果を確認してください。";
}

function WorkflowButton({
  children,
  className = "",
  ...props
}: Readonly<ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }>) {
  return (
    <button
      {...props}
      className={[
        "inline-flex min-h-11 items-center justify-center border px-3 text-[11px] uppercase tracking-[0.08em]",
        "transition-[background-color,border-color,color,transform] duration-[var(--motion-micro)]",
        "hover:bg-[var(--signal-wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]",
        "motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      ].join(" ")}
      style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)", ...props.style }}
    >
      {children}
    </button>
  );
}

export function WatchtowerWorkflows({
  initialRuns,
  playbooks,
  labels,
  compact = false,
  locale = "en"
}: Readonly<{
  initialRuns: WatchtowerRunView[];
  playbooks: WatchtowerPlaybookView[];
  labels: WatchtowerLabels;
  compact?: boolean;
  locale?: "en" | "ja";
}>) {
  const [runs, setRuns] = useState<WatchtowerRunView[]>(initialRuns);
  const [selectedRunId, setSelectedRunId] = useState(initialRuns[0]?.id ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const copy = {
    working: locale === "ja" ? "処理中…" : "Working…",
    noSelection: locale === "ja" ? "確認する実行結果を選んでください。" : "Select a workflow run to review it.",
    noPlaybooks: locale === "ja" ? "このワークスペースに監視手順は設定されていません。" : "No playbooks are configured for this workspace.",
    noRuns: locale === "ja" ? "Watchtowerの実行履歴はまだありません。" : "No Watchtower runs yet.",
    executionTrace: locale === "ja" ? "処理経路" : "Execution trace",
    noTrace: locale === "ja" ? "処理経路は記録されていません。" : "No trace steps were returned.",
    sourceCoverage: locale === "ja" ? "参照した情報源" : "Source coverage",
    noSources: locale === "ja" ? "この実行結果に紐づく情報源はありません。" : "No source references are attached to this run.",
    view: locale === "ja" ? "開く" : "View",
    requestFailed: locale === "ja" ? "Watchtowerの処理を完了できませんでした。" : "The Watchtower request could not be completed.",
    ...labels
  };
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
    setPending("start:" + playbookId);
    setError(null);
    setFeedback("");
    try {
      const payload = await postAction("/api/watchtower/runs", { playbookId, actor: "dashboard" }, copy.requestFailed);
      upsertRun(payload.run);
      setFeedback(labels.start + ": " + payload.run.playbookName);
    } catch {
      setError(copy.requestFailed);
    } finally {
      setPending(null);
    }
  }

  async function handleApproval(approvalId: string, decision: "approve" | "reject") {
    if (!selectedRun) return;
    setPending(decision + ":" + approvalId);
    setError(null);
    setFeedback("");
    try {
      const payload = await postAction("/api/watchtower/approvals", {
        runId: selectedRun.id,
        approvalId,
        decision,
        actor: "dashboard"
      }, copy.requestFailed);
      upsertRun(payload.run);
      setFeedback(decision === "approve" ? labels.approve : labels.reject);
    } catch {
      setError(copy.requestFailed);
    } finally {
      setPending(null);
    }
  }

  async function handleRerun() {
    if (!selectedRun) return;
    setPending("rerun:" + selectedRun.id);
    setError(null);
    setFeedback("");
    try {
      const payload = await postAction("/api/watchtower/rerun", { runId: selectedRun.id, actor: "dashboard" }, copy.requestFailed);
      upsertRun(payload.run);
      setFeedback(labels.rerun);
    } catch {
      setError(copy.requestFailed);
    } finally {
      setPending(null);
    }
  }

  return (
    <div aria-busy={pending !== null} className="grid gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--line-soft)" }}>
        <div className="min-w-0">
          <p className="mono text-[12px] uppercase tracking-[0.1em]" style={{ color: "var(--text-primary)" }}>
            {labels.title}
          </p>
          {selectedRun ? (
            <p className="mt-2 max-w-3xl text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {(locale === "ja" ? PLAYBOOK_JA[selectedRun.playbookId]?.thesis : undefined) ?? selectedRun.thesis}
            </p>
          ) : (
            <p className="mt-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {copy.noSelection}
            </p>
          )}
        </div>
        {selectedRun ? (
          <WorkflowButton type="button" onClick={handleRerun} disabled={pending !== null}>
            {pending === "rerun:" + selectedRun.id ? copy.working : labels.rerun}
          </WorkflowButton>
        ) : null}
      </header>

      <div role={error ? "alert" : undefined} aria-live="polite" className="min-h-5 text-[11px]">
        {error ? <span style={{ color: "var(--critical)" }}>{error}</span> : <span style={{ color: "var(--evidence)" }}>{feedback}</span>}
      </div>

      {!compact ? (
        <section aria-labelledby="watchtower-playbooks" className="border-b pb-5" style={{ borderColor: "var(--line-soft)" }}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 id="watchtower-playbooks" className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
              {labels.playbooks}
            </h2>
            <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{playbooks.length}</span>
          </div>
          {playbooks.length ? (
            <ul className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
              {playbooks.map((playbook) => {
                const playbookCopy = locale === "ja" ? PLAYBOOK_JA[playbook.id] : undefined;
                return <li key={playbook.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{playbookCopy?.name ?? playbook.name}</h3>
                      <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        {locale === "ja" ? `${runCounts.get(playbook.id) ?? 0}回 · ${playbook.cadenceHours}時間 · 最低信頼度 ${percent(playbook.minConfidence)}` : `${runCounts.get(playbook.id) ?? 0} runs · ${playbook.cadenceHours}h · ${percent(playbook.minConfidence)}`}
                      </span>
                    </div>
                    <p className="mt-1 max-w-3xl text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{playbookCopy?.description ?? playbook.description}</p>
                  </div>
                  <WorkflowButton
                    type="button"
                    onClick={() => handleStart(playbook.id)}
                    disabled={pending !== null}
                    className="shrink-0"
                    style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
                  >
                    {pending === "start:" + playbook.id ? copy.working : labels.start}
                  </WorkflowButton>
                </li>;
              })}
            </ul>
          ) : (
            <p role="status" className="border-y py-4 text-[12px]" style={{ borderColor: "var(--line-soft)", color: "var(--text-tertiary)" }}>
              {copy.noPlaybooks}
            </p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="watchtower-runs" className="grid gap-5 lg:grid-cols-[minmax(220px,0.34fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 id="watchtower-runs" className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
              {labels.runs}
            </h2>
            <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{runs.length}</span>
          </div>
          {runs.length ? (
            <div className="divide-y border-y" style={{ borderColor: "var(--line-soft)" }}>
              {runs.map((run) => {
                const selected = selectedRun?.id === run.id;
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    aria-pressed={selected}
                    className="block min-h-11 w-full px-3 py-3 text-left transition-[background-color,border-color,color] duration-[var(--motion-state)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal)] motion-reduce:transition-none"
                    style={{ borderLeft: "3px solid " + (selected ? "var(--signal)" : "transparent"), background: selected ? "var(--signal-wash)" : "transparent" }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{(locale === "ja" ? PLAYBOOK_JA[run.playbookId]?.name : undefined) ?? run.playbookName}</span>
                      <span className="mono shrink-0 text-[11px] uppercase tracking-[0.08em]" style={{ color: statusColor(run.status) }}>
                        {statusLabel(run.status, locale)}
                      </span>
                    </span>
                    <span className="mono mt-1 block truncate text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-quaternary)" }}>
                      {locale === "ja" ? `改訂 ${run.revision}` : `r${run.revision}`} · {run.updatedAt.slice(0, 10)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div role="status" className="border-y px-3 py-6 text-[12px]" style={{ borderColor: "var(--line-soft)", color: "var(--text-tertiary)" }}>
              {copy.noRuns}
            </div>
          )}
        </div>

        {selectedRun ? (
          <article aria-labelledby="watchtower-run-heading" className="min-w-0 border-y" style={{ borderColor: "var(--line-soft)" }}>
            <header className="border-b px-3 py-4 sm:px-4" style={{ borderColor: "var(--line-soft)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 id="watchtower-run-heading" className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {selectedRun.alertTitle ?? ((locale === "ja" ? PLAYBOOK_JA[selectedRun.playbookId]?.name : undefined) ?? selectedRun.playbookName)}
                  </h3>
                  <p className="mono mt-1 text-[11px] uppercase tracking-[0.08em]" style={{ color: statusColor(selectedRun.status) }}>
                    {statusLabel(selectedRun.status, locale)}
                  </p>
                </div>
                <dl className="grid grid-cols-3 divide-x" style={{ borderColor: "var(--line-soft)" }}>
                  {[
                    [labels.citations, percent(selectedRun.citationCoverage), "var(--evidence)"],
                    [labels.trace, percent(selectedRun.traceCompleteness), "var(--signal)"],
                    [labels.cost, String(selectedRun.costEstimateTokens), "var(--text-primary)"]
                  ].map(([label, value, color]) => (
                    <div key={label} className="min-w-[72px] px-2 first:pl-0 last:pr-0" style={{ borderColor: "var(--line-soft)" }}>
                      <dt className="mono text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>{label}</dt>
                      <dd className="mt-1 text-[12px]" style={{ color }}>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </header>

            <div className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
              <section className="px-3 py-4 sm:px-4">
                <h4 className="mono mb-2 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{copy.executionTrace}</h4>
                <ol className="divide-y border-y" style={{ borderColor: "var(--line-soft)" }}>
                  {selectedRun.steps.length ? selectedRun.steps.map((step) => (
                    <li key={step.id} className="grid grid-cols-[minmax(90px,0.25fr)_minmax(0,1fr)_auto] items-start gap-3 py-3">
                      <span className="mono text-[11px] uppercase tracking-[0.06em]" style={{ color: statusColor(step.status) }}>
                        {statusLabel(step.status, locale)}
                      </span>
                      <span className="min-w-0 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                        <strong className="font-medium" style={{ color: "var(--text-primary)" }}>{locale === "ja" ? STEP_LABEL_JA[step.key] ?? step.label : step.label}</strong>
                        <span className="ml-2">{stepSummary(step, locale)}</span>
                      </span>
                      <span className="mono text-[11px] tabular-nums" style={{ color: "var(--evidence)" }}>{percent(step.confidence)}</span>
                    </li>
                  )) : (
                    <li className="py-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>{copy.noTrace}</li>
                  )}
                </ol>
              </section>

              <section className="px-3 py-4 sm:px-4">
                <h4 className="mono mb-2 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{copy.sourceCoverage}</h4>
                {selectedRun.sourceRefs.length ? (
                  <ul className="divide-y border-y" style={{ borderColor: "var(--line-soft)" }}>
                    {selectedRun.sourceRefs.map((source) => (
                      <li key={source.sourceId} className="flex min-h-11 items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{source.title}</span>
                          <span className="mono mt-1 block truncate text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-quaternary)" }}>{source.sourceId}</span>
                        </span>
                        <a href={source.url} target="_blank" rel="noreferrer" className="mono flex min-h-11 shrink-0 items-center px-2 text-[11px] uppercase tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--evidence)]" style={{ color: "var(--evidence)" }}>
                          {copy.view}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p role="status" className="border-y py-4 text-[12px]" style={{ borderColor: "var(--line-soft)", color: "var(--text-tertiary)" }}>
                    {copy.noSources}
                  </p>
                )}
              </section>

              {selectedRun.riskFlags.length ? (
                <section className="px-3 py-4 sm:px-4">
                  <h4 className="mono mb-2 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--critical)" }}>{labels.risks}</h4>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {selectedRun.riskFlags.map((risk) => (
                      <li key={risk} className="text-[12px]" style={{ color: "var(--critical)" }}>{locale === "ja" ? RISK_LABEL_JA[risk] ?? risk : risk.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="px-3 py-4 sm:px-4">
                <h4 className="mono mb-2 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{labels.approvals}</h4>
                {selectedRun.approvals.length ? (
                  <ul className="divide-y border-y" style={{ borderColor: "var(--line-soft)" }}>
                    {selectedRun.approvals.map((approval) => (
                      <li key={approval.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <span>
                          <span className="block text-[12px]" style={{ color: "var(--text-primary)" }}>{locale === "ja" ? APPROVAL_LABEL_JA[approval.label] ?? approval.label : approval.label}</span>
                          <span className="mono mt-1 block text-[11px] uppercase tracking-[0.08em]" style={{ color: statusColor(approval.status) }}>{statusLabel(approval.status, locale)}</span>
                        </span>
                        {approval.status === "pending" ? (
                          <span className="flex flex-wrap gap-2">
                            <WorkflowButton
                              type="button"
                              onClick={() => handleApproval(approval.id, "approve")}
                              disabled={pending !== null}
                              style={{ borderColor: "var(--evidence)", color: "var(--evidence)" }}
                            >
                              {pending === "approve:" + approval.id ? copy.working : labels.approve}
                            </WorkflowButton>
                            <WorkflowButton
                              type="button"
                              onClick={() => handleApproval(approval.id, "reject")}
                              disabled={pending !== null}
                              style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
                            >
                              {pending === "reject:" + approval.id ? copy.working : labels.reject}
                            </WorkflowButton>
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-y py-4 text-[12px]" style={{ borderColor: "var(--line-soft)", color: "var(--text-tertiary)" }}>
                    {locale === "ja" ? "承認が必要な操作はありません。" : "No approval steps required."}
                  </p>
                )}
              </section>
            </div>
          </article>
        ) : (
          <div role="status" className="flex min-h-48 items-center border-y px-4 text-[12px]" style={{ borderColor: "var(--line-soft)", color: "var(--text-tertiary)" }}>
            {copy.noSelection}
          </div>
        )}
      </section>
    </div>
  );
}

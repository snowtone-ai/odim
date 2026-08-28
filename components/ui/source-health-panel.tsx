"use client";

import type { SourceAttribution } from "@/lib/pipeline/attribution";
import type { SourceHealthEntry, SourceHealthState } from "@/lib/pipeline/source-health";

export type { SourceHealthEntry, SourceHealthState } from "@/lib/pipeline/source-health";

type Messages = {
  title: string;
  colSource: string;
  colLastSuccess: string;
  colSignals: string;
  colStatus: string;
  statusHealthy: string;
  statusStale: string;
  statusFailing: string;
  colState?: string;
  statusConfigured?: string;
  statusLiveVerified?: string;
  statusFixtureOnly?: string;
  statusSkipped?: string;
  statusFailed?: string;
  empty?: string;
  contribution?: string;
  alertCount?: string;
  observed?: string;
  sinceUpdate?: string;
};

const STATUS_COLORS: Record<SourceHealthEntry["status"], string> = {
  healthy: "var(--positive)",
  stale: "var(--evidence)",
  failing: "var(--critical)"
};

const STATE_COLORS: Record<SourceHealthState, string> = {
  configured: "var(--text-tertiary)",
  "live-verified": "var(--positive)",
  "fixture-only": "var(--evidence)",
  skipped: "var(--text-secondary)",
  failed: "var(--critical)"
};

const STATE_FALLBACK_LABELS: Record<SourceHealthState, string> = {
  configured: "Configured",
  "live-verified": "Live verified",
  "fixture-only": "Fixture only",
  skipped: "Skipped",
  failed: "Failed"
};

function shortDate(value: string | null) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function statusLabel(status: SourceHealthEntry["status"], messages: Messages) {
  if (status === "healthy") return messages.statusHealthy;
  if (status === "stale") return messages.statusStale;
  return messages.statusFailing;
}

function stateLabel(state: SourceHealthState, messages: Messages) {
  const key = {
    configured: "statusConfigured",
    "live-verified": "statusLiveVerified",
    "fixture-only": "statusFixtureOnly",
    skipped: "statusSkipped",
    failed: "statusFailed"
  }[state] as keyof Messages;
  return messages[key] ?? STATE_FALLBACK_LABELS[state];
}

export function SourceHealthPanel({
  sources,
  messages,
  attribution,
  locale = "en"
}: Readonly<{
  sources: SourceHealthEntry[];
  messages: Messages;
  attribution?: SourceAttribution[];
  locale?: "en" | "ja";
}>) {
  return (
    <div>
      <div className="mono mb-3 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>{messages.title}</div>
      <div role="table" aria-label={messages.title} className="border-y" style={{ borderColor: "var(--line-soft)" }}>
        <div role="row" className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] gap-3 border-b px-3 py-2 text-[11px] sm:grid" style={{ borderColor: "var(--line-soft)", background: "var(--surface-inset)" }}>
          <span role="columnheader" className="mono uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{messages.colSource}</span>
          <span role="columnheader" className="mono uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{messages.colLastSuccess}</span>
          <span role="columnheader" className="mono text-right uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{messages.colSignals}</span>
          <span role="columnheader" className="mono text-right uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{messages.colState ?? messages.colStatus}</span>
        </div>
        {sources.map((entry) => (
          <div role="row" key={entry.sourceId} className="grid grid-cols-2 gap-x-3 gap-y-2 border-b px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] sm:items-center" style={{ borderColor: "var(--line-faint)" }}>
            <span role="cell" className="min-w-0 truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{entry.sourceId}</span>
            <span role="cell" className="mono text-right text-[11px] sm:text-left" style={{ color: "var(--text-secondary)" }}>{shortDate(entry.lastSuccessAt)}{entry.slaHours ? " / SLA " + entry.slaHours + (locale === "ja" ? "時間" : "h") : ""}</span>
            <span role="cell" className="mono text-[11px]" style={{ color: "var(--evidence)" }}>{messages.colSignals}: {entry.rawSignalCount}</span>
            <span role="cell" className="mono flex items-center justify-end gap-2 text-[11px] uppercase tracking-[0.1em] sm:text-right" style={{ color: STATE_COLORS[entry.state] }}>
              <span className="inline-block h-2 w-2 shrink-0" aria-hidden="true" style={{ background: STATE_COLORS[entry.state] }} />
              {stateLabel(entry.state, messages)}
              {entry.state === "live-verified" ? <span className="normal-case tracking-normal" style={{ color: STATUS_COLORS[entry.status] }}>· {statusLabel(entry.status, messages)}</span> : null}
            </span>
            {entry.detail || (entry.lastObservedAt && entry.lastObservedAt !== entry.lastSuccessAt) ? <span className="col-span-2 text-[11px] sm:col-span-4" style={{ color: entry.state === "failed" ? "var(--critical)" : "var(--text-tertiary)" }}>{entry.detail ? (locale === "ja" ? "取得処理の詳細は監査記録を確認してください。" : entry.detail) : `${messages.observed ?? "Observed"} ${shortDate(entry.lastObservedAt)}${typeof entry.hoursSinceUpdate === "number" ? " · " + Math.round(entry.hoursSinceUpdate) + (locale === "ja" ? `時間 ${messages.sinceUpdate ?? "更新から経過"}` : `h ${messages.sinceUpdate ?? "since update"}`) : ""}`}</span> : null}
          </div>
        ))}
        {sources.length === 0 ? <div className="px-3 py-6 text-center mono text-[11px]" aria-live="polite" style={{ color: "var(--text-secondary)" }}>{messages.empty ?? "No source health records."}</div> : null}
      </div>

      {attribution?.length ? (
        <div className="mt-5">
          <div className="mono mb-2 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>{messages.contribution ?? "Top source contribution"}</div>
          <div className="border-y" style={{ borderColor: "var(--line-soft)" }}>
            {attribution.slice(0, 5).map((entry) => (
              <div key={entry.sourceId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b px-3 py-3 text-[12px] last:border-b-0" style={{ borderColor: "var(--line-faint)" }}>
                <span className="truncate" style={{ color: "var(--text-primary)" }}>{entry.sourceId}</span>
                <span className="mono" style={{ color: "var(--text-secondary)" }}>{entry.alertCount} {messages.alertCount ?? "alerts"}</span>
                <span className="mono" style={{ color: "var(--evidence)" }}>{Math.round(entry.qualityScore * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

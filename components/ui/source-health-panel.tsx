"use client";

import type { SourceAttribution } from "@/lib/pipeline/attribution";

export type SourceHealthEntry = {
  sourceId: string;
  lastSuccessAt: string | null;
  lastObservedAt: string | null;
  rawSignalCount: number;
  status: "healthy" | "stale" | "failing";
  slaHours?: number;
  hoursSinceUpdate?: number;
};

type Messages = {
  title: string;
  colSource: string;
  colLastSuccess: string;
  colSignals: string;
  colStatus: string;
  statusHealthy: string;
  statusStale: string;
  statusFailing: string;
};



const STATUS_COLORS: Record<SourceHealthEntry["status"], string> = {
  healthy: "var(--positive, #22c55e)",
  stale:   "#eab308",
  failing: "var(--critical, #dc2626)"
};

const STATUS_BG: Record<SourceHealthEntry["status"], string> = {
  healthy: "transparent",
  stale:   "rgba(234,179,8,0.05)",
  failing: "rgba(220,38,38,0.05)"
};

function shortDate(value: string | null) {
  if (!value) return "—";
  return value.slice(0, 10);
}

export function SourceHealthPanel({
  sources,
  messages,
  attribution
}: Readonly<{
  sources: SourceHealthEntry[];
  messages: Messages;
  attribution?: SourceAttribution[];
}>) {
  return (
    <div>
      <div
        className="mono text-[10px] uppercase tracking-[0.12em] mb-3"
        style={{ color: "var(--rune-dim)" }}
      >
        {messages.title}
      </div>
      <div
        className="overflow-hidden rounded-[var(--radius-sm)]"
        style={{ border: "1px solid var(--line-faint)" }}
      >
        {/* Header */}
        <div
          className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 px-3 py-2 text-[10px]"
          style={{
            background: "var(--surface-tertiary)",
            borderBottom: "1px solid var(--line-faint)"
          }}
        >
          <span className="mono uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
            {messages.colSource}
          </span>
          <span className="mono uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
            {messages.colLastSuccess}
          </span>
          <span className="mono uppercase tracking-[0.1em] text-right" style={{ color: "var(--text-tertiary)" }}>
            {messages.colSignals}
          </span>
          <span className="mono uppercase tracking-[0.1em] text-right" style={{ color: "var(--text-tertiary)" }}>
            {messages.colStatus}
          </span>
        </div>

        {/* Rows */}
        {sources.map((entry) => (
          <div
            key={entry.sourceId}
            className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-3 px-3 py-2.5 text-[12px]"
            style={{
              borderBottom: "1px solid var(--line-faint)",
              background: STATUS_BG[entry.status]
            }}
          >
            <span className="truncate" style={{ color: "var(--text-primary)" }}>
              {entry.sourceId}
            </span>
            <span className="mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {shortDate(entry.lastSuccessAt)}{entry.slaHours ? ` / SLA ${entry.slaHours}h` : ""}
            </span>
            <span className="mono text-right text-[11px]" style={{ color: "var(--rune)" }}>
              {entry.rawSignalCount}
            </span>
            <div className="flex items-center justify-end gap-1.5">
              <span
                className="inline-block rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  background: STATUS_COLORS[entry.status],
                  boxShadow: `0 0 5px ${STATUS_COLORS[entry.status]}60`
                }}
              />
              <span
                className="mono text-[9px] uppercase tracking-[0.1em]"
                style={{ color: STATUS_COLORS[entry.status] }}
              >
                {messages[`status${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}` as keyof Messages]}
              </span>
            </div>
          </div>
        ))}

        {sources.length === 0 && (
          <div className="px-3 py-4 text-center mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            —
          </div>
        )}
      </div>
      {attribution?.length ? (
        <div className="mt-4">
          <div className="mono mb-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
            Top source contribution
          </div>
          <div className="grid gap-2">
            {attribution.slice(0, 5).map((entry) => (
              <div key={entry.sourceId} className="grid grid-cols-[1fr_auto_auto] gap-3 text-[12px]">
                <span style={{ color: "var(--text-primary)" }}>{entry.sourceId}</span>
                <span className="mono" style={{ color: "var(--text-secondary)" }}>
                  {entry.alertCount} alerts
                </span>
                <span className="mono" style={{ color: "var(--rune)" }}>
                  {Math.round(entry.qualityScore * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

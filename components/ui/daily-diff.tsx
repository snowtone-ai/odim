"use client";

import { useState } from "react";
import type { DailyDiff } from "@/lib/pipeline/diff";

export function DailyDiffPanel({ diff }: Readonly<{ diff: DailyDiff }>) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="mb-3 overflow-hidden rounded-[var(--radius-md)]"
      style={{ background: "var(--surface-secondary)", border: "1px solid var(--line-faint)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
          Since yesterday: +{diff.newSignals} signals, {diff.newAlerts.critical + diff.newAlerts.high} alerts
        </div>
        <span className="mono text-[10px]" style={{ color: "var(--text-tertiary)" }}>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="grid gap-2 px-4 pb-4">
          {diff.topMovers.slice(0, 5).map((mover) => (
            <div key={mover.entityId} className="rounded-[var(--radius-sm)] px-3 py-2" style={{ background: "var(--ink-850)" }}>
              <div className="text-[12px]" style={{ color: "var(--text-primary)" }}>{mover.name}</div>
              <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{mover.reason}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

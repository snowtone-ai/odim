"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { DailyDiff } from "@/lib/pipeline/diff";

type DailyDiffPanelProps = Readonly<{
  diff: DailyDiff;
  /** A selected mobile inspector owns the bottom-sheet slot. */
  selectionActive?: boolean;
  locale?: "en" | "ja";
}>;

/**
 * A compact fixture-change rail. On mobile its disclosure occupies the map's
 * reserved bottom-sheet slot; it yields that slot as soon as an entity opens.
 */
export function DailyDiffPanel({ diff, selectionActive = false, locale = "en" }: DailyDiffPanelProps) {
  const [open, setOpen] = useState(false);
  const attentionCount = diff.newAlerts.critical + diff.newAlerts.high;
  const isJa = locale === "ja";

  useEffect(() => {
    if (selectionActive) setOpen(false);
  }, [selectionActive]);

  return (
    <section
      data-testid="daily-diff"
      aria-label={isJa ? "サンプルデータの変化" : "Fixture changes"}
      className={[
        "overflow-hidden border bg-[var(--surface)]",
        selectionActive ? "hidden md:block" : ""
      ].join(" ")}
      style={{ borderColor: "var(--line-soft)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="daily-diff-details"
        className="flex min-h-11 w-full items-center gap-3 px-3 text-left hover:bg-[var(--surface-hover)]"
      >
        <span className="min-w-0 flex-1">
          <span className="mono block text-[11px] tracking-[0.05em]" style={{ color: "var(--evidence)" }}>{isJa ? "サンプルデータの変化" : "Fixture changes"}</span>
          <span className="block truncate text-[12px]" style={{ color: "var(--text-primary)" }}>
            {isJa ? `兆候が${diff.newSignals}件増加・要確認${attentionCount}件` : `+${diff.newSignals} signals · ${attentionCount} attention items`}
          </span>
        </span>
        <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {open ? (isJa ? "閉じる" : "Hide") : (isJa ? "詳細" : "Details")}
        </span>
        {open ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
      </button>

      {open ? (
        <div id="daily-diff-details" className="max-h-[40dvh] overflow-y-auto border-t animate-slide-up" style={{ borderColor: "var(--line-soft)" }}>
          <p className="px-3 py-3 text-[12px] leading-5" style={{ color: "var(--text-secondary)" }}>
            {isJa ? "前回のサンプル実行との差分です。実データの更新状況ではありません。" : "Fixture comparison with the prior seeded run. This is not live source coverage."}
          </p>
          <div className="border-t" style={{ borderColor: "var(--line-soft)" }} aria-live="polite">
            {diff.topMovers.slice(0, 5).map((mover) => (
              <div key={mover.entityId} className="border-b px-3 py-2.5 last:border-b-0" style={{ borderColor: "var(--line-soft)" }}>
                <div className="text-[12px]" style={{ color: "var(--text-primary)" }}>{isJa && mover.name === "Unknown source entity" ? "出典不明の対象" : mover.name}</div>
                <div className="mt-0.5 text-[11px] leading-4" style={{ color: "var(--text-secondary)" }}>{isJa && mover.reason === "Score accelerated on new evidence" ? "新しい根拠により評価値が上昇" : mover.reason}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

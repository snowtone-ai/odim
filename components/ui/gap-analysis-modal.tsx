"use client";

import { useEffect, useMemo } from "react";
import { Confidence } from "@/components/ui/confidence";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entity = {
  id: string;
  name: string;
  score: number;
  committed: string;
  lead: number;
  confidence: number;
};

type TimelineEvent = {
  date: string;
  layer: string;
  title: string;
  source: string;
  confidence: number;
};

type OntologyLink = {
  type: string;
  from: string;
  to: string;
  confidence: number;
  source: string;
};

// ─── Layer color map ──────────────────────────────────────────────────────────

const LAYER_COLOR: Record<string, string> = {
  Energy:           "var(--layer-energy)",
  Cash:             "var(--layer-cash)",
  Land:             "var(--layer-land)",
  Compute:          "var(--layer-compute)",
  Water:            "var(--layer-water)",
  "Raw Materials":  "var(--layer-material)",
  Logistics:        "var(--layer-logistics)",
};

// ─── Chart constants ──────────────────────────────────────────────────────────

const SVG_W = 580;
const SVG_H = 150;
const L = 44;
const T = 14;
const R = 12;
const B = 24;
const PW = SVG_W - L - R;
const PH = SVG_H - T - B;

// ─── Smooth bezier helpers ────────────────────────────────────────────────────

function buildSmoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cpx = ((x0 + x1) / 2).toFixed(1);
    d += ` C ${cpx},${y0.toFixed(1)} ${cpx},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

function buildAreaPath(pts: [number, number][], bottomY: number): string {
  const line = buildSmoothPath(pts);
  if (!line) return "";
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L ${last[0].toFixed(1)},${bottomY.toFixed(1)} L ${first[0].toFixed(1)},${bottomY.toFixed(1)} Z`;
}

// ─── Chart computation ────────────────────────────────────────────────────────

function buildChartData(events: TimelineEvent[], lead: number) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;
  if (n < 2) return null;

  const t0 = new Date(sorted[0].date).getTime();
  function getDay(dateStr: string) {
    return Math.max(0, Math.floor((new Date(dateStr).getTime() - t0) / 86400000));
  }

  const lastDay = getDay(sorted[n - 1].date);
  const totalDays = lastDay + lead + Math.ceil(lead * 0.12 + 6);
  const toX = (day: number) => L + (day / totalDays) * PW;
  const toY = (cnt: number) => T + PH - (cnt / n) * PH;
  const bottomY = T + PH;

  // Substrate keypoints — de-duplicate same-day events
  const subPts: [number, number][] = [[toX(0), toY(0)]];
  for (let i = 0; i < n; i++) {
    const x = toX(getDay(sorted[i].date));
    if (Math.abs(x - subPts[subPts.length - 1][0]) < 1) {
      subPts[subPts.length - 1] = [x, toY(i + 1)];
    } else {
      subPts.push([x, toY(i + 1)]);
    }
  }
  subPts.push([toX(totalDays), toY(n)]);

  // Narrative keypoints — substrate shifted right by lead days
  const narrPts: [number, number][] = [[toX(lead), toY(0)]];
  for (let i = 0; i < n; i++) {
    const day = getDay(sorted[i].date) + lead;
    if (day > totalDays) break;
    const x = toX(day);
    if (Math.abs(x - narrPts[narrPts.length - 1][0]) < 1) {
      narrPts[narrPts.length - 1] = [x, toY(i + 1)];
    } else {
      narrPts.push([x, toY(i + 1)]);
    }
  }
  const lastNarr = narrPts[narrPts.length - 1];
  if (lastNarr[0] < toX(totalDays) - 2) narrPts.push([toX(totalDays), lastNarr[1]]);

  const subLine = buildSmoothPath(subPts);
  const narrLine = buildSmoothPath(narrPts);
  const subArea = buildAreaPath(subPts, bottomY);
  const narrArea = buildAreaPath(narrPts, bottomY);

  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const day = Math.round((i / 4) * totalDays);
    const date = new Date(t0 + day * 86400000);
    return {
      x: toX(day),
      label: `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`
    };
  });

  const yTicks = [0, 0.33, 0.67, 1].map((frac) => ({
    y: toY(Math.round(frac * n)),
    label: `${Math.round(frac * n)}`
  }));

  const gapX1 = toX(lastDay);
  const gapX2 = Math.min(toX(lastDay + lead), L + PW);
  const gapAnnotY = T + 8;

  return { subLine, narrLine, subArea, narrArea, xTicks, yTicks, gapX1, gapX2, gapAnnotY, bottomY };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GapAnalysisModal({
  entity,
  timelineEvents,
  ontologyLinks,
  onClose,
}: Readonly<{
  entity: Entity;
  timelineEvents: TimelineEvent[];
  ontologyLinks: OntologyLink[];
  onClose: () => void;
}>) {
  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chart = useMemo(
    () => buildChartData(timelineEvents, entity.lead),
    [timelineEvents, entity.lead]
  );

  const layerSummary = useMemo(() => {
    const map = new Map<string, { count: number; totalConf: number }>();
    for (const e of timelineEvents) {
      const prev = map.get(e.layer) ?? { count: 0, totalConf: 0 };
      map.set(e.layer, { count: prev.count + 1, totalConf: prev.totalConf + e.confidence });
    }
    return Array.from(map.entries())
      .map(([layer, { count, totalConf }]) => ({ layer, count, avgConf: totalConf / count }))
      .sort((a, b) => b.count - a.count);
  }, [timelineEvents]);

  const sortedEvents = useMemo(
    () => [...timelineEvents].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 24),
    [timelineEvents]
  );

  const avgConf = useMemo(
    () => timelineEvents.length > 0
      ? timelineEvents.reduce((s, e) => s + e.confidence, 0) / timelineEvents.length
      : 0,
    [timelineEvents]
  );

  const narrativeChannels = [
    { name: "Financial Media (Bloomberg/Reuters/FT)", result: "No coverage detected" },
    { name: "SEC / EDGAR Filings", result: "No public disclosure" },
    { name: "Analyst Consensus", result: "Below coverage threshold" },
    { name: "Official Announcements", result: "No statement issued" },
  ];

  return (
    // Backdrop — scrollable so tall modal content is always reachable
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "rgba(4,6,10,0.80)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
    >
      <div className="flex min-h-full items-start justify-center px-4 py-10">

        {/* Modal panel — natural height, no internal scroll trap */}
        <div
          className="relative w-full max-w-[940px] overflow-hidden rounded-[var(--radius-lg)]"
          style={{
            background: "var(--ink-850)",
            border: "1px solid var(--line-strong)",
            boxShadow: "var(--shadow-inset), 0 28px 72px rgba(0,0,0,0.72), var(--shadow-glow)",
          }}
          onClick={(e) => e.stopPropagation()}
        >

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div
            className="flex items-center gap-6 px-6 py-4"
            style={{ borderBottom: "1px solid var(--line-soft)" }}
          >
            <div className="min-w-0 flex-1">
              <div className="mono text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--text-quaternary)" }}>
                Narrative–Reality Gap Analysis
              </div>
              <h2 className="mt-0.5 text-[15px] font-semibold leading-tight truncate" style={{ color: "var(--text-primary)" }}>
                {entity.name}
              </h2>
            </div>

            {/* Key metrics */}
            <div className="flex items-center gap-6 shrink-0">
              <div className="text-center">
                <div
                  className="mono text-[22px] font-semibold leading-none"
                  style={{ color: "var(--rune)", textShadow: "0 0 18px rgba(201,169,97,0.28)" }}
                >
                  +{entity.lead}d
                </div>
                <div className="mono mt-1 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>
                  Lead Time
                </div>
              </div>
              <div className="h-8 w-px" style={{ background: "var(--line-faint)" }} />
              <div className="text-center">
                <div className="mono text-[17px] font-semibold leading-none" style={{ color: "var(--text-primary)" }}>
                  {entity.score}
                </div>
                <div className="mono mt-1 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>
                  Reality Score
                </div>
              </div>
              <div className="text-center">
                <div className="mono text-[17px] font-semibold leading-none" style={{ color: "var(--rune)" }}>
                  {entity.committed}
                </div>
                <div className="mono mt-1 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>
                  Committed
                </div>
              </div>
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-xs)] transition-colors duration-[var(--dur-fast)] hover:bg-white/[0.06]"
              style={{ border: "1px solid var(--line-faint)", color: "var(--text-tertiary)" }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5 p-6">

            {/* ── Divergence Chart ──────────────────────────────────────── */}
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <div className="mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
                  Signal Accumulation Divergence
                </div>
                <div className="flex items-center gap-5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-[2px] w-6 rounded-full" style={{ background: "rgba(201,169,97,0.85)" }} />
                    <span className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>Substrate (Reality)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg width="24" height="2" viewBox="0 0 24 2">
                      <line x1="0" y1="1" x2="24" y2="1" stroke="rgba(120,130,160,0.55)" strokeWidth="1.5" strokeDasharray="5,4" />
                    </svg>
                    <span className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>Narrative (Lagged)</span>
                  </div>
                </div>
              </div>

              <div
                className="overflow-hidden rounded-[var(--radius-md)] p-2"
                style={{ background: "var(--ink-900)", border: "1px solid var(--line-faint)" }}
              >
                {chart ? (
                  <svg
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    className="w-full"
                    style={{ height: SVG_H, display: "block" }}
                  >
                    <defs>
                      <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(201,169,97,0.22)" />
                        <stop offset="100%" stopColor="rgba(201,169,97,0)" />
                      </linearGradient>
                      <linearGradient id="narrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(100,110,150,0.12)" />
                        <stop offset="100%" stopColor="rgba(100,110,150,0)" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal grid lines */}
                    {chart.yTicks.map((tick, i) => (
                      <line
                        key={i}
                        x1={L} y1={tick.y} x2={L + PW} y2={tick.y}
                        stroke="rgba(255,255,255,0.04)" strokeWidth={1} strokeDasharray="4,4"
                      />
                    ))}

                    {/* Y-axis labels */}
                    {chart.yTicks.map((tick, i) => (
                      <text
                        key={i}
                        x={L - 6} y={tick.y + 3}
                        textAnchor="end" fontSize={8} fontFamily="monospace"
                        fill="rgba(255,255,255,0.18)"
                      >
                        {tick.label}
                      </text>
                    ))}

                    {/* Gap annotation bracket */}
                    {chart.gapX2 - chart.gapX1 > 20 && (
                      <>
                        <line x1={chart.gapX1} y1={chart.gapAnnotY} x2={chart.gapX2} y2={chart.gapAnnotY}
                          stroke="rgba(201,169,97,0.35)" strokeWidth={1} />
                        <line x1={chart.gapX1} y1={chart.gapAnnotY - 3} x2={chart.gapX1} y2={chart.gapAnnotY + 3}
                          stroke="rgba(201,169,97,0.35)" strokeWidth={1} />
                        <line x1={chart.gapX2} y1={chart.gapAnnotY - 3} x2={chart.gapX2} y2={chart.gapAnnotY + 3}
                          stroke="rgba(201,169,97,0.35)" strokeWidth={1} />
                        <text
                          x={(chart.gapX1 + chart.gapX2) / 2} y={chart.gapAnnotY - 4}
                          textAnchor="middle" fontSize={8} fontFamily="monospace"
                          fill="rgba(201,169,97,0.6)"
                        >
                          +{entity.lead}d gap
                        </text>
                      </>
                    )}

                    {/* Area fills (behind lines) */}
                    <path d={chart.narrArea} fill="url(#narrGrad)" />
                    <path d={chart.subArea} fill="url(#subGrad)" />

                    {/* Narrative smooth line */}
                    <path
                      d={chart.narrLine}
                      fill="none"
                      stroke="rgba(120,130,160,0.55)"
                      strokeWidth={1.5}
                      strokeDasharray="6,4"
                      strokeLinecap="round"
                    />

                    {/* Substrate smooth line */}
                    <path
                      d={chart.subLine}
                      fill="none"
                      stroke="rgba(201,169,97,0.92)"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* X-axis baseline */}
                    <line x1={L} y1={chart.bottomY} x2={L + PW} y2={chart.bottomY}
                      stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

                    {/* X-axis tick labels */}
                    {chart.xTicks.map((tick, i) => (
                      <text
                        key={i}
                        x={tick.x} y={SVG_H - 5}
                        textAnchor="middle" fontSize={8} fontFamily="monospace"
                        fill="rgba(255,255,255,0.22)"
                      >
                        {tick.label}
                      </text>
                    ))}
                  </svg>
                ) : (
                  <div className="flex items-center justify-center py-10 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    Insufficient data for chart
                  </div>
                )}
              </div>
            </div>

            {/* ── Two-column: Substrate Evidence + Narrative Channel Scan ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Substrate Evidence by Layer */}
              <div
                className="rounded-[var(--radius-md)] p-4"
                style={{ background: "var(--ink-900)", border: "1px solid var(--line-faint)" }}
              >
                <div className="mono mb-3 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
                  Substrate Evidence by Layer
                </div>
                <div className="flex flex-col gap-2.5">
                  {layerSummary.map((item) => {
                    const color = LAYER_COLOR[item.layer] ?? "var(--rune-dim)";
                    const maxCount = layerSummary[0].count;
                    return (
                      <div key={item.layer}>
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                            <span className="truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>
                              {item.layer}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="mono text-[12px] font-medium" style={{ color }}>{item.count}</span>
                            <span className="mono text-[10px]" style={{ color: "var(--text-quaternary)" }}>
                              {Math.round(item.avgConf * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-[2px] overflow-hidden rounded-full" style={{ background: "var(--ink-700)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.round((item.count / maxCount) * 100)}%`, background: color, opacity: 0.6 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="mono mt-4 rounded-[var(--radius-sm)] px-3 py-2 text-[10px] leading-relaxed"
                  style={{ background: "var(--ink-800)", color: "var(--text-tertiary)", border: "1px solid var(--line-faint)" }}
                >
                  {timelineEvents.length} confirmed signals · avg {Math.round(avgConf * 100)}% confidence
                </div>
              </div>

              {/* Narrative Channel Scan */}
              <div
                className="rounded-[var(--radius-md)] p-4"
                style={{ background: "var(--ink-900)", border: "1px solid var(--line-faint)" }}
              >
                <div className="mono mb-3 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
                  Narrative Channel Scan
                </div>
                <div className="flex flex-col gap-2">
                  {narrativeChannels.map((ch) => (
                    <div key={ch.name} className="flex items-start justify-between gap-2">
                      <span className="text-[11px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                        {ch.name}
                      </span>
                      <span
                        className="mono shrink-0 text-[10px]"
                        style={{ color: "var(--text-quaternary)" }}
                      >
                        {ch.result}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  className="mono mt-4 rounded-[var(--radius-sm)] px-3 py-2.5 text-[10px] leading-[1.6]"
                  style={{
                    background: "linear-gradient(135deg, rgba(201,169,97,0.07) 0%, rgba(201,169,97,0.03) 100%)",
                    border: "1px solid rgba(201,169,97,0.14)",
                    color: "var(--text-secondary)"
                  }}
                >
                  <span style={{ color: "var(--rune)", fontWeight: 600 }}>+{entity.lead}d</span> information asymmetry confirmed.
                  Substrate signals precede any narrative acknowledgment as of{" "}
                  <span style={{ color: "var(--text-primary)" }}>{entity.committed}</span>.
                </div>

                {ontologyLinks.length > 0 && (
                  <div className="mt-3">
                    <div className="mono mb-1.5 text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>
                      Key Ontology Links
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {ontologyLinks.slice(0, 3).map((link, i) => (
                        <div key={i} className="mono truncate text-[10px]" style={{ color: "var(--rune-dim)" }}>
                          {link.type}: {link.from} → {link.to}
                          <span className="ml-2" style={{ color: "var(--text-quaternary)" }}>
                            {Math.round(link.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <div className="mono mb-1.5 text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>
                    Confidence
                  </div>
                  <Confidence value={entity.confidence} />
                </div>
              </div>
            </div>

            {/* ── Evidence Table ────────────────────────────────────────── */}
            <div>
              <div className="mono mb-3 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
                Raw Substrate Signals ({sortedEvents.length})
              </div>
              <div
                className="overflow-hidden rounded-[var(--radius-md)]"
                style={{ border: "1px solid var(--line-faint)" }}
              >
                {/* Header row */}
                <div
                  className="grid gap-3 px-4 py-2"
                  style={{
                    gridTemplateColumns: "64px 88px 1fr 52px",
                    background: "var(--ink-900)",
                    borderBottom: "1px solid var(--line-faint)"
                  }}
                >
                  {["Date", "Layer", "Signal", "Conf."].map((h) => (
                    <span key={h} className="mono text-[9px] uppercase tracking-[0.12em]" style={{ color: "var(--text-quaternary)" }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Data rows */}
                <div className="max-h-[300px] overflow-y-auto" style={{ background: "var(--ink-850)" }}>
                  {sortedEvents.map((event, i) => {
                    const color = LAYER_COLOR[event.layer] ?? "var(--rune-dim)";
                    return (
                      <div
                        key={`${event.date}-${i}`}
                        className="grid items-center gap-3 px-4 py-2.5"
                        style={{
                          gridTemplateColumns: "64px 88px 1fr 52px",
                          borderBottom: i < sortedEvents.length - 1 ? "1px solid var(--line-faint)" : "none"
                        }}
                      >
                        <span className="mono text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                          {event.date.slice(5)}
                        </span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                          <span className="mono truncate text-[10px]" style={{ color }}>
                            {event.layer}
                          </span>
                        </div>
                        <span className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>
                          {event.title}
                        </span>
                        <span className="mono text-right text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                          {Math.round(event.confidence * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

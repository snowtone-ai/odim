"use client";

import { useEffect, useMemo, useRef } from "react";
import { trapDialogFocus } from "@/components/ui/modal-focus";
import { X } from "lucide-react";

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

const LAYER_COLOR: Record<string, string> = {
  Energy: "var(--evidence)",
  Cash: "var(--signal)",
  Land: "var(--text-secondary)",
  Compute: "var(--signal)",
  Water: "var(--evidence)",
  "Raw Materials": "var(--text-secondary)",
  Logistics: "var(--text-tertiary)"
};

const divider = "var(--line-soft)";

function pct(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function chartPoints(events: TimelineEvent[], lead: number) {
  const ordered = [...events].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const width = 760;
  const height = 220;
  const left = 34;
  const right = 18;
  const top = 18;
  const bottom = 26;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const count = Math.max(ordered.length - 1, 1);
  const substrate = ordered.map((event, index) => {
    const x = left + (index / count) * plotWidth;
    const y = top + (1 - Math.max(0, Math.min(1, event.confidence))) * plotHeight;
    return [x, y] as const;
  });
  const narrative = ordered.map((event, index) => {
    const x = left + (index / count) * plotWidth;
    const lag = Math.min(0.75, Math.max(0.08, lead / 30));
    const y = top + (1 - Math.max(0, Math.min(1, event.confidence - lag))) * plotHeight;
    return [x, y] as const;
  });
  const points = (values: readonly (readonly [number, number])[]) => values.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return { ordered, width, height, left, top, bottom, plotWidth, substrate, narrative, substratePath: points(substrate), narrativePath: points(narrative) };
}

export function GapAnalysisModal({
  entity,
  timelineEvents,
  ontologyLinks,
  onClose
}: Readonly<{
  entity: Entity;
  timelineEvents: TimelineEvent[];
  ontologyLinks: OntologyLink[];
  onClose: () => void;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    previousActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      previousActiveRef.current?.focus();
    };
  }, []);

  const chart = useMemo(() => chartPoints(timelineEvents, entity.lead), [timelineEvents, entity.lead]);
  const layerSummary = useMemo(() => {
    const map = new Map<string, { count: number; confidence: number }>();
    for (const event of timelineEvents) {
      const current = map.get(event.layer) ?? { count: 0, confidence: 0 };
      map.set(event.layer, { count: current.count + 1, confidence: current.confidence + event.confidence });
    }
    return [...map.entries()].map(([layer, value]) => ({ layer, count: value.count, confidence: value.confidence / value.count })).sort((a, b) => b.count - a.count);
  }, [timelineEvents]);
  const sortedEvents = useMemo(() => [...timelineEvents].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 24), [timelineEvents]);
  const averageConfidence = timelineEvents.length ? timelineEvents.reduce((sum, event) => sum + event.confidence, 0) / timelineEvents.length : 0;
  const maxLayerCount = Math.max(1, ...layerSummary.map((layer) => layer.count));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="gap-analysis-title"
      className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-[color-mix(in_srgb,var(--field)_88%,transparent)] px-3 py-3 sm:px-6 sm:py-8"
      onKeyDown={trapDialogFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        className="animate-fade-in mx-auto w-full max-w-[980px] border bg-[var(--surface)]"
        style={{ borderColor: "var(--line-strong)", boxShadow: "var(--shadow-lg)" }}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7" style={{ borderColor: divider }}>
          <div className="min-w-0">
            <p className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--signal)" }}>Evidence review</p>
            <h2 id="gap-analysis-title" className="mt-2 text-[20px] font-medium tracking-[-0.015em]" style={{ color: "var(--text)" }}>Narrative gap analysis</h2>
            <p className="mt-2 truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>{entity.name} · {entity.id}</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="odim-icon-control h-11 w-11 shrink-0" aria-label="Close gap analysis" title="Close">
            <X size={17} />
          </button>
        </header>

        <div className="grid border-b sm:grid-cols-4" style={{ borderColor: divider }}>
          {[
            ["Score", entity.score],
            ["Committed", entity.committed],
            ["Lead", `+${entity.lead}d`],
            ["Confidence", pct(entity.confidence)]
          ].map(([label, value], index) => (
            <div key={String(label)} className="border-b px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0" style={{ borderColor: divider }}>
              <p className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>{label}</p>
              <p className="mono mt-2 text-[15px] tabular-nums" style={{ color: index === 0 || index === 2 ? "var(--signal)" : "var(--text)" }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-8">
          <section aria-labelledby="gap-chart-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>Substrate versus narrative</p>
                <h3 id="gap-chart-title" className="mt-2 text-[16px] font-medium" style={{ color: "var(--text)" }}>Reality is {entity.lead} days ahead of narrative confirmation.</h3>
              </div>
              <div className="flex gap-4 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                <span className="inline-flex items-center gap-2"><i className="h-2 w-2" style={{ background: "var(--evidence)" }} />Observed</span>
                <span className="inline-flex items-center gap-2"><i className="h-2 w-2" style={{ background: "var(--signal)" }} />Narrative</span>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto border-y py-3" style={{ borderColor: divider }}>
              {chart.ordered.length > 1 ? (
                <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="min-w-[620px] w-full" role="img" aria-label="Observed evidence and narrative confidence over time">
                  {[0.25, 0.5, 0.75].map((fraction) => {
                    const y = chart.top + fraction * (chart.height - chart.top - chart.bottom);
                    return <line key={fraction} x1={chart.left} x2={chart.width - 18} y1={y} y2={y} stroke="var(--line-faint)" strokeWidth="1" />;
                  })}
                  <polyline points={chart.substratePath} fill="none" stroke="var(--evidence)" strokeWidth="2" />
                  <polyline points={chart.narrativePath} fill="none" stroke="var(--signal)" strokeWidth="1.5" strokeDasharray="5 5" />
                  {chart.substrate.map(([x, y], index) => <circle key={`observed-${x}`} cx={x} cy={y} r={index === chart.substrate.length - 1 ? 4 : 2.5} fill="var(--evidence)" />)}
                  {chart.narrative.map(([x, y], index) => <circle key={`narrative-${x}`} cx={x} cy={y} r={index === chart.narrative.length - 1 ? 3 : 2} fill="var(--signal)" />)}
                  <text x={chart.left} y={chart.height - 7} fill="var(--text-tertiary)" fontSize="10">{chart.ordered[0]?.date}</text>
                  <text x={chart.width - 18} y={chart.height - 7} fill="var(--text-tertiary)" fontSize="10" textAnchor="end">{chart.ordered.at(-1)?.date}</text>
                </svg>
              ) : <p className="py-8 text-[13px]" style={{ color: "var(--text-secondary)" }}>Not enough dated evidence to draw a trajectory.</p>}
            </div>
            <p className="mt-3 text-[12px] leading-5" style={{ color: "var(--text-secondary)" }}>The observed line reflects source-backed events. The narrative line is shifted by the current lead estimate so the missing confirmation remains visible.</p>
          </section>

          <section className="grid gap-8 border-t pt-6 lg:grid-cols-[1fr_1fr]" style={{ borderColor: divider }} aria-label="Evidence summary">
            <div>
              <p className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>Layer coverage</p>
              <div className="mt-3 divide-y" style={{ borderColor: divider }}>
                {layerSummary.length ? layerSummary.map((layer) => (
                  <div key={layer.layer} className="py-3">
                    <div className="flex items-center justify-between gap-3 text-[12px]">
                      <span style={{ color: LAYER_COLOR[layer.layer] ?? "var(--text-secondary)" }}>{layer.layer}</span>
                      <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{layer.count} records · {pct(layer.confidence)}</span>
                    </div>
                    <div className="mt-2 h-[2px]" style={{ background: "var(--line-faint)" }}><div className="h-full" style={{ width: `${(layer.count / maxLayerCount) * 100}%`, background: LAYER_COLOR[layer.layer] ?? "var(--evidence)" }} /></div>
                  </div>
                )) : <p className="py-3 text-[12px]" style={{ color: "var(--text-secondary)" }}>No source records attached.</p>}
              </div>
            </div>
            <div>
              <p className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>Narrative channels</p>
              <div className="mt-3 divide-y" style={{ borderColor: divider }}>
                {["Financial media", "SEC / EDGAR filings", "Analyst consensus", "Official announcements"].map((channel) => (
                  <div key={channel} className="flex items-center justify-between gap-3 py-3">
                    <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{channel}</span>
                    <span className="mono text-[11px]" style={{ color: "var(--critical)" }}>No confirmation</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px]" style={{ color: "var(--text-tertiary)" }}>Average source confidence: <span style={{ color: "var(--evidence)" }}>{pct(averageConfidence)}</span></p>
            </div>
          </section>

          {ontologyLinks.length ? (
            <section className="border-t pt-6" style={{ borderColor: divider }} aria-labelledby="gap-links-title">
              <p id="gap-links-title" className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>Ontology links</p>
              <div className="mt-3 grid gap-x-8 sm:grid-cols-2">
                {ontologyLinks.slice(0, 8).map((link) => (
                  <div key={`${link.from}-${link.to}-${link.type}`} className="border-t py-3" style={{ borderColor: divider }}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="mono text-[11px] uppercase" style={{ color: "var(--evidence)" }}>{link.type}</span>
                      <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{pct(link.confidence)}</span>
                    </div>
                    <p className="mt-1 truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>{link.from} <span style={{ color: "var(--signal)" }}>→</span> {link.to}</p>
                    <p className="mono mt-1 truncate text-[11px]" style={{ color: "var(--text-tertiary)" }}>{link.source}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="border-t pt-6" style={{ borderColor: divider }} aria-labelledby="gap-events-title">
            <div className="flex items-center justify-between gap-3">
              <p id="gap-events-title" className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>Source record trail</p>
              <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{sortedEvents.length} shown</span>
            </div>
            <div className="mt-3 overflow-x-auto border-y" style={{ borderColor: divider }}>
              <table className="w-full min-w-[650px] text-left text-[12px]">
                <thead><tr className="border-b" style={{ borderColor: divider }}><th className="px-3 py-3 font-normal" style={{ color: "var(--text-tertiary)" }}>Date</th><th className="px-3 py-3 font-normal" style={{ color: "var(--text-tertiary)" }}>Layer</th><th className="px-3 py-3 font-normal" style={{ color: "var(--text-tertiary)" }}>Event</th><th className="px-3 py-3 font-normal" style={{ color: "var(--text-tertiary)" }}>Source</th><th className="px-3 py-3 text-right font-normal" style={{ color: "var(--text-tertiary)" }}>Conf.</th></tr></thead>
                <tbody>{sortedEvents.map((event) => <tr key={`${event.date}-${event.title}`} className="border-b last:border-b-0" style={{ borderColor: divider }}><td className="whitespace-nowrap px-3 py-3 mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{event.date}</td><td className="whitespace-nowrap px-3 py-3" style={{ color: LAYER_COLOR[event.layer] ?? "var(--text-secondary)" }}>{event.layer}</td><td className="px-3 py-3" style={{ color: "var(--text)" }}>{event.title}</td><td className="whitespace-nowrap px-3 py-3 mono text-[11px]" style={{ color: "var(--text-secondary)" }}>{event.source}</td><td className="px-3 py-3 text-right mono text-[11px]" style={{ color: "var(--evidence)" }}>{pct(event.confidence)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  );
}

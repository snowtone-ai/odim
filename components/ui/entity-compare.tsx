"use client";

import type { SectorEntity } from "@/lib/pipeline/sector-rotation";

type CompareEntity = SectorEntity & {
  lead: number;
  divergence: number;
  signalCount?: number;
  layers?: Record<string, number>;
};

function metricStyle(active: boolean) {
  return active
    ? { color: "var(--positive, #22c55e)", background: "rgba(34,197,94,0.08)" }
    : { color: "var(--text-secondary)", background: "transparent" };
}

function polarPoint(index: number, total: number, value: number, radius: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: 140 + Math.cos(angle) * radius * value,
    y: 140 + Math.sin(angle) * radius * value
  };
}

export function EntityCompare({
  entities,
  onRemove
}: Readonly<{
  entities: CompareEntity[];
  onRemove: (id: string) => void;
}>) {
  const layers = ["energy", "cash", "land", "compute", "water", "raw_materials", "logistics"];
  const radarSeries = entities.map((entity) =>
    layers.map((layer, index) => polarPoint(index, layers.length, Math.max(0.2, (entity.layers?.[layer] ?? 25) / 100), 90))
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div
        className="overflow-hidden rounded-[var(--radius-lg)]"
        style={{ background: "var(--ink-800)", border: "1px solid var(--line-faint)" }}
      >
        <div className="grid grid-cols-[180px_repeat(4,minmax(0,1fr))] gap-2 px-4 py-3 text-[11px]" style={{ borderBottom: "1px solid var(--line-faint)" }}>
          <span className="mono uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>Metric</span>
          {entities.map((entity) => (
            <div key={entity.id} className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{entity.name}</span>
                <button type="button" onClick={() => onRemove(entity.id)} className="mono text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  X
                </button>
              </div>
              <div className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>
                {entity.sector ?? "general"}
              </div>
            </div>
          ))}
        </div>
        {[
          ["Score", entities.map((entity) => entity.score)],
          ["Confidence", entities.map((entity) => Math.round(entity.confidence * 100))],
          ["Lead", entities.map((entity) => entity.lead)],
          ["Divergence", entities.map((entity) => Math.round(entity.divergence * 100))],
          ["Signals", entities.map((entity) => entity.signalCount ?? 0)]
        ].map(([label, values]) => {
          const max = Math.max(...(values as number[]));
          return (
            <div key={String(label)} className="grid grid-cols-[180px_repeat(4,minmax(0,1fr))] gap-2 px-4 py-2.5 text-[12px]" style={{ borderBottom: "1px solid var(--line-faint)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{label}</span>
              {(values as number[]).map((value, index) => (
                <span key={`${label}-${entities[index]?.id ?? index}`} className="rounded px-2 py-1" style={metricStyle(value === max)}>
                  {value}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div
        className="rounded-[var(--radius-lg)] p-4"
        style={{ background: "var(--ink-800)", border: "1px solid var(--line-faint)" }}
      >
        <div className="mono mb-3 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
          Layer Radar
        </div>
        <svg viewBox="0 0 280 280" className="w-full">
          {layers.map((layer, index) => {
            const point = polarPoint(index, layers.length, 1, 100);
            return (
              <g key={layer}>
                <line x1="140" y1="140" x2={point.x} y2={point.y} stroke="rgba(255,255,255,0.08)" />
                <text x={point.x} y={point.y} fill="var(--text-tertiary)" fontSize="9" textAnchor="middle">
                  {layer.replace("_", " ")}
                </text>
              </g>
            );
          })}
          {radarSeries.map((series, index) => (
            <polygon
              key={entities[index].id}
              points={series.map((point) => `${point.x},${point.y}`).join(" ")}
              fill={["rgba(59,130,246,0.12)", "rgba(34,197,94,0.12)", "rgba(234,179,8,0.12)", "rgba(220,38,38,0.12)"][index] ?? "rgba(255,255,255,0.12)"}
              stroke={["#3b82f6", "#22c55e", "#eab308", "#dc2626"][index] ?? "#c9a961"}
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

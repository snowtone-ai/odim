"use client";

import { X } from "lucide-react";
import type { SectorEntity } from "@/lib/pipeline/sector-rotation";

type CompareEntity = SectorEntity & {
  lead: number;
  divergence: number;
  signalCount?: number;
  layers?: Record<string, number>;
};

const LAYERS = ["energy", "cash", "land", "compute", "water", "raw_materials", "logistics"];

function formatLayer(layer: string) {
  return layer.replaceAll("_", " ");
}

function percent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function rowStyle(entityCount: number) {
  return {
    gridTemplateColumns: `minmax(108px, 0.7fr) repeat(${Math.max(entityCount, 1)}, minmax(0, 1fr))`
  };
}

/** A low-chrome comparison surface: values stay in the same reading line as their objects. */
export function EntityCompare({
  entities,
  onRemove
}: Readonly<{
  entities: CompareEntity[];
  onRemove: (id: string) => void;
}>) {
  if (!entities.length) {
    return (
      <section className="border-y px-5 py-12" aria-label="Entity comparison">
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>Select up to four objects to compare.</p>
      </section>
    );
  }

  const metrics: Array<[string, (entity: CompareEntity) => string]> = [
    ["Score", (entity) => String(entity.score)],
    ["Confidence", (entity) => percent(entity.confidence)],
    ["Lead", (entity) => `+${entity.lead}d`],
    ["Divergence", (entity) => percent(entity.divergence)],
    ["Signals", (entity) => String(entity.signalCount ?? 0)]
  ];

  return (
    <section className="min-w-0 border-y" aria-label="Entity comparison">
      <header className="border-b px-5 py-5" style={{ borderColor: "var(--line-soft)" }}>
        <p className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>Comparison workspace</p>
        <div className="mt-3 grid gap-3" style={rowStyle(entities.length)}>
          <span className="sr-only">Objects</span>
          {entities.map((entity) => (
            <div key={entity.id} className="min-w-0 border-l pl-3" style={{ borderColor: "var(--line-soft)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium" style={{ color: "var(--text)" }}>{entity.name}</p>
                  <p className="mono mt-1 truncate text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>{entity.sector ?? "general"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(entity.id)}
                  className="odim-icon-control h-11 w-11 shrink-0"
                  aria-label={`Remove ${entity.name} from comparison`}
                  title="Remove from comparison"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </header>

      <div className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
        {metrics.map(([label, value]) => (
          <div key={label} className="grid items-center gap-3 px-5 py-3" style={{ ...rowStyle(entities.length), borderColor: "var(--line-soft)" }}>
            <span className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>{label}</span>
            {entities.map((entity, index) => (
              <span key={`${label}-${entity.id}`} className="mono text-[13px] tabular-nums" style={{ color: index === 0 ? "var(--evidence)" : "var(--text)" }}>
                {value(entity)}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="border-t px-5 py-5" style={{ borderColor: "var(--line-soft)" }}>
        <p className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>Layer evidence</p>
        <div className="mt-3 divide-y" style={{ borderColor: "var(--line-soft)" }}>
          {LAYERS.map((layer) => {
            const values = entities.map((entity) => entity.layers?.[layer] ?? 0);
            const max = Math.max(...values, 1);
            return (
              <div key={layer} className="grid items-center gap-3 py-3" style={{ ...rowStyle(entities.length), borderColor: "var(--line-soft)" }}>
                <span className="text-[12px] capitalize" style={{ color: "var(--text-secondary)" }}>{formatLayer(layer)}</span>
                {values.map((value, index) => (
                  <div key={`${layer}-${entities[index]?.id ?? index}`} className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono text-[11px] tabular-nums" style={{ color: "var(--text)" }}>{Math.round(value)}</span>
                      <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{Math.round((value / max) * 100)}%</span>
                    </div>
                    <div className="mt-2 h-[2px]" style={{ background: "var(--line-faint)" }} aria-hidden="true">
                      <div className="h-full transition-[width] duration-[var(--motion-state)]" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: index === 0 ? "var(--evidence)" : "var(--signal)" }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

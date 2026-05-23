import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { alerts, entities, layers } from "@/lib/data";

export default function RealityMapPage() {
  return (
    <Screen eyebrow="Screen 01" title="Reality Map">
      <div className="grid grid-cols-[1fr_360px] gap-5">
        <Panel title="Capital Fixation Globe / Map">
          <div className="relative h-[560px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[radial-gradient(circle_at_50%_42%,rgba(94,143,181,0.24),transparent_18%),var(--ink-850)]">
            <div className="absolute inset-12 rounded-full border border-[var(--line-soft)]" />
            <div className="absolute left-10 top-10 mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Macro globe transitions to parcel map at zoom threshold
            </div>
            {entities.map((entity, index) => (
              <div
                className="absolute rounded-full border border-[var(--rune)] bg-[var(--rune-wash)] px-3 py-2 text-xs"
                key={entity.name}
                style={{ left: `${28 + index * 18}%`, top: `${38 + index * 9}%` }}
              >
                <span className="mono text-[var(--rune)]">{entity.score}</span> {entity.name}
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid gap-5">
          <Panel title="Reality Layers">
            <div className="grid gap-2">
              {layers.map((layer) => (
                <div className="flex items-center justify-between border-b border-[var(--line-faint)] py-2 text-sm" key={layer}>
                  <span>{layer}</span>
                  <span className="mono text-[var(--text-tertiary)]">on</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Live Signal Feed">
            <div className="grid gap-3">
              {alerts.map((alert) => (
                <div className="border-b border-[var(--line-faint)] pb-3" key={alert.title}>
                  <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--critical)]">{alert.priority}</div>
                  <div className="mt-1 text-sm">{alert.title}</div>
                  <div className="mono mt-1 text-[11px] text-[var(--text-tertiary)]">{alert.source}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Screen>
  );
}

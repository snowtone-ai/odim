import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { alerts, entities, layerActivity } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export default async function RealityMapPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.map;

  return (
    <Screen eyebrow={`${messages.common.screen} 01`} title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <Panel title={screen.panels.globe}>
          <div className="relative h-[560px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[radial-gradient(circle_at_50%_42%,var(--layer-compute-wash),transparent_18%),var(--ink-850)]">
            <div className="absolute inset-12 rounded-full border border-[var(--line-soft)]" />
            <div className="absolute left-10 top-10 mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              {screen.globeNote}
            </div>
            {entities.slice(0, 4).map((entity, index) => (
              <div
                className="absolute rounded-full border border-[var(--rune)] bg-[var(--rune-wash)] px-3 py-2 text-xs"
                key={entity.name}
                style={{ left: `${28 + index * 18}%`, top: `${38 + index * 9}%` }}
              >
                <span className="mono text-[var(--rune)]">{entity.score}</span> {entity.name}
                <span className="mono ml-2 text-[var(--text-tertiary)]">{Math.round(entity.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid gap-5">
          <Panel title={screen.panels.layers}>
            <div className="grid gap-2">
              {layerActivity.map((layer) => (
                <div className="border-b border-[var(--line-faint)] py-2 text-sm" key={layer.layer}>
                  <div className="flex items-center justify-between">
                    <span>{messages.layers[layerActivity.indexOf(layer)] ?? layer.layer}</span>
                    <span className="mono text-[var(--text-tertiary)]">{layer.count} signals</span>
                  </div>
                  <div className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {layer.source} / {Math.round(layer.confidence * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={screen.panels.liveFeed}>
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

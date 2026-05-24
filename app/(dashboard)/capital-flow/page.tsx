import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Confidence } from "@/components/ui/confidence";
import { capitalFlows, entities, layerActivity } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";

export default function CapitalFlowPage() {
  const messages = getMessages();
  const screen = messages.screens.capitalFlow;

  return (
    <Screen eyebrow={`${messages.common.screen} 02`} title={screen.title}>
      <div className="grid gap-5">
        <Panel title={screen.panels.sectorHeat}>
          <div className="grid grid-cols-7 gap-3">
            {layerActivity.map((layer, index) => (
              <div className="rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[var(--ink-850)] p-4" key={layer.layer}>
                <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  {messages.layers[index] ?? layer.layer}
                </div>
                <div className="mono mt-6 text-xl text-[var(--rune)]">{layer.count}</div>
                <div className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{layer.source}</div>
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid grid-cols-[1fr_380px] gap-5">
          <Panel title={screen.panels.sankey}>
            <div className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[linear-gradient(90deg,var(--ink-850),var(--ink-800))] p-6">
              {capitalFlows.map((flow) => (
                <div className="grid gap-2" key={flow.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{flow.from}</span>
                    <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--rune)]">{flow.type}</span>
                    <span>{flow.to}</span>
                  </div>
                  <div className="h-1.5 rounded-[var(--radius-sm)] bg-[var(--ink-700)]">
                    <div className="h-full rounded-[var(--radius-sm)] bg-[var(--layer-energy)]" style={{ width: `${flow.width}%` }} />
                  </div>
                  <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{flow.source}</div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={screen.panels.gap}>
            {entities.map((entity) => (
              <div className="border-b border-[var(--line-faint)] py-3 text-sm" key={entity.name}>
                <div className="mb-3 flex justify-between">
                  <span>{entity.name}</span>
                  <span className="mono text-[var(--rune)]">{entity.lead}d</span>
                </div>
                <Confidence value={entity.confidence} />
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </Screen>
  );
}

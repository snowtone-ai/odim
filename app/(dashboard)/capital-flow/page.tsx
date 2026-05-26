import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Confidence } from "@/components/ui/confidence";
import { capitalFlows, entities, layerActivity } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export default async function CapitalFlowPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.capitalFlow;

  return (
    <Screen eyebrow={`${messages.common.screen} 02`} title={screen.title}>
      <div className="grid gap-5">
        <Panel title={screen.panels.sectorHeat}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {layerActivity.map((layer, index) => (
              <div
                className="rounded-[var(--radius-md)] p-3.5 transition-all duration-[var(--dur-fast)] hover:translate-y-[-1px]"
                style={{
                  background: "var(--ink-850)",
                  border: "1px solid var(--line-faint)",
                  boxShadow: "var(--shadow-inset), var(--shadow-sm)"
                }}
                key={layer.layer}
              >
                <div
                  className="mono text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {messages.layers[index] ?? layer.layer}
                </div>
                <div
                  className="mono mt-4 text-xl font-medium"
                  style={{ color: "var(--rune)" }}
                >
                  {layer.count}
                </div>
                <div
                  className="mono mt-0.5 text-[10px] uppercase tracking-[0.11em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {layer.source}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
          <Panel title={screen.panels.sankey} accent>
            <div
              className="grid gap-5 rounded-[var(--radius-md)] p-5"
              style={{
                background: "linear-gradient(135deg, var(--ink-850), var(--ink-800))",
                border: "1px solid var(--line-faint)",
                boxShadow: "var(--shadow-inset)"
              }}
            >
              {capitalFlows.map((flow) => (
                <div className="grid gap-2" key={flow.id}>
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                      {flow.from}
                    </span>
                    <span
                      className="mono shrink-0 text-[10px] uppercase tracking-[0.12em]"
                      style={{ color: "var(--rune)" }}
                    >
                      {flow.type}
                    </span>
                    <span
                      className="min-w-0 truncate text-right"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {flow.to}
                    </span>
                  </div>
                  <div className="h-[3px] overflow-hidden rounded-full bg-[var(--ink-700)]">
                    <div
                      className="h-full rounded-full bg-[var(--layer-energy)]"
                      style={{
                        width: `${flow.width}%`,
                        boxShadow: "0 0 6px rgba(224,144,74,0.3)",
                        transformOrigin: "left",
                        animation: "bar-fill 800ms var(--ease-out-expo) both"
                      }}
                    />
                  </div>
                  <div
                    className="mono text-[10px] uppercase tracking-[0.11em]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {flow.source}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={screen.panels.gap}>
            {entities.map((entity) => (
              <div
                className="py-3"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={entity.id}
              >
                <div className="mb-2.5 flex justify-between text-[13px]">
                  <span style={{ color: "var(--text-primary)" }}>{entity.name}</span>
                  <span className="mono" style={{ color: "var(--rune)" }}>{entity.lead}d</span>
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

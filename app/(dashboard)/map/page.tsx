import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { RealityMap } from "@/components/ui/reality-map";
import { alerts, layerActivity } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export default async function RealityMapPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.map;

  return (
    <Screen eyebrow={`${messages.common.screen} 01`} title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
        <Panel title={screen.panels.globe} noPad accent>
          {/*
            Height: 100svh minus:
              py-6 top (24px) + header (~76px) + mb-7 (28px) + panel-header (~45px) + gap-5 (20px) + py-6 bottom (24px)
            = ~220px total overhead → [calc(100svh-220px)], capped at 680px
          */}
          <div className="h-[min(680px,calc(100svh-220px))] min-h-[360px]">
            <RealityMap
              layerLabels={[...messages.layers]}
              selectLabel={screen.panels.layers}
            />
          </div>
        </Panel>
        <div className="grid gap-5 xl:grid-rows-[auto_1fr]">
          <Panel title={screen.panels.layers}>
            <div className="grid gap-1">
              {layerActivity.map((layer, index) => (
                <div
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: "1px solid var(--line-faint)" }}
                  key={layer.layer}
                >
                  <div>
                    <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
                      {messages.layers[index] ?? layer.layer}
                    </div>
                    <div
                      className="mono mt-0.5 text-[10px] uppercase tracking-[0.11em]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {layer.source} · {Math.round(layer.confidence * 100)}%
                    </div>
                  </div>
                  <span className="mono text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    {layer.count}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={screen.panels.liveFeed}>
            <div className="grid gap-3">
              {alerts.slice(0, 5).map((alert) => (
                <div
                  className="pb-2.5"
                  style={{ borderBottom: "1px solid var(--line-faint)" }}
                  key={alert.title}
                >
                  <div
                    className="mono text-[10px] uppercase tracking-[0.12em]"
                    style={{ color: "var(--critical)" }}
                  >
                    {alert.priority}
                  </div>
                  <div className="mt-1 text-[13px] leading-snug" style={{ color: "var(--text-primary)" }}>
                    {alert.title}
                  </div>
                  <div
                    className="mono mt-1 text-[10px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {alert.source}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Screen>
  );
}

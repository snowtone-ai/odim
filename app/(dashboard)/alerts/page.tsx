import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Confidence } from "@/components/ui/confidence";
import { alerts } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export default async function AlertsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.alerts;

  return (
    <Screen eyebrow={`${messages.common.screen} 04`} title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <Panel title={screen.panels.queue}>
          {alerts.map((alert) => (
            <div className="border-b border-[var(--line-faint)] py-4" key={alert.title}>
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--critical)]">{alert.priority}</div>
              <div className="mt-2 text-sm">{alert.title}</div>
              <div className="mt-2 text-xs text-[var(--text-secondary)]">{alert.description}</div>
              <div className="mt-3">
                <Confidence value={alert.confidence} />
              </div>
            </div>
          ))}
        </Panel>
        <Panel title={screen.panels.chain}>
          <div className="grid gap-4">
            {screen.chainSteps.map((step, index) => (
              <div className="flex gap-3 border-b border-[var(--line-faint)] pb-4 sm:gap-4" key={step}>
                <div className="mono text-[var(--rune)]">0{index + 1}</div>
                <div>{step}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Screen>
  );
}

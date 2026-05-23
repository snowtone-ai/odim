import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { alerts } from "@/lib/data";

export default function AlertsPage() {
  return (
    <Screen eyebrow="Screen 04" title="Signal Alerts">
      <div className="grid grid-cols-[420px_1fr] gap-5">
        <Panel title="Alert Queue">
          {alerts.map((alert) => (
            <div className="border-b border-[var(--line-faint)] py-4" key={alert.title}>
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--critical)]">{alert.priority}</div>
              <div className="mt-2 text-sm">{alert.title}</div>
            </div>
          ))}
        </Panel>
        <Panel title="Signal Chain">
          <div className="grid gap-4">
            {["Raw filing observed", "Entity resolution matched", "SPV confidence increased", "Alert emitted"].map((step, index) => (
              <div className="flex gap-4 border-b border-[var(--line-faint)] pb-4" key={step}>
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

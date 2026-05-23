import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { auditEvents } from "@/lib/data";

export default function AuditPage() {
  return (
    <Screen eyebrow="Screen 07" title="Audit Trail">
      <Panel title="Transparent Event Log">
        {auditEvents.map((event) => (
          <div className="grid grid-cols-4 border-b border-[var(--line-faint)] py-3 text-sm" key={event.event}>
            <span className="mono">{event.event}</span>
            <span>{event.actor}</span>
            <span>{event.source}</span>
            <span className="mono text-right text-[var(--rune)]">{event.confidence}</span>
          </div>
        ))}
      </Panel>
    </Screen>
  );
}

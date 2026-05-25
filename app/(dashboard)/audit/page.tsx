import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { auditEvents } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export default async function AuditPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.audit;

  return (
    <Screen eyebrow={`${messages.common.screen} 07`} title={screen.title}>
      <Panel title={screen.panels.log}>
        {auditEvents.map((event) => (
          <div className="grid grid-cols-4 border-b border-[var(--line-faint)] py-3 text-sm" key={event.id}>
            <span className="mono">{event.event}</span>
            <span>{event.actor}</span>
            <span>{event.source}</span>
            <span className="mono text-right text-[var(--rune)]">{event.confidence}</span>
            <span className="col-span-4 mt-2 text-xs text-[var(--text-tertiary)]">
              {Object.entries(event.detail).slice(0, 2).map(([key, value]) => `${key}: ${String(value)}`).join(" / ")}
            </span>
          </div>
        ))}
      </Panel>
    </Screen>
  );
}

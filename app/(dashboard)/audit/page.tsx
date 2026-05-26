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
        <div className="overflow-x-auto">
          {auditEvents.map((event) => (
            <div
              className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 py-3 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--ink-750)]"
              style={{ borderBottom: "1px solid var(--line-faint)" }}
              key={event.id}
            >
              <span className="mono truncate text-[12px]" style={{ color: "var(--text-primary)" }}>
                {event.event}
              </span>
              <span className="truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {event.actor}
              </span>
              <span className="truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {event.source}
              </span>
              <span className="mono text-right text-[12px]" style={{ color: "var(--rune)" }}>
                {event.confidence}
              </span>
              <span
                className="col-span-4 mt-0.5 truncate text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {Object.entries(event.detail).slice(0, 2).map(([key, value]) => `${key}: ${String(value)}`).join(" / ")}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </Screen>
  );
}

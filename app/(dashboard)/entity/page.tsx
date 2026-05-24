import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Confidence } from "@/components/ui/confidence";
import { entities, ontologyLinks, timelineEvents } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";

export default function EntityPage() {
  const messages = getMessages();
  const screen = messages.screens.entity;
  const selected = entities[0];
  return (
    <Screen eyebrow={`${messages.common.screen} 03`} title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr_360px]">
        <Panel title={screen.panels.entities}>
          {entities.map((entity) => (
            <div className="border-b border-[var(--line-faint)] py-3 text-sm" key={entity.name}>
              <div>{entity.name}</div>
              <div className="mono text-[11px] text-[var(--text-tertiary)]">Reality Score {entity.score}</div>
              <div className="mono text-[11px] text-[var(--text-tertiary)]">{Math.round(entity.confidence * 100)}% confidence</div>
            </div>
          ))}
        </Panel>
        <Panel title={selected.name}>
          <div className="grid grid-cols-3 gap-4">
            <Metric label={screen.metrics.score} value={selected.score.toString()} />
            <Metric label={screen.metrics.committed} value={selected.committed} />
            <Metric label={screen.metrics.leadTime} value={`${selected.lead}d`} />
          </div>
          <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[var(--ink-850)] p-5">
            <div className="mono mb-4 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{screen.timeline}</div>
            <div className="grid gap-3">
              {timelineEvents.slice(0, 6).map((event) => (
                <div className="grid grid-cols-[92px_1fr_auto] gap-3 border-b border-[var(--line-faint)] pb-3 text-sm" key={`${event.date}-${event.title}`}>
                  <span className="mono text-[var(--text-tertiary)]">{event.date}</span>
                  <span>{event.title}</span>
                  <span className="mono text-[var(--rune)]">{Math.round(event.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel title={screen.panels.links}>
          {ontologyLinks.slice(0, 8).map((link) => (
            <div className="border-b border-[var(--line-faint)] py-3 text-[11px] text-[var(--text-secondary)]" key={`${link.from}-${link.to}-${link.type}`}>
              <div className="mono text-[var(--rune)]">{link.type}</div>
              <div className="mt-1 text-xs">{link.from} {"->"} {link.to}</div>
              <div className="mt-3">
                <Confidence value={link.confidence} />
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </Screen>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[var(--ink-850)] p-4">
      <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</div>
      <div className="mono mt-3 text-2xl text-[var(--rune)]">{value}</div>
    </div>
  );
}

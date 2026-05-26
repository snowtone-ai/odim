import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Confidence } from "@/components/ui/confidence";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { entities, ontologyLinks, timelineEvents } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export default async function EntityPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.entity;
  const selected = entities[0];

  return (
    <Screen eyebrow={`${messages.common.screen} 03`} title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[260px_1fr_320px]">
        <Panel title={screen.panels.entities}>
          {entities.map((entity) => (
            <div
              className="flex items-start justify-between py-3"
              style={{ borderBottom: "1px solid var(--line-faint)" }}
              key={entity.id}
            >
              <div>
                <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
                  {entity.name}
                </div>
                <div
                  className="mono mt-0.5 text-[11px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Score {entity.score} · {Math.round(entity.confidence * 100)}%
                </div>
              </div>
              <FavoriteButton id={entity.id} category="entity" label={entity.name} />
            </div>
          ))}
        </Panel>

        <Panel title={selected.name} accent>
          <div className="grid grid-cols-3 gap-3">
            <Metric label={screen.metrics.score} value={selected.score.toString()} />
            <Metric label={screen.metrics.committed} value={selected.committed} />
            <Metric label={screen.metrics.leadTime} value={`${selected.lead}d`} />
          </div>
          <div
            className="mt-5 rounded-[var(--radius-md)] p-4"
            style={{
              background: "var(--ink-850)",
              border: "1px solid var(--line-faint)",
              boxShadow: "var(--shadow-inset)"
            }}
          >
            <div
              className="mono mb-3 text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "var(--text-secondary)" }}
            >
              {screen.timeline}
            </div>
            <div className="grid gap-2.5">
              {timelineEvents.slice(0, 6).map((event) => (
                <div
                  className="grid grid-cols-[84px_1fr_auto] gap-2 pb-2.5 text-[13px]"
                  style={{ borderBottom: "1px solid var(--line-faint)" }}
                  key={`${event.date}-${event.title}`}
                >
                  <span className="mono" style={{ color: "var(--text-tertiary)" }}>{event.date}</span>
                  <span style={{ color: "var(--text-primary)" }}>{event.title}</span>
                  <span className="mono" style={{ color: "var(--rune)" }}>
                    {Math.round(event.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title={screen.panels.links}>
          {ontologyLinks.slice(0, 8).map((link) => (
            <div
              className="py-3"
              style={{ borderBottom: "1px solid var(--line-faint)" }}
              key={`${link.from}-${link.to}-${link.type}`}
            >
              <div className="mono text-[11px] font-medium" style={{ color: "var(--rune)" }}>
                {link.type}
              </div>
              <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-primary)" }}>
                {link.from} → {link.to}
              </div>
              <div className="mt-2.5">
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
    <div
      className="rounded-[var(--radius-md)] p-3.5"
      style={{
        background: "var(--ink-850)",
        border: "1px solid var(--line-faint)",
        boxShadow: "var(--shadow-inset), var(--shadow-sm)"
      }}
    >
      <div
        className="mono text-[10px] font-medium uppercase tracking-[0.13em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>
      <div
        className="mono mt-2.5 text-xl font-medium"
        style={{ color: "var(--rune)", textShadow: "0 0 14px rgba(201,169,97,0.18)" }}
      >
        {value}
      </div>
    </div>
  );
}

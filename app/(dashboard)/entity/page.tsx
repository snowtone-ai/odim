import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { entities } from "@/lib/data";

export default function EntityPage() {
  const selected = entities[0];
  return (
    <Screen eyebrow="Screen 03" title="Entity Intelligence">
      <div className="grid grid-cols-[280px_1fr_360px] gap-5">
        <Panel title="Entities">
          {entities.map((entity) => (
            <div className="border-b border-[var(--line-faint)] py-3 text-sm" key={entity.name}>
              <div>{entity.name}</div>
              <div className="mono text-[11px] text-[var(--text-tertiary)]">Reality Score {entity.score}</div>
            </div>
          ))}
        </Panel>
        <Panel title={selected.name}>
          <div className="grid grid-cols-3 gap-4">
            <Metric label="Reality Score" value={selected.score.toString()} />
            <Metric label="Committed" value={selected.committed} />
            <Metric label="Lead Time" value={`${selected.lead}d`} />
          </div>
          <div className="mt-6 h-72 rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[var(--ink-850)] p-5">
            Capital Commitment Timeline with narrative markers.
          </div>
        </Panel>
        <Panel title="Ontology Links">
          {["commits_capital_to", "funds", "requires_power_of", "controlled_via_spv"].map((link) => (
            <div className="mono border-b border-[var(--line-faint)] py-3 text-[11px] text-[var(--text-secondary)]" key={link}>
              {link}
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

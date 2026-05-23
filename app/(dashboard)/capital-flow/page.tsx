import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { entities, layers } from "@/lib/data";

export default function CapitalFlowPage() {
  return (
    <Screen eyebrow="Screen 02" title="Capital Flow">
      <div className="grid gap-5">
        <Panel title="Sector Heat">
          <div className="grid grid-cols-7 gap-3">
            {layers.map((layer, index) => (
              <div className="rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[var(--ink-850)] p-4" key={layer}>
                <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{layer}</div>
                <div className="mono mt-6 text-xl text-[var(--rune)]">${(index + 2) * 1.7}B</div>
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid grid-cols-[1fr_380px] gap-5">
          <Panel title="Entity Sankey Placeholder">
            <div className="h-80 rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[linear-gradient(90deg,var(--ink-850),var(--ink-800))] p-6">
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Microsoft {"->"} Grid {"->"} Utility {"->"} Data Center
              </div>
            </div>
          </Panel>
          <Panel title="Narrative to Reality Gap">
            {entities.map((entity) => (
              <div className="flex justify-between border-b border-[var(--line-faint)] py-3 text-sm" key={entity.name}>
                <span>{entity.name}</span>
                <span className="mono text-[var(--rune)]">{entity.lead}d</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </Screen>
  );
}

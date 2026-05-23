import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";

export default function HuginnPage() {
  return (
    <Screen eyebrow="Screen 05" title="Huginn Console">
      <div className="grid grid-cols-[1fr_360px] gap-5">
        <Panel title="Dialogue">
          <div className="min-h-[520px] rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[var(--ink-850)] p-5">
            Ask: Which entities are committing capital before narrative confirmation?
          </div>
        </Panel>
        <div className="grid gap-5">
          <Panel title="Reasoning Trace">Ontology walk, Munin retrieval, source attachment.</Panel>
          <Panel title="Munin">Org memory records: <span className="mono text-[var(--rune)]">128</span></Panel>
        </div>
      </div>
    </Screen>
  );
}

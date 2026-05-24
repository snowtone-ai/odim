import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Confidence } from "@/components/ui/confidence";
import { reasoningPreview } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";

export default function HuginnPage() {
  const messages = getMessages();
  const screen = messages.screens.huginn;

  return (
    <Screen eyebrow={`${messages.common.screen} 05`} title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <Panel title={screen.panels.dialogue}>
          <div className="grid min-h-[520px] gap-4 rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[var(--ink-850)] p-5">
            <div className="rounded-[var(--radius-md)] border border-[var(--line-faint)] p-4">
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">query</div>
              <div className="mt-2">{screen.prompt}</div>
            </div>
            {reasoningPreview.map((step) => (
              <div className="border-b border-[var(--line-faint)] pb-4" key={step.step}>
                <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--rune)]">{step.step}</div>
                <div className="mt-2 text-sm">{step.summary}</div>
                <div className="mono mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{step.source}</div>
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid gap-5">
          <Panel title={screen.panels.trace}>{screen.traceNote}</Panel>
          <Panel title={screen.panels.munin}>
            <div className="mono mb-4 text-2xl text-[var(--rune)]">{reasoningPreview.length}</div>
            <Confidence value={0.87} label={screen.memoryRecords} />
          </Panel>
        </div>
      </div>
    </Screen>
  );
}

import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Confidence } from "@/components/ui/confidence";
import { EvalButton } from "@/components/ui/eval-button";
import { answerHuginnQuestion } from "@/lib/huginn/query";
import { getMessages } from "@/lib/i18n/messages";

const defaultHuginnOrgId = process.env.PAID_SOURCE_ORG_ID || "11111111-1111-4111-8111-111111111111";

export const dynamic = "force-dynamic";

export default async function HuginnPage() {
  const messages = getMessages();
  const screen = messages.screens.huginn;
  const response = await answerHuginnQuestion({
    orgId: defaultHuginnOrgId,
    question: screen.prompt
  });
  const layers = response.retrieval_layers_used as Array<keyof typeof screen.cascadeLayers>;
  const muninCounts = response.munin.counts;

  return (
    <Screen eyebrow={`${messages.common.screen} 05`} title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <Panel title={screen.panels.dialogue}>
          <div className="grid min-h-[520px] gap-4 rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[var(--ink-850)] p-5">
            <div className="rounded-[var(--radius-md)] border border-[var(--line-faint)] p-4">
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">query</div>
              <div className="mt-2">{screen.prompt}</div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[var(--ink-900)] p-4 text-sm">
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">answer</div>
              <div className="mt-2">{response.answer}</div>
            </div>
            {response.reasoningTrace.map((step) => (
              <div className="border-b border-[var(--line-faint)] pb-4" key={`${step.step}:${step.summary}`}>
                <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--rune)]">{step.step}</div>
                <div className="mt-2 text-sm">{step.summary}</div>
                {step.sources?.length ? (
                  <div className="mono mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {step.sources.join(" / ")}
                  </div>
                ) : null}
              </div>
            ))}
            <div className="grid gap-2 text-sm">
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">grader</div>
              <span className="w-fit rounded-[var(--radius-sm)] border border-[var(--line-faint)] px-2 py-1 text-xs text-[var(--rune)]">
                {screen.badges.sycophancy}
              </span>
            </div>
          </div>
        </Panel>
        <div className="grid gap-5">
          <Panel title={screen.panels.trace}>
            <div className="grid gap-3 text-sm">
              <div>{screen.traceNote}</div>
              {layers.map((layer) => (
                <div className="flex items-center justify-between border-b border-[var(--line-faint)] pb-2" key={layer}>
                  <span>{screen.cascadeLayers[layer] ?? layer}</span>
                  <span className="mono text-[var(--rune)]">used</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={screen.panels.munin}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(muninCounts).map(([key, value]) => (
                <div className="border-b border-[var(--line-faint)] pb-2" key={key}>
                  <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {screen.muninCounts[key === "opinions" ? "opinion" : (key as keyof typeof screen.muninCounts)]}
                  </div>
                  <div className="mono mt-1 text-xl text-[var(--rune)]">{value}</div>
                </div>
              ))}
            </div>
            <Confidence value={response.confidence} label={screen.memoryRecords} />
          </Panel>
          <Panel title={screen.panels.sources}>
            <div className="grid gap-3 text-sm">
              {response.sources.map((source) => (
                <div className="flex items-center justify-between border-b border-[var(--line-faint)] pb-2" key={source}>
                  <span>{source}</span>
                  <span className="rounded-[var(--radius-sm)] border border-[var(--line-faint)] px-2 py-1 text-xs text-[var(--rune)]">{screen.badges.reality}</span>
                </div>
              ))}
              {response.narrativeContrast.map((item) => (
                <div className="flex items-center justify-between border-b border-[var(--line-faint)] pb-2" key={item.title}>
                  <span>{item.title}</span>
                  <span className="rounded-[var(--radius-sm)] border border-[var(--line-faint)] px-2 py-1 text-xs text-[var(--text-tertiary)]">{screen.badges.narrative}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={screen.panels.eval}>
            <EvalButton evalLogId={response.eval_log_id} labels={screen.eval} orgId={response.orgId} />
          </Panel>
        </div>
      </div>
    </Screen>
  );
}

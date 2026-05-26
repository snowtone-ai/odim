import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Confidence } from "@/components/ui/confidence";
import { EvalButton } from "@/components/ui/eval-button";
import { answerHuginnQuestion } from "@/lib/huginn/query";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

const defaultHuginnOrgId = process.env.PAID_SOURCE_ORG_ID || "11111111-1111-4111-8111-111111111111";

export const dynamic = "force-dynamic";

export default async function HuginnPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.huginn;
  const response = await answerHuginnQuestion({
    orgId: defaultHuginnOrgId,
    question: screen.prompt
  });
  const layers = response.retrieval_layers_used as Array<keyof typeof screen.cascadeLayers>;
  const muninCounts = response.munin.counts;

  return (
    <Screen eyebrow={`${messages.common.screen} 05`} title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <Panel title={screen.panels.dialogue} accent>
          <div
            className="grid min-h-[480px] gap-4 rounded-[var(--radius-md)] p-5"
            style={{
              background: "var(--ink-850)",
              border: "1px solid var(--line-faint)",
              boxShadow: "var(--shadow-inset)"
            }}
          >
            {/* Query */}
            <div
              className="rounded-[var(--radius-md)] p-4"
              style={{ border: "1px solid var(--line-faint)", boxShadow: "var(--shadow-inset)" }}
            >
              <div
                className="mono text-[10px] font-medium uppercase tracking-[0.13em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                query
              </div>
              <div className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {screen.prompt}
              </div>
            </div>
            {/* Answer */}
            <div
              className="rounded-[var(--radius-md)] p-4"
              style={{
                background: "var(--ink-900)",
                border: "1px solid var(--line-faint)",
                boxShadow: "var(--shadow-inset)"
              }}
            >
              <div
                className="mono text-[10px] font-medium uppercase tracking-[0.13em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                answer
              </div>
              <div className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {response.answer}
              </div>
            </div>
            {/* Reasoning trace */}
            {response.reasoningTrace.map((step) => (
              <div
                className="pb-3.5"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={`${step.step}:${step.summary}`}
              >
                <div
                  className="mono text-[10px] font-medium uppercase tracking-[0.13em]"
                  style={{ color: "var(--rune-dim)" }}
                >
                  {step.step}
                </div>
                <div className="mt-2 text-[13px]" style={{ color: "var(--text-primary)" }}>
                  {step.summary}
                </div>
                {step.sources?.length ? (
                  <div
                    className="mono mt-2 text-[10px] uppercase tracking-[0.11em]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {step.sources.join(" / ")}
                  </div>
                ) : null}
              </div>
            ))}
            {/* Grader badge */}
            <div className="grid gap-2">
              <div
                className="mono text-[10px] font-medium uppercase tracking-[0.13em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                grader
              </div>
              <span
                className="w-fit rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-medium"
                style={{
                  color: "var(--rune)",
                  background: "var(--rune-wash)",
                  border: "1px solid rgba(201,169,97,0.14)"
                }}
              >
                {screen.badges.sycophancy}
              </span>
            </div>
          </div>
        </Panel>

        <div className="grid gap-5">
          <Panel title={screen.panels.trace}>
            <div className="grid gap-2">
              <div className="mb-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {screen.traceNote}
              </div>
              {layers.map((layer) => (
                <div
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: "1px solid var(--line-faint)" }}
                  key={layer}
                >
                  <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                    {screen.cascadeLayers[layer] ?? layer}
                  </span>
                  <span
                    className="mono rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em]"
                    style={{
                      color: "var(--rune)",
                      background: "var(--rune-wash)",
                      border: "1px solid rgba(201,169,97,0.12)"
                    }}
                  >
                    used
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={screen.panels.munin}>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(muninCounts).map(([key, value]) => (
                <div
                  className="pb-2.5"
                  style={{ borderBottom: "1px solid var(--line-faint)" }}
                  key={key}
                >
                  <div
                    className="mono text-[10px] font-medium uppercase tracking-[0.12em]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {screen.muninCounts[key === "opinions" ? "opinion" : (key as keyof typeof screen.muninCounts)]}
                  </div>
                  <div
                    className="mono mt-1.5 text-lg font-medium"
                    style={{ color: "var(--rune)" }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Confidence value={response.confidence} label={screen.memoryRecords} />
            </div>
          </Panel>

          <Panel title={screen.panels.sources}>
            <div className="grid gap-2.5">
              {response.sources.map((source) => (
                <div
                  className="flex items-center justify-between pb-2.5"
                  style={{ borderBottom: "1px solid var(--line-faint)" }}
                  key={source}
                >
                  <span className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>
                    {source}
                  </span>
                  <span
                    className="mono shrink-0 rounded-[var(--radius-sm)] px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      color: "var(--rune)",
                      background: "var(--rune-wash)",
                      border: "1px solid rgba(201,169,97,0.12)"
                    }}
                  >
                    {screen.badges.reality}
                  </span>
                </div>
              ))}
              {response.narrativeContrast.map((item) => (
                <div
                  className="flex items-center justify-between pb-2.5"
                  style={{ borderBottom: "1px solid var(--line-faint)" }}
                  key={item.title}
                >
                  <span className="truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    {item.title}
                  </span>
                  <span
                    className="mono shrink-0 rounded-[var(--radius-sm)] px-2 py-0.5 text-[10px]"
                    style={{
                      color: "var(--text-tertiary)",
                      border: "1px solid var(--line-faint)"
                    }}
                  >
                    {screen.badges.narrative}
                  </span>
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

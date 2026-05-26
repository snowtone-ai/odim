"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/panel";
import { Confidence } from "@/components/ui/confidence";
import { HuginnInput } from "@/components/ui/huginn-input";
import { EvalButton } from "@/components/ui/eval-button";
import type { ClientHuginnResponse } from "@/app/actions/huginn";

// Use the shared serializable type from the Server Action
type HuginnResponse = ClientHuginnResponse;

type CascadeLayers = Record<string, string>;

type EvalLabels = {
  rating: string;
  note: string;
  submit: string;
  sent: string;
  error: string;
};

type Props = {
  defaultOrgId: string;
  defaultQuestion: string;
  initialResponse: HuginnResponse;
  cascadeLayers: CascadeLayers;
  memoryRecords: string;
  panelLabels: {
    dialogue: string;
    trace: string;
    munin: string;
    sources: string;
    eval: string;
  };
  badgeLabels: {
    reality: string;
    narrative: string;
  };
  inputLabels: {
    hint: string;
    submit: string;
    thinking: string;
    prompt: string;
  };
  traceNote: string;
  evalLabels: EvalLabels;
  /** Server Action for submitting new questions without client-side auth */
  action: (question: string, orgId: string) => Promise<HuginnResponse>;
};

export function HuginnConsole({
  defaultOrgId,
  defaultQuestion,
  initialResponse,
  cascadeLayers,
  memoryRecords,
  panelLabels,
  badgeLabels,
  inputLabels,
  traceNote,
  evalLabels,
  action
}: Readonly<Props>) {
  const [response, setResponse] = useState<HuginnResponse>(initialResponse);
  const [currentQuestion, setCurrentQuestion] = useState(defaultQuestion);

  const layers = response.retrieval_layers_used as Array<keyof typeof cascadeLayers>;
  const totalMemory = Object.values(response.munin.counts).reduce((sum, v) => sum + v, 0);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
      <Panel title={panelLabels.dialogue} accent>
        <div
          className="grid min-h-[480px] gap-4 rounded-[var(--radius-md)] p-5"
          style={{
            background: "var(--ink-850)",
            border: "1px solid var(--line-faint)",
            boxShadow: "var(--shadow-inset)"
          }}
        >
          {/* Query input */}
          <HuginnInput
            defaultOrgId={defaultOrgId}
            defaultQuestion={defaultQuestion}
            initialResponse={initialResponse}
            labels={inputLabels}
            action={action}
            onResponse={(r, q) => { setResponse(r); setCurrentQuestion(q); }}
          />

          {/* Current query display */}
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
              {currentQuestion}
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
        </div>
      </Panel>

      <div className="grid gap-5">
        {/* Reasoning Trace Layers */}
        <Panel title={panelLabels.trace}>
          <div className="grid gap-2">
            <div className="mb-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {traceNote}
            </div>
            {layers.map((layer) => (
              <div
                className="flex items-center justify-between py-2"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={layer}
              >
                <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                  {cascadeLayers[layer] ?? layer}
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

        {/* Munin — simplified: confidence + total count only */}
        <Panel title={panelLabels.munin}>
          <div className="flex items-baseline gap-3">
            <span
              className="mono text-2xl font-medium"
              style={{ color: "var(--rune)" }}
            >
              {totalMemory}
            </span>
            <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {memoryRecords}
            </span>
          </div>
          <div className="mt-4">
            <Confidence value={response.confidence} />
          </div>
        </Panel>

        {/* Sources */}
        <Panel title={panelLabels.sources}>
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
                  {badgeLabels.reality}
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
                  {badgeLabels.narrative}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Eval */}
        <Panel title={panelLabels.eval}>
          <EvalButton evalLogId={response.eval_log_id} labels={evalLabels} orgId={response.orgId} />
        </Panel>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { Confidence } from "@/components/ui/confidence";
import { HuginnInput } from "@/components/ui/huginn-input";
import { EvalButton } from "@/components/ui/eval-button";
import type { ClientHuginnResponse } from "@/app/actions/huginn";
import type { LayerKey } from "@/lib/map/types";

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
  emptyStateText: string;
  showOnMapLabel: string;
  action: (question: string, orgId: string) => Promise<HuginnResponse>;
};

// Layer keywords to detect map-related queries
const LAYER_KEYWORDS: Record<string, LayerKey> = {
  energy: "energy", "エネルギー": "energy",
  cash: "cash", capital: "cash", "資本": "cash", "資金": "cash",
  land: "land", "土地": "land",
  compute: "compute", "計算": "compute", "データセンター": "compute",
  water: "water", "水": "water",
  "raw material": "raw_materials", "原材料": "raw_materials", mining: "raw_materials",
  logistics: "logistics", "物流": "logistics", shipping: "logistics"
};

function detectMapFilter(question: string, answer: string): LayerKey | null {
  const text = `${question} ${answer}`.toLowerCase();
  for (const [keyword, layer] of Object.entries(LAYER_KEYWORDS)) {
    if (text.includes(keyword.toLowerCase())) return layer;
  }
  return null;
}

export function HuginnConsole({
  defaultOrgId,
  cascadeLayers,
  memoryRecords,
  panelLabels,
  badgeLabels,
  inputLabels,
  traceNote,
  evalLabels,
  emptyStateText,
  showOnMapLabel,
  action
}: Readonly<Props>) {
  const router = useRouter();
  const [response, setResponse] = useState<HuginnResponse | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);

  const layers = response ? (response.retrieval_layers_used as Array<keyof typeof cascadeLayers>) : [];
  const totalMemory = response ? Object.values(response.munin.counts).reduce((sum, v) => sum + v, 0) : 0;

  const mapFilter = response && currentQuestion ? detectMapFilter(currentQuestion, response.answer) : null;

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
            labels={inputLabels}
            action={action}
            onResponse={(r, q) => { setResponse(r); setCurrentQuestion(q); }}
          />

          {/* Empty state */}
          {!response && (
            <div
              className="flex min-h-[300px] items-center justify-center rounded-[var(--radius-md)] p-8"
              style={{ border: "1px dashed var(--line-faint)" }}
            >
              <div
                className="text-center text-[13px] leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                {emptyStateText}
              </div>
            </div>
          )}

          {/* Active response */}
          {response && currentQuestion && (
            <>
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

              {/* Answer + Show on Map */}
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

                {/* Show on Map button */}
                {mapFilter && (
                  <button
                    type="button"
                    onClick={() => router.push(`/map?filter=${mapFilter}`)}
                    className="mono mt-4 flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[11px] uppercase tracking-[0.1em] transition-all hover:brightness-110"
                    style={{
                      background: "var(--rune-wash)",
                      border: "1px solid rgba(201,169,97,0.20)",
                      color: "var(--rune)"
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
                      <path d="M8 2v16" />
                      <path d="M16 6v16" />
                    </svg>
                    {showOnMapLabel}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                    </svg>
                  </button>
                )}
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
            </>
          )}
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

        {/* Munin */}
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
          {response && (
            <div className="mt-4">
              <Confidence value={response.confidence} />
            </div>
          )}
        </Panel>

        {/* Sources */}
        {response && (
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
        )}

        {/* Eval */}
        {response && (
          <Panel title={panelLabels.eval}>
            <EvalButton evalLogId={response.eval_log_id} labels={evalLabels} orgId={response.orgId} />
          </Panel>
        )}
      </div>
    </div>
  );
}

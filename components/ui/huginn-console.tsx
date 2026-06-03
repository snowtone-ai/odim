"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Panel } from "@/components/ui/panel";
import { Confidence } from "@/components/ui/confidence";
import { HuginnInput } from "@/components/ui/huginn-input";
import { HuginnIcon } from "@/components/ui/huginn-icon";
import { EvalButton } from "@/components/ui/eval-button";
import type { ClientHuginnResponse } from "@/app/actions/huginn";
import type { LayerKey } from "@/lib/map/types";
import { useHuginnTemplates } from "@/lib/stores/huginn-templates";
import { useQueryHistory } from "@/lib/stores/query-history";
import { SavedSearchBar } from "@/components/ui/saved-search-bar";

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
  locale?: string;
  cascadeLayers: CascadeLayers;
  memoryRecords: string;
  panelLabels: {
    dialogue: string;
    trace: string;
    evidence?: string;
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
  webSearchLabel: string;
  presetsLabel: string;
  historyLabels: {
    recentQueries: string;
    clearHistory: string;
  };
  action: (question: string, orgId: string, webSearch?: boolean) => Promise<HuginnResponse>;
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

// Geographic region → map center coordinates
const REGION_COORDS: Record<string, { lat: number; lng: number; zoom: number }> = {
  // Countries (EN)
  japan: { lat: 36.2, lng: 138.3, zoom: 5 }, usa: { lat: 39.8, lng: -98.6, zoom: 4 },
  "united states": { lat: 39.8, lng: -98.6, zoom: 4 }, china: { lat: 35.9, lng: 104.2, zoom: 4 },
  india: { lat: 20.6, lng: 78.9, zoom: 5 }, uk: { lat: 53.4, lng: -2.0, zoom: 5.5 },
  "united kingdom": { lat: 53.4, lng: -2.0, zoom: 5.5 }, england: { lat: 52.3, lng: -1.2, zoom: 6 },
  germany: { lat: 51.2, lng: 10.4, zoom: 5.5 }, france: { lat: 46.6, lng: 2.2, zoom: 5.5 },
  australia: { lat: -25.3, lng: 133.8, zoom: 4 }, brazil: { lat: -14.2, lng: -51.9, zoom: 4 },
  canada: { lat: 56.1, lng: -106.3, zoom: 3.5 }, singapore: { lat: 1.35, lng: 103.8, zoom: 10 },
  "saudi arabia": { lat: 24.0, lng: 45.0, zoom: 5 }, mexico: { lat: 23.6, lng: -102.5, zoom: 5 },
  korea: { lat: 35.9, lng: 127.8, zoom: 6.5 }, "south korea": { lat: 35.9, lng: 127.8, zoom: 6.5 },
  indonesia: { lat: -0.8, lng: 113.9, zoom: 4 }, chile: { lat: -35.7, lng: -71.5, zoom: 4 },
  netherlands: { lat: 52.1, lng: 5.3, zoom: 7 }, uae: { lat: 24.0, lng: 54.0, zoom: 7 },
  greece: { lat: 39.1, lng: 21.8, zoom: 6 }, malaysia: { lat: 4.2, lng: 101.9, zoom: 6 },
  texas: { lat: 31.0, lng: -100.0, zoom: 5.5 }, iowa: { lat: 42.0, lng: -93.5, zoom: 6.5 },
  nevada: { lat: 38.8, lng: -116.4, zoom: 6 }, ohio: { lat: 40.4, lng: -82.7, zoom: 6.5 },
  virginia: { lat: 37.4, lng: -78.7, zoom: 6.5 },
  // Countries (JA)
  "日本": { lat: 36.2, lng: 138.3, zoom: 5 }, "アメリカ": { lat: 39.8, lng: -98.6, zoom: 4 },
  "米国": { lat: 39.8, lng: -98.6, zoom: 4 }, "中国": { lat: 35.9, lng: 104.2, zoom: 4 },
  "インド": { lat: 20.6, lng: 78.9, zoom: 5 }, "イギリス": { lat: 53.4, lng: -2.0, zoom: 5.5 },
  "英国": { lat: 53.4, lng: -2.0, zoom: 5.5 }, "ドイツ": { lat: 51.2, lng: 10.4, zoom: 5.5 },
  "フランス": { lat: 46.6, lng: 2.2, zoom: 5.5 }, "オーストラリア": { lat: -25.3, lng: 133.8, zoom: 4 },
  "ブラジル": { lat: -14.2, lng: -51.9, zoom: 4 }, "カナダ": { lat: 56.1, lng: -106.3, zoom: 3.5 },
  "シンガポール": { lat: 1.35, lng: 103.8, zoom: 10 }, "サウジアラビア": { lat: 24.0, lng: 45.0, zoom: 5 },
  "メキシコ": { lat: 23.6, lng: -102.5, zoom: 5 }, "韓国": { lat: 35.9, lng: 127.8, zoom: 6.5 },
  "インドネシア": { lat: -0.8, lng: 113.9, zoom: 4 }, "オランダ": { lat: 52.1, lng: 5.3, zoom: 7 },
  // Regions
  "middle east": { lat: 25.0, lng: 45.0, zoom: 4.5 }, "中東": { lat: 25.0, lng: 45.0, zoom: 4.5 },
  "southeast asia": { lat: 5.0, lng: 110.0, zoom: 4 }, "東南アジア": { lat: 5.0, lng: 110.0, zoom: 4 },
  europe: { lat: 50.0, lng: 10.0, zoom: 4 }, "ヨーロッパ": { lat: 50.0, lng: 10.0, zoom: 4 },
  "欧州": { lat: 50.0, lng: 10.0, zoom: 4 }, asia: { lat: 30.0, lng: 100.0, zoom: 3 },
  "アジア": { lat: 30.0, lng: 100.0, zoom: 3 }, africa: { lat: 0.0, lng: 20.0, zoom: 3 },
  "アフリカ": { lat: 0.0, lng: 20.0, zoom: 3 },
  // Cities
  tokyo: { lat: 35.7, lng: 139.7, zoom: 9 }, "東京": { lat: 35.7, lng: 139.7, zoom: 9 },
  "new york": { lat: 40.7, lng: -74.0, zoom: 9 }, "ニューヨーク": { lat: 40.7, lng: -74.0, zoom: 9 },
  london: { lat: 51.5, lng: -0.1, zoom: 9 }, "ロンドン": { lat: 51.5, lng: -0.1, zoom: 9 },
  dubai: { lat: 25.2, lng: 55.3, zoom: 9 }, "ドバイ": { lat: 25.2, lng: 55.3, zoom: 9 },
  sydney: { lat: -33.9, lng: 151.2, zoom: 9 }, "シドニー": { lat: -33.9, lng: 151.2, zoom: 9 },
  rotterdam: { lat: 51.9, lng: 4.5, zoom: 9 }, "ロッテルダム": { lat: 51.9, lng: 4.5, zoom: 9 },
  kumamoto: { lat: 32.8, lng: 130.7, zoom: 9 }, "熊本": { lat: 32.8, lng: 130.7, zoom: 9 },
};

function detectRegion(question: string, answer: string): { lat: number; lng: number; zoom: number } | null {
  const text = `${question} ${answer}`.toLowerCase();
  // Check longest keywords first to prefer "south korea" over "korea", "united states" over "usa"
  const sorted = Object.entries(REGION_COORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, coords] of sorted) {
    if (text.includes(keyword.toLowerCase())) return coords;
  }
  return null;
}

type Message = {
  role: "user" | "assistant";
  content: string;
  response?: HuginnResponse;
};

export function HuginnConsole({
  defaultOrgId,
  locale = "en",
  cascadeLayers,
  memoryRecords,
  panelLabels,
  badgeLabels,
  inputLabels,
  traceNote,
  evalLabels,
  emptyStateText,
  showOnMapLabel,
  webSearchLabel,
  presetsLabel,
  historyLabels,
  action
}: Readonly<Props>) {
  const router = useRouter();
  const activePresets = useHuginnTemplates((s) => s.allPresets)();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<number | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [inputPrefill, setInputPrefill] = useState("");
  const [variableForm, setVariableForm] = useState<{ presetId: string; values: Record<string, string> } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { entries: historyEntries, addEntry, clearHistory } = useQueryHistory();

  const latestResponse = [...messages].reverse().find((m: Message) => m.role === "assistant")?.response ?? null;
  const layers = latestResponse ? (latestResponse.retrieval_layers_used as Array<keyof typeof cascadeLayers>) : [];
  const totalMemory: number = latestResponse ? Object.values(latestResponse.munin.counts).reduce<number>((sum, v) => sum + v, 0) : 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(question: string) {
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const data = await action(question, defaultOrgId, webSearch || undefined);
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, response: data }]);
      addEntry({
        question,
        timestamp: new Date().toISOString(),
        confidence: typeof data.confidence === "number" ? data.confidence : null
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(presetId: string) {
    const preset = activePresets.find((p) => p.id === presetId);
    if (!preset) return;
    const template = locale === "ja" ? preset.templateJa : preset.template;
    if (preset.variables?.length) {
      const initial: Record<string, string> = {};
      for (const v of preset.variables) initial[v] = "";
      setVariableForm({ presetId, values: initial });
    } else {
      setInputPrefill(template);
    }
  }

  function submitVariableForm() {
    if (!variableForm) return;
    const preset = activePresets.find((p) => p.id === variableForm.presetId);
    if (!preset) return;
    const template = locale === "ja" ? preset.templateJa : preset.template;
    let filled = template;
    for (const [key, value] of Object.entries(variableForm.values)) {
      filled = filled.replaceAll(`{${key}}`, value || `[${key}]`);
    }
    setInputPrefill(filled);
    setVariableForm(null);
  }

  function formatRelativeTime(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") { lastAssistantIdx = i; break; }
  }
  const mapFilter = lastAssistantIdx >= 0
    ? detectMapFilter(
        messages[lastAssistantIdx - 1]?.content ?? "",
        messages[lastAssistantIdx]?.content ?? ""
      )
    : null;
  const mapRegion = lastAssistantIdx >= 0
    ? detectRegion(
        messages[lastAssistantIdx - 1]?.content ?? "",
        messages[lastAssistantIdx]?.content ?? ""
      )
    : null;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
      {/* Main conversation area */}
      <div className="flex min-h-[calc(100vh-120px)] flex-col">
        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          {messages.length === 0 && (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-5 flex w-14 items-center justify-center">
                  <HuginnIcon size={48} />
                </div>
                <div
                  className="text-[14px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {emptyStateText}
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {activePresets.slice(0, 3).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className="mono rounded-full px-3 py-1.5 text-[11px] tracking-[0.04em] transition-all duration-[var(--dur-fast)] hover:bg-[var(--rune-wash)]"
                      style={{
                        background: "var(--ink-800)",
                        border: "1px solid var(--line-faint)",
                        color: "var(--text-secondary)"
                      }}
                    >
                      {locale === "ja" ? preset.labelJa : preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Compare mode: side-by-side last two assistant responses */}
          {compareMode && (() => {
            const assistantMsgs = messages.filter((m) => m.role === "assistant");
            const prev = assistantMsgs[assistantMsgs.length - 2] ?? null;
            const curr = assistantMsgs[assistantMsgs.length - 1] ?? null;
            if (!curr) return null;
            return (
              <div className="grid grid-cols-2 gap-3 px-4 py-4" style={{ maxHeight: "calc(100vh - 200px)", overflow: "auto" }}>
                {/* Previous */}
                <div
                  className="rounded-[var(--radius-md)] p-4"
                  style={{ background: "var(--ink-850)", border: "1px solid var(--line-faint)" }}
                >
                  <div className="mono mb-2 text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
                    Previous
                    {prev?.response && (
                      <span className="ml-2" style={{ color: "var(--rune-dim)" }}>
                        {Math.round((prev.response.confidence ?? 0) * 100)}% conf.
                      </span>
                    )}
                  </div>
                  {prev ? (
                    <div className="huginn-prose text-[13px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{prev.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>No previous response</div>
                  )}
                </div>
                {/* Current */}
                <div
                  className="rounded-[var(--radius-md)] p-4"
                  style={{ background: "var(--ink-800)", border: "1px solid rgba(201,169,97,0.18)" }}
                >
                  <div className="mono mb-2 text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--rune-dim)" }}>
                    Current
                    {curr.response && (
                      <span className="ml-2" style={{ color: "var(--rune)" }}>
                        {Math.round((curr.response.confidence ?? 0) * 100)}% conf.
                        {prev?.response && (() => {
                          const delta = (curr.response?.confidence ?? 0) - (prev.response?.confidence ?? 0);
                          if (Math.abs(delta) < 0.01) return null;
                          return (
                            <span style={{ color: delta > 0 ? "var(--positive, #22c55e)" : "var(--critical)" }}>
                              {` ${delta > 0 ? "+" : ""}${Math.round(delta * 100)}%`}
                            </span>
                          );
                        })()}
                      </span>
                    )}
                  </div>
                  <div className="huginn-prose text-[13px] leading-[1.7]" style={{ color: "var(--text-primary)" }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{curr.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className={`mx-auto max-w-2xl space-y-6 px-4 py-6 ${compareMode ? "hidden" : ""}`}>
            {messages.map((msg, idx) => (
              <div key={`${idx}-${msg.role}`}>
                {msg.role === "user" ? (
                  /* User message */
                  <div className="flex justify-end">
                    <div
                      className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-[14px] leading-relaxed"
                      style={{
                        background: "var(--ink-700)",
                        color: "var(--text-primary)"
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  /* Assistant message */
                  <div className="space-y-3">
                    <div className="huginn-prose text-[14px] leading-[1.7]" style={{ color: "var(--text-primary)" }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Reasoning trace — collapsible */}
                    {msg.response?.reasoningTrace?.length ? (
                      <div
                        className="mt-3 rounded-[var(--radius-md)] overflow-hidden"
                        style={{ border: "1px solid var(--line-faint)" }}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedTrace(expandedTrace === idx ? null : idx)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors duration-[var(--dur-fast)] hover:bg-[var(--ink-750)]"
                          style={{ background: "var(--ink-850)" }}
                        >
                          <span
                            className="mono text-[10px] font-medium uppercase tracking-[0.13em]"
                            style={{ color: "var(--rune-dim)" }}
                          >
                            reasoning trace · {msg.response.reasoningTrace.length} steps
                          </span>
                          <svg
                            width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="var(--text-tertiary)" strokeWidth="2"
                            className={`transition-transform duration-[var(--dur-fast)] ${expandedTrace === idx ? "rotate-180" : ""}`}
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {expandedTrace === idx && (
                          <div className="px-3 py-2 space-y-2" style={{ background: "var(--ink-900)" }}>
                            {msg.response.reasoningTrace.map((step) => (
                              <div
                                className="py-2"
                                style={{ borderBottom: "1px solid var(--line-faint)" }}
                                key={`${step.step}:${step.summary}`}
                              >
                                <div
                                  className="mono text-[10px] font-medium uppercase tracking-[0.12em]"
                                  style={{ color: "var(--rune-dim)" }}
                                >
                                  {step.step}
                                </div>
                                <div className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                  {step.summary}
                                </div>
                                {step.sources?.length ? (
                                  <div
                                    className="mono mt-1 text-[10px] tracking-[0.1em]"
                                    style={{ color: "var(--text-tertiary)" }}
                                  >
                                    {step.sources.join(" · ")}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Show on Map */}
                    {idx === lastAssistantIdx && mapFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams({ filter: mapFilter! });
                          if (mapRegion) {
                            params.set("lat", String(mapRegion.lat));
                            params.set("lng", String(mapRegion.lng));
                            params.set("zoom", String(mapRegion.zoom));
                          }
                          router.push(`/map?${params.toString()}`);
                        }}
                        className="mono mt-2 flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.1em] transition-all hover:brightness-110"
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
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-1.5 py-4">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--rune-dim)]" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--rune-dim)]" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--rune-dim)]" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
        </div>

        {/* Input area — fixed at bottom */}
        <div
          className="shrink-0 px-4 py-4"
          style={{ borderTop: "1px solid var(--line-faint)" }}
        >
          <div className="mx-auto max-w-2xl">
            {/* Variable form (shown inline when a preset with variables is selected) */}
            {variableForm && (() => {
              const preset = activePresets.find((p) => p.id === variableForm.presetId);
              if (!preset) return null;
              return (
                <div
                  className="mb-3 rounded-[var(--radius-md)] p-3"
                  style={{ background: "var(--ink-800)", border: "1px solid var(--line-faint)" }}
                >
                  <div
                    className="mono mb-2 text-[10px] uppercase tracking-[0.1em]"
                    style={{ color: "var(--rune-dim)" }}
                  >
                    {locale === "ja" ? preset.labelJa : preset.label}
                  </div>
                  <div className="grid gap-2">
                    {preset.variables?.map((variable) => (
                      <div key={variable} className="flex items-center gap-2">
                        <span
                          className="mono w-24 shrink-0 text-[10px]"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {variable}
                        </span>
                        <input
                          type="text"
                          value={variableForm.values[variable] ?? ""}
                          onChange={(e) =>
                            setVariableForm((prev) =>
                              prev
                                ? { ...prev, values: { ...prev.values, [variable]: e.target.value } }
                                : null
                            )
                          }
                          onKeyDown={(e) => { if (e.key === "Enter") submitVariableForm(); }}
                          className="flex-1 rounded px-2 py-1 text-[12px] outline-none"
                          style={{
                            background: "var(--ink-900)",
                            border: "1px solid var(--line-faint)",
                            color: "var(--text-primary)"
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={submitVariableForm}
                      className="mono rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors"
                      style={{ background: "var(--rune)", color: "var(--ink-950)" }}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setVariableForm(null)}
                      className="mono rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors"
                      style={{ background: "var(--ink-700)", color: "var(--text-tertiary)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* PRIMARY: Input box — dominant element */}
            <HuginnInput
              defaultOrgId={defaultOrgId}
              labels={inputLabels}
              action={action}
              onSubmit={handleSubmit}
              loading={loading}
              prefillValue={inputPrefill}
            />

            {/* SECONDARY TOOLBAR: Analysis modes + Quick presets — one compact row */}
            <div
              className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5"
            >
              {/* Analysis mode toggles — grouped left */}
              <div className="flex items-center gap-1" style={{ paddingRight: 10, borderRight: "1px solid var(--line-faint)" }}>
                <button
                  type="button"
                  onClick={() => setCompareMode((v) => !v)}
                  className="mono flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] tracking-[0.07em] transition-all duration-[var(--dur-fast)]"
                  style={{
                    background: compareMode ? "rgba(59,130,246,0.12)" : "transparent",
                    border: compareMode ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                    color: compareMode ? "#60a5fa" : "var(--text-tertiary)"
                  }}
                  title="Compare last two responses side-by-side"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="18" rx="1" />
                    <rect x="14" y="3" width="7" height="18" rx="1" />
                  </svg>
                  Compare
                </button>
                <button
                  type="button"
                  onClick={() => setWebSearch((v) => !v)}
                  className="mono flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] tracking-[0.07em] transition-all duration-[var(--dur-fast)]"
                  style={{
                    background: webSearch ? "var(--rune-wash)" : "transparent",
                    border: webSearch ? "1px solid rgba(201,169,97,0.25)" : "1px solid transparent",
                    color: webSearch ? "var(--rune)" : "var(--text-tertiary)"
                  }}
                  title={webSearchLabel}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  {webSearchLabel}
                  {webSearch && (
                    <span
                      className="inline-block h-[5px] w-[5px] rounded-full"
                      style={{ background: "var(--positive)" }}
                    />
                  )}
                </button>
              </div>

              {/* Quick presets — scrollable, right of analysis modes */}
              <span
                className="mono shrink-0 text-[9px] uppercase tracking-[0.12em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {presetsLabel}
              </span>
              {activePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={locale === "ja" ? preset.labelJa : preset.label}
                  onClick={() => applyPreset(preset.id)}
                  className="mono flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] tracking-[0.06em] transition-all duration-[var(--dur-fast)] hover:bg-[var(--rune-wash)] hover:border-[rgba(201,169,97,0.2)]"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--line-faint)",
                    color: "var(--text-secondary)"
                  }}
                >
                  {locale === "ja" ? preset.labelJa : preset.label}
                </button>
              ))}
            </div>

            {/* TERTIARY: Saved searches */}
            <div className="mt-2">
              <SavedSearchBar
                type="huginn"
                currentQuery={inputPrefill}
                currentFilters={{ webSearch: String(webSearch) }}
                onApply={(entry) => {
                  setInputPrefill(entry.query);
                  setWebSearch(entry.filters.webSearch === "true");
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar panels */}
      <div className="grid gap-5 self-start">
        {/* Recent Queries */}
        {historyEntries.length > 0 && (
          <Panel title={historyLabels.recentQueries}>
            <div className="grid gap-1.5">
              {historyEntries.slice(0, 8).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setInputPrefill(entry.question)}
                  className="w-full rounded-[var(--radius-sm)] px-2 py-2 text-left transition-colors hover:bg-[var(--ink-750)]"
                  style={{ background: "var(--ink-850)" }}
                >
                  <div
                    className="truncate text-[12px]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {entry.question.length > 60 ? `${entry.question.slice(0, 60)}…` : entry.question}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span
                      className="mono text-[9px] uppercase tracking-[0.1em]"
                      style={{ color: "var(--text-quaternary)" }}
                    >
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                    {entry.confidence !== null && (
                      <span
                        className="mono text-[9px]"
                        style={{ color: "var(--rune-dim)" }}
                      >
                        {Math.round(entry.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearHistory}
              className="mono mt-3 w-full text-center text-[10px] uppercase tracking-[0.1em] transition-colors hover:text-[var(--critical)]"
              style={{ color: "var(--text-quaternary)" }}
            >
              {historyLabels.clearHistory}
            </button>
          </Panel>
        )}

        {/* Trace Layers */}
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

        {/* Evidence Graph */}
        {latestResponse?.evidenceGraph && (
          <Panel title={panelLabels.evidence ?? "Evidence Paths"}>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div
                className="rounded-[var(--radius-sm)] px-2 py-1.5"
                style={{ background: "var(--ink-850)", border: "1px solid var(--line-faint)" }}
              >
                <div className="mono text-[8px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>
                  citations
                </div>
                <div className="mono mt-0.5 text-[14px] tabular-nums" style={{ color: "var(--rune)" }}>
                  {Math.round(latestResponse.evidenceGraph.metrics.citationCoverage * 100)}%
                </div>
              </div>
              <div
                className="rounded-[var(--radius-sm)] px-2 py-1.5"
                style={{ background: "var(--ink-850)", border: "1px solid var(--line-faint)" }}
              >
                <div className="mono text-[8px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>
                  trace
                </div>
                <div className="mono mt-0.5 text-[14px] tabular-nums" style={{ color: "var(--rune)" }}>
                  {Math.round(latestResponse.evidenceGraph.metrics.traceCompleteness * 100)}%
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              {latestResponse.evidenceGraph.paths.slice(0, 3).map((path) => (
                <div
                  key={path.id}
                  className="rounded-[var(--radius-sm)] px-2.5 py-2"
                  style={{ background: "var(--ink-850)", border: "1px solid var(--line-faint)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>
                      {path.title}
                    </span>
                    <span className="mono shrink-0 text-[9px] tabular-nums" style={{ color: "var(--rune)" }}>
                      {Math.round(path.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {path.rationale}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {path.sources.slice(0, 3).map((source) => (
                      <span
                        key={`${path.id}:${source.sourceId}`}
                        className="mono max-w-[110px] truncate rounded-[3px] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.06em]"
                        style={{ background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.14)", color: "var(--rune-dim)" }}
                      >
                        {source.sourceId}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Munin */}
        <Panel title={panelLabels.munin}>
          <div className="flex items-baseline gap-3">
            <span className="mono text-2xl font-medium" style={{ color: "var(--rune)" }}>
              {totalMemory}
            </span>
            <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {memoryRecords}
            </span>
          </div>
          {latestResponse && (
            <div className="mt-4">
              <Confidence value={latestResponse.confidence} />
            </div>
          )}
        </Panel>

        {/* Sources */}
        {latestResponse && (
          <Panel title={panelLabels.sources}>
            <div className="grid gap-2.5">
              {latestResponse.sources.map((source: string) => (
                <div
                  className="flex items-center justify-between gap-2 pb-2.5"
                  style={{ borderBottom: "1px solid var(--line-faint)" }}
                  key={source}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--positive, #22c55e)" }} />
                    <span className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>
                      {source}
                    </span>
                  </div>
                  <span
                    className="mono shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em]"
                    style={{
                      color: "var(--positive, #22c55e)",
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.15)"
                    }}
                  >
                    {badgeLabels.reality}
                  </span>
                </div>
              ))}
              {latestResponse.narrativeContrast.map((item: { title: string }) => (
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
        {latestResponse && (
          <Panel title={panelLabels.eval}>
            <EvalButton evalLogId={latestResponse.eval_log_id} labels={evalLabels} orgId={latestResponse.orgId} />
          </Panel>
        )}
      </div>
    </div>
  );
}

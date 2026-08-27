"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ExternalLink, Globe, Map, RefreshCw, Search } from "lucide-react";
import { HuginnInput } from "@/components/ui/huginn-input";
import { EvalButton } from "@/components/ui/eval-button";
import { EvidenceThread, type EvidenceThreadStep } from "@/components/ui/evidence-thread";
import { HuginnThinking } from "@/components/ui/huginn-thinking";
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
  const text = (question + " " + answer).toLowerCase();
  for (const [keyword, layer] of Object.entries(LAYER_KEYWORDS)) {
    if (text.includes(keyword.toLowerCase())) return layer;
  }
  return null;
}

const REGION_COORDS: Record<string, { lat: number; lng: number; zoom: number }> = {
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
  "日本": { lat: 36.2, lng: 138.3, zoom: 5 }, "アメリカ": { lat: 39.8, lng: -98.6, zoom: 4 },
  "米国": { lat: 39.8, lng: -98.6, zoom: 4 }, "中国": { lat: 35.9, lng: 104.2, zoom: 4 },
  "インド": { lat: 20.6, lng: 78.9, zoom: 5 }, "イギリス": { lat: 53.4, lng: -2.0, zoom: 5.5 },
  "英国": { lat: 53.4, lng: -2.0, zoom: 5.5 }, "ドイツ": { lat: 51.2, lng: 10.4, zoom: 5.5 },
  "フランス": { lat: 46.6, lng: 2.2, zoom: 5.5 }, "オーストラリア": { lat: -25.3, lng: 133.8, zoom: 4 },
  "ブラジル": { lat: -14.2, lng: -51.9, zoom: 4 }, "カナダ": { lat: 56.1, lng: -106.3, zoom: 3.5 },
  "シンガポール": { lat: 1.35, lng: 103.8, zoom: 10 }, "サウジアラビア": { lat: 24.0, lng: 45.0, zoom: 5 },
  "メキシコ": { lat: 23.6, lng: -102.5, zoom: 5 }, "韓国": { lat: 35.9, lng: 127.8, zoom: 6.5 },
  "インドネシア": { lat: -0.8, lng: 113.9, zoom: 4 }, "オランダ": { lat: 52.1, lng: 5.3, zoom: 7 },
  "middle east": { lat: 25.0, lng: 45.0, zoom: 4.5 }, "中東": { lat: 25.0, lng: 45.0, zoom: 4.5 },
  "southeast asia": { lat: 5.0, lng: 110.0, zoom: 4 }, "東南アジア": { lat: 5.0, lng: 110.0, zoom: 4 },
  europe: { lat: 50.0, lng: 10.0, zoom: 4 }, "ヨーロッパ": { lat: 50.0, lng: 10.0, zoom: 4 },
  "欧州": { lat: 50.0, lng: 10.0, zoom: 4 }, asia: { lat: 30.0, lng: 100.0, zoom: 3 },
  "アジア": { lat: 30.0, lng: 100.0, zoom: 3 }, africa: { lat: 0.0, lng: 20.0, zoom: 3 },
  "アフリカ": { lat: 0.0, lng: 20.0, zoom: 3 },
  tokyo: { lat: 35.7, lng: 139.7, zoom: 9 }, "東京": { lat: 35.7, lng: 139.7, zoom: 9 },
  "new york": { lat: 40.7, lng: -74.0, zoom: 9 }, "ニューヨーク": { lat: 40.7, lng: -74.0, zoom: 9 },
  london: { lat: 51.5, lng: -0.1, zoom: 9 }, "ロンドン": { lat: 51.5, lng: -0.1, zoom: 9 },
  dubai: { lat: 25.2, lng: 55.3, zoom: 9 }, "ドバイ": { lat: 25.2, lng: 55.3, zoom: 9 },
  sydney: { lat: -33.9, lng: 151.2, zoom: 9 }, "シドニー": { lat: -33.9, lng: 151.2, zoom: 9 },
  rotterdam: { lat: 51.9, lng: 4.5, zoom: 9 }, "ロッテルダム": { lat: 51.9, lng: 4.5, zoom: 9 },
  kumamoto: { lat: 32.8, lng: 130.7, zoom: 9 }, "熊本": { lat: 32.8, lng: 130.7, zoom: 9 }
};

function detectRegion(question: string, answer: string): { lat: number; lng: number; zoom: number } | null {
  const text = (question + " " + answer).toLowerCase();
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

type RequestError = {
  question: string;
  webSearch: boolean;
  message: string;
};

type ActionFailureCode =
  | "unauthorized"
  | "rate_limited"
  | "internal"
  | "provider_unavailable"
  | "deadline_exceeded"
  | "retrieval_unavailable"
  | "aborted";

const ACTION_FAILURE_CODES = [
  "unauthorized",
  "rate_limited",
  "internal",
  "provider_unavailable",
  "deadline_exceeded",
  "retrieval_unavailable",
  "aborted"
] as const satisfies readonly ActionFailureCode[];

const SAFE_STATUS_MESSAGES: Record<ActionFailureCode, { en: string; ja: string }> = {
  unauthorized: {
    en: "Huginn needs an authorized organization session. Sign in and try again.",
    ja: "Huginnを実行するには認証済みの組織セッションが必要です。サインインして再試行してください。"
  },
  rate_limited: {
    en: "Huginn is temporarily rate-limited for this organization. Please retry shortly.",
    ja: "この組織のHuginn利用は一時的に制限されています。少し待ってから再試行してください。"
  },
  internal: {
    en: "Huginn could not safely complete this request. Please try again shortly.",
    ja: "Huginnはこのリクエストを安全に完了できませんでした。しばらくしてから再試行してください。"
  },
  provider_unavailable: {
    en: "Huginn's answer provider is temporarily unavailable. Please try again shortly.",
    ja: "Huginnの回答サービスは一時的に利用できません。しばらくしてから再試行してください。"
  },
  deadline_exceeded: {
    en: "Huginn could not verify this request before the deadline. Try a narrower question.",
    ja: "Huginnは期限内にこのリクエストを検証できませんでした。質問を短くして再試行してください。"
  },
  retrieval_unavailable: {
    en: "Huginn could not retrieve the source evidence needed for this request. Please try again.",
    ja: "Huginnはこのリクエストに必要な根拠ソースを取得できませんでした。再試行してください。"
  },
  aborted: {
    en: "Huginn stopped this request before verification completed. Please try again.",
    ja: "Huginnは検証を完了する前にこのリクエストを停止しました。再試行してください。"
  }
};

function isActionFailureCode(code: string | undefined): code is ActionFailureCode {
  return Boolean(code && ACTION_FAILURE_CODES.includes(code as ActionFailureCode));
}

function safeStatusMessage(code: ActionFailureCode, locale: string) {
  const messages = SAFE_STATUS_MESSAGES[code];
  return locale === "ja" ? messages.ja : messages.en;
}

function safeTransportErrorMessage(locale: string) {
  return locale === "ja"
    ? "Huginnのリクエストを完了できませんでした。しばらくしてから再試行してください。"
    : "Huginn could not complete this request. Please try again shortly.";
}

type InspectorSource = {
  id: string;
  title: string;
  url?: string;
};

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return Math.floor(hours / 24) + "d ago";
}

function sourceRows(response: HuginnResponse | null): InspectorSource[] {
  if (!response) return [];
  const graphSources = response.evidenceGraph?.paths.flatMap((path) =>
    path.sources.map((source) => ({
      id: source.sourceId,
      title: source.title || source.sourceId,
      url: source.url || undefined
    }))
  ) ?? [];
  const values = graphSources.length
    ? graphSources
    : response.sources.map((source) => ({ id: source, title: source }));
  return values.filter((source, index) => values.findIndex((candidate) => candidate.id === source.id) === index);
}

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
  const activePresets = useHuginnTemplates((state) => state.allPresets)();
  const { entries: historyEntries, addEntry, clearHistory } = useQueryHistory();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<RequestError | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [inputPrefill, setInputPrefill] = useState("");
  const [draftQuestion, setDraftQuestion] = useState("");
  const [variableForm, setVariableForm] = useState<{ presetId: string; values: Record<string, string> } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  let lastAssistantIdx = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") {
      lastAssistantIdx = index;
      break;
    }
  }

  const latestResponse = lastAssistantIdx >= 0 ? messages[lastAssistantIdx].response ?? null : null;
  const latestQuestion = lastAssistantIdx > 0 ? messages[lastAssistantIdx - 1]?.content ?? "" : "";
  const mapFilter = latestResponse ? detectMapFilter(latestQuestion, latestResponse.answer) : null;
  const mapRegion = latestResponse ? detectRegion(latestQuestion, latestResponse.answer) : null;
  const layers = latestResponse ? (latestResponse.retrieval_layers_used as Array<keyof typeof cascadeLayers>) : [];
  const totalMemory = latestResponse
    ? Object.values(latestResponse.munin.counts).reduce<number>((sum, value) => sum + value, 0)
    : 0;
  const inspectorSources = useMemo(() => sourceRows(latestResponse), [latestResponse]);
  const primaryPath = latestResponse?.evidenceGraph?.paths[0];

  const mapHref = useMemo(() => {
    if (!mapFilter) return undefined;
    const params = new URLSearchParams({ filter: mapFilter });
    if (mapRegion) {
      params.set("lat", String(mapRegion.lat));
      params.set("lng", String(mapRegion.lng));
      params.set("zoom", String(mapRegion.zoom));
    }
    return "/map?" + params.toString();
  }, [mapFilter, mapRegion]);

  const evidenceSteps = useMemo<EvidenceThreadStep[]>(() => {
    if (!latestResponse) return [];
    return [
      {
        id: "source",
        label: panelLabels.sources,
        detail: inspectorSources.length + " cited source" + (inspectorSources.length === 1 ? "" : "s"),
        href: inspectorSources[0]?.url,
        verified: inspectorSources.length > 0
      },
      {
        id: "entity",
        label: "Entity context",
        detail: primaryPath?.title ?? "No graph path returned",
        verified: Boolean(primaryPath)
      },
      {
        id: "answer",
        label: "Grounded answer",
        detail: Math.round(latestResponse.confidence * 100) + "% confidence",
        verified: latestResponse.confidence > 0
      },
      {
        id: "action",
        label: mapHref ? showOnMapLabel : "Review cited evidence",
        detail: mapHref ? "Open the related reality layer" : "Inspect sources and trace",
        href: mapHref
      }
    ];
  }, [inspectorSources, latestResponse, mapHref, panelLabels.sources, primaryPath, showOnMapLabel]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, requestError]);

  async function runQuestion(question: string, appendQuestion: boolean, useWebSearch: boolean) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || loading) return;

    if (appendQuestion) {
      setMessages((previous) => [...previous, { role: "user", content: trimmedQuestion }]);
    }
    setRequestError(null);
    setLoading(true);

    try {
      const data = await action(trimmedQuestion, defaultOrgId, useWebSearch || undefined);
      const statusCode = data.status?.code;
      if (isActionFailureCode(statusCode)) {
        setRequestError({
          question: trimmedQuestion,
          webSearch: useWebSearch,
          message: safeStatusMessage(statusCode, locale)
        });
        return;
      }
      setMessages((previous) => [...previous, { role: "assistant", content: data.answer, response: data }]);
      addEntry({
        question: trimmedQuestion,
        timestamp: new Date().toISOString(),
        confidence: typeof data.confidence === "number" ? data.confidence : null
      });
      setInspectorOpen(true);
    } catch {
      setRequestError({
        question: trimmedQuestion,
        webSearch: useWebSearch,
        message: safeTransportErrorMessage(locale)
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(question: string) {
    void runQuestion(question, true, webSearch);
  }

  function applyPreset(presetId: string) {
    const preset = activePresets.find((item) => item.id === presetId);
    if (!preset) return;
    const template = locale === "ja" ? preset.templateJa : preset.template;
    if (preset.variables?.length) {
      const values: Record<string, string> = {};
      for (const variable of preset.variables) values[variable] = "";
      setVariableForm({ presetId, values });
      return;
    }
    setInputPrefill(template);
    setDraftQuestion(template);
  }

  function submitVariableForm() {
    if (!variableForm) return;
    const preset = activePresets.find((item) => item.id === variableForm.presetId);
    if (!preset) return;
    const template = locale === "ja" ? preset.templateJa : preset.template;
    let filled = template;
    for (const [key, value] of Object.entries(variableForm.values)) {
      filled = filled.replaceAll("{" + key + "}", value || "[" + key + "]");
    }
    setInputPrefill(filled);
    setDraftQuestion(filled);
    setVariableForm(null);
  }

  function openMap() {
    if (mapHref) router.push(mapHref);
  }

  const assistantMessages = messages.filter((message) => message.role === "assistant");
  const previousAssistant = assistantMessages[assistantMessages.length - 2] ?? null;
  const currentAssistant = assistantMessages[assistantMessages.length - 1] ?? null;

  return (
    <section
      aria-label={panelLabels.dialogue}
      className="grid h-[calc(100dvh-10.5rem)] min-h-[400px] overflow-hidden border bg-[var(--field)] xl:h-[calc(100dvh-7rem)] xl:grid-cols-[minmax(0,1fr)_22rem]"
      data-testid="huginn-workspace"
      style={{ borderColor: "var(--line-soft)" }}
    >
      <main className="order-1 flex min-h-0 flex-col" aria-label={panelLabels.dialogue}>
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          data-testid="huginn-conversation"
          tabIndex={-1}
        >
          {messages.length === 0 ? (
            <div className="flex min-h-full items-center px-5 py-8 sm:px-8" data-testid="huginn-empty">
              <div className="max-w-xl border-l-2 pl-4" style={{ borderColor: "var(--evidence)" }}>
                <Search aria-hidden="true" size={20} style={{ color: "var(--evidence)" }} />
                <p className="mt-4 text-[15px] leading-7 text-[var(--text-primary)]">
                  {emptyStateText}
                </p>
                <p className="mt-2 text-[12px] leading-6 text-[var(--text-secondary)]">
                  Start with one of these grounded lines of inquiry.
                </p>
                <div className="mt-5 grid border-t" style={{ borderColor: "var(--line-soft)" }}>
                  {activePresets.slice(0, 3).map((preset) => (
                    <button
                      className="flex min-h-11 items-center justify-between border-b px-3 text-left text-[12px] transition-colors duration-[var(--motion-micro)] hover:bg-[var(--surface-hover)] motion-reduce:transition-none"
                      key={preset.id}
                      onClick={() => applyPreset(preset.id)}
                      type="button"
                      style={{ borderColor: "var(--line-soft)", color: "var(--text-primary)" }}
                    >
                      <span>{locale === "ja" ? preset.labelJa : preset.label}</span>
                      <span aria-hidden="true" className="text-[16px]" style={{ color: "var(--text-tertiary)" }}>→</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : compareMode && currentAssistant ? (
            <div className="grid min-h-full grid-cols-1 divide-y p-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:p-6" style={{ borderColor: "var(--line-soft)" }}>
              <article className="min-w-0 py-4 sm:px-5 sm:py-0">
                <div className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  Previous answer
                </div>
                {previousAssistant?.response ? (
                  <div className="mt-2 text-[12px] text-[var(--text-secondary)]">
                    {Math.round(previousAssistant.response.confidence * 100)}% confidence
                  </div>
                ) : null}
                {previousAssistant ? (
                  <div className="huginn-prose mt-5 text-[14px] leading-7 text-[var(--text-secondary)]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{previousAssistant.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="mt-5 text-[13px] text-[var(--text-tertiary)]">No previous response yet.</p>
                )}
              </article>
              <article className="min-w-0 py-4 sm:px-5 sm:py-0">
                <div className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--signal)]">
                  Current answer
                </div>
                {currentAssistant.response ? (
                  <div className="mt-2 text-[12px] text-[var(--text-secondary)]">
                    {Math.round(currentAssistant.response.confidence * 100)}% confidence
                  </div>
                ) : null}
                <div className="huginn-prose mt-5 text-[14px] leading-7 text-[var(--text-primary)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentAssistant.content}</ReactMarkdown>
                </div>
              </article>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-8 px-5 py-7 sm:px-8">
              {messages.map((message, index) => (
                <article
                  className={message.role === "user" ? "border-l-2 pl-4" : "border-t pt-6"}
                  key={index + "-" + message.role}
                  style={{
                    borderColor: message.role === "user" ? "var(--signal)" : "var(--line-soft)"
                  }}
                >
                  {message.role === "user" ? (
                    <>
                      <p className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                        Question
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-[var(--text-primary)]">
                        {message.content}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--evidence)]">
                          Grounded answer
                        </p>
                        {message.response ? (
                          <span className="text-[12px] text-[var(--text-secondary)]">
                            {Math.round(message.response.confidence * 100)}% confidence · {message.response.sources.length} cited
                          </span>
                        ) : null}
                      </div>
                      <div className="huginn-prose mt-4 text-[14px] leading-7 text-[var(--text-primary)]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      </div>
                      {index === lastAssistantIdx && mapHref ? (
                        <button
                          className="odim-control mt-5 min-h-11 px-3 text-[12px] transition-[background-color,color,border-color] duration-[var(--motion-state)] hover:bg-[var(--surface-hover)] motion-reduce:transition-none"
                          onClick={openMap}
                          type="button"
                        >
                          <Map aria-hidden="true" size={15} />
                          {showOnMapLabel}
                        </button>
                      ) : null}
                    </>
                  )}
                </article>
              ))}
              {loading ? (
                <HuginnThinking />
              ) : null}
            </div>
          )}
        </div>

        <div
          className="sticky bottom-0 shrink-0 border-t bg-[var(--field)] px-4 py-3 sm:px-6"
          data-testid="huginn-composer-zone"
          style={{ borderColor: "var(--line-soft)" }}
        >
          <div className="mx-auto max-w-3xl">
            {requestError ? (
              <div
                aria-live="assertive"
                className="mb-3 flex min-h-11 items-center justify-between gap-3 border-l-2 px-3 py-2 text-[12px] leading-5"
                data-testid="huginn-request-error"
                role="alert"
                style={{ borderColor: "var(--critical)", background: "var(--surface)" }}
              >
                <span>{requestError.message}</span>
                <button
                  className="odim-control min-h-11 shrink-0 px-3 text-[12px]"
                  onClick={() => void runQuestion(requestError.question, false, requestError.webSearch)}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" size={14} />
                  Retry
                </button>
              </div>
            ) : null}

            {variableForm ? (() => {
              const preset = activePresets.find((item) => item.id === variableForm.presetId);
              if (!preset) return null;
              return (
                <div className="mb-3 border-l-2 py-2 pl-3" style={{ borderColor: "var(--signal)" }}>
                  <p className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--signal)]">
                    {locale === "ja" ? preset.labelJa : preset.label}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {preset.variables?.map((variable) => (
                      <label className="grid gap-1 text-[12px] text-[var(--text-secondary)]" key={variable}>
                        <span>{variable}</span>
                        <input
                          className="min-h-11 border bg-[var(--field)] px-3 text-[14px] text-[var(--text-primary)] outline-none transition-[border-color] duration-[var(--motion-micro)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--signal)] motion-reduce:transition-none"
                          onChange={(event) =>
                            setVariableForm((previous) =>
                              previous
                                ? {
                                    ...previous,
                                    values: { ...previous.values, [variable]: event.target.value }
                                  }
                                : null
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") submitVariableForm();
                          }}
                          style={{ borderColor: "var(--line-soft)" }}
                          type="text"
                          value={variableForm.values[variable] ?? ""}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="odim-control min-h-11 px-3 text-[12px]" onClick={submitVariableForm} type="button">
                      Apply
                    </button>
                    <button className="odim-control min-h-11 px-3 text-[12px]" onClick={() => setVariableForm(null)} type="button">
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })() : null}

            <HuginnInput
              action={action}
              defaultOrgId={defaultOrgId}
              labels={inputLabels}
              loading={loading}
              onDraftChange={setDraftQuestion}
              onSubmit={handleSubmit}
              prefillValue={inputPrefill}
            />

            <div className="mt-2 flex min-h-11 flex-wrap items-center gap-1.5">
              <button
                aria-pressed={compareMode}
                className="odim-control min-h-11 px-3 text-[12px] transition-[background-color,color,border-color] duration-[var(--motion-micro)] motion-reduce:transition-none"
                onClick={() => setCompareMode((value) => !value)}
                title="Compare the latest two answers"
                type="button"
              >
                Compare
              </button>
              <button
                aria-pressed={webSearch}
                className="odim-control min-h-11 px-3 text-[12px] transition-[background-color,color,border-color] duration-[var(--motion-micro)] motion-reduce:transition-none"
                onClick={() => setWebSearch((value) => !value)}
                title={webSearchLabel}
                type="button"
              >
                <Globe aria-hidden="true" size={14} />
                {webSearchLabel}
              </button>
              <span className="ml-1 text-[11px] text-[var(--text-tertiary)]">{presetsLabel}</span>
              <div className="flex min-h-11 max-w-full items-center gap-1 overflow-x-auto">
                {activePresets.map((preset) => (
                  <button
                    className="odim-control min-h-11 shrink-0 px-3 text-[12px] transition-[background-color,color,border-color] duration-[var(--motion-micro)] hover:bg-[var(--surface-hover)] motion-reduce:transition-none"
                    key={preset.id}
                    onClick={() => applyPreset(preset.id)}
                    title={locale === "ja" ? preset.labelJa : preset.label}
                    type="button"
                  >
                    {locale === "ja" ? preset.labelJa : preset.label}
                  </button>
                ))}
              </div>
            </div>

            <SavedSearchBar
              currentFilters={{ webSearch: String(webSearch) }}
              currentQuery={draftQuestion}
              onApply={(entry) => {
                setInputPrefill(entry.query);
                setDraftQuestion(entry.query);
                setWebSearch(entry.filters.webSearch === "true");
              }}
              type="huginn"
            />
          </div>
        </div>
        {/* HuginnThinking owns the live status; backend labels such as "Retrieving source context" and "Building grounded answer" are not announced while document.hidden. */}
      </main>

      <aside
        aria-label="Sources and execution trace"
        className="order-2 min-h-0 border-t bg-[var(--surface)] xl:border-l xl:border-t-0"
        style={{ borderColor: "var(--line-soft)" }}
      >
        <button
          aria-controls="huginn-inspector"
          aria-expanded={inspectorOpen}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left transition-[background-color,color] duration-[var(--motion-micro)] hover:bg-[var(--surface-hover)] motion-reduce:transition-none"
          data-testid="huginn-inspector-toggle"
          onClick={() => setInspectorOpen((value) => !value)}
          type="button"
        >
          <span>
            <span className="block text-[13px] font-medium text-[var(--text-primary)]">
              {panelLabels.sources} &amp; {panelLabels.trace}
            </span>
            <span className="mt-0.5 block text-[11px] text-[var(--text-tertiary)]">
              {inspectorSources.length} sources · {latestResponse?.reasoningTrace.length ?? 0} execution steps
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={inspectorOpen ? "rotate-180" : ""}
            size={16}
            style={{ color: "var(--text-secondary)", transition: "transform var(--motion-state) var(--ease-out)" }}
          />
        </button>

        {inspectorOpen ? (
          <div
            className="max-h-[38dvh] overflow-y-auto border-t transition-[opacity] duration-[var(--motion-surface)] motion-reduce:transition-none xl:max-h-none xl:h-[calc(100%-44px)]"
            data-testid="huginn-inspector"
            id="huginn-inspector"
            style={{ borderColor: "var(--line-soft)" }}
          >
            {latestResponse ? (
              <>
                <section className="px-4 py-4" aria-labelledby="huginn-evidence-path">
                  <h2 className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]" id="huginn-evidence-path">
                    Evidence path
                  </h2>
                  <EvidenceThread
                    activeId="answer"
                    className="mt-4"
                    label="Source to entity to answer to action"
                    orientation="vertical"
                    steps={evidenceSteps}
                  />
                </section>

                <section className="border-t px-4 py-4" aria-labelledby="huginn-sources" style={{ borderColor: "var(--line-soft)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]" id="huginn-sources">
                      {panelLabels.sources}
                    </h2>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {latestResponse.evidenceGraph?.source === "fallback" ? "Fallback evidence" : "Repository evidence"}
                    </span>
                  </div>
                  {inspectorSources.length ? (
                    <ul className="mt-3 divide-y" style={{ borderColor: "var(--line-soft)" }}>
                      {inspectorSources.map((source) => (
                        <li className="flex min-h-11 items-center gap-2 py-2" key={source.id}>
                          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-[var(--evidence)]" />
                          {source.url ? (
                            <a
                              className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-primary)] underline-offset-4 hover:underline"
                              href={source.url}
                              rel="noreferrer"
                              target="_blank"
                              title={source.title}
                            >
                              {source.title}
                            </a>
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-primary)]" title={source.title}>
                              {source.title}
                            </span>
                          )}
                          {source.url ? <ExternalLink aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" size={13} /> : null}
                          <span className="shrink-0 text-[11px] text-[var(--evidence)]">{badgeLabels.reality}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[12px] leading-6 text-[var(--text-secondary)]">
                      No cited sources were returned for this response.
                    </p>
                  )}
                  {latestResponse.narrativeContrast.length ? (
                    <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--line-soft)" }}>
                      {latestResponse.narrativeContrast.map((item) => (
                        <div className="flex min-h-11 items-center justify-between gap-3" key={item.title}>
                          <span className="truncate text-[12px] text-[var(--text-secondary)]">{item.title}</span>
                          <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">{badgeLabels.narrative}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="border-t px-4 py-4" aria-labelledby="huginn-trace" style={{ borderColor: "var(--line-soft)" }}>
                  <h2 className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]" id="huginn-trace">
                    {panelLabels.trace}
                  </h2>
                  <p className="mt-2 text-[12px] leading-6 text-[var(--text-secondary)]">{traceNote}</p>
                  {layers.length ? (
                    <ul className="mt-3 divide-y" style={{ borderColor: "var(--line-soft)" }}>
                      {layers.map((layer) => (
                        <li className="flex min-h-11 items-center justify-between gap-3" key={layer}>
                          <span className="text-[12px] text-[var(--text-primary)]">{cascadeLayers[layer] ?? layer}</span>
                          <span className="text-[11px] text-[var(--signal)]">used</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {latestResponse.reasoningTrace.length ? (
                    <ol className="mt-3 divide-y border-t" style={{ borderColor: "var(--line-soft)" }}>
                      {latestResponse.reasoningTrace.map((step) => (
                        <li className="py-3" key={step.step + ":" + step.summary}>
                          <div className="flex items-start justify-between gap-3">
                            <span className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--signal)]">{step.step}</span>
                            {typeof step.confidence === "number" ? (
                              <span className="shrink-0 text-[11px] text-[var(--text-secondary)]">
                                {Math.round(step.confidence * 100)}%
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[12px] leading-6 text-[var(--text-secondary)]">{step.summary}</p>
                          {step.sources?.length ? (
                            <p className="mt-1 text-[11px] leading-5 text-[var(--text-tertiary)]">{step.sources.join(" · ")}</p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-[12px] leading-6 text-[var(--text-secondary)]">No execution trace was returned.</p>
                  )}
                </section>

                <section className="border-t px-4 py-4" aria-labelledby="huginn-context" style={{ borderColor: "var(--line-soft)" }}>
                  <h2 className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]" id="huginn-context">
                    {panelLabels.munin}
                  </h2>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <dt className="text-[11px] text-[var(--text-tertiary)]">{memoryRecords}</dt>
                      <dd className="mt-1 text-[18px] tabular-nums text-[var(--text-primary)]">{totalMemory}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[var(--text-tertiary)]">Confidence</dt>
                      <dd className="mt-1 text-[18px] tabular-nums text-[var(--signal)]">
                        {Math.round(latestResponse.confidence * 100)}%
                      </dd>
                    </div>
                    {latestResponse.evidenceGraph ? (
                      <>
                        <div>
                          <dt className="text-[11px] text-[var(--text-tertiary)]">Citation coverage</dt>
                          <dd className="mt-1 text-[13px] tabular-nums text-[var(--text-primary)]">
                            {Math.round(latestResponse.evidenceGraph.metrics.citationCoverage * 100)}%
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-[var(--text-tertiary)]">Trace completeness</dt>
                          <dd className="mt-1 text-[13px] tabular-nums text-[var(--text-primary)]">
                            {Math.round(latestResponse.evidenceGraph.metrics.traceCompleteness * 100)}%
                          </dd>
                        </div>
                      </>
                    ) : null}
                  </dl>
                </section>

                <section className="border-t px-4 py-4" aria-labelledby="huginn-eval" style={{ borderColor: "var(--line-soft)" }}>
                  <h2 className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]" id="huginn-eval">
                    {panelLabels.eval}
                  </h2>
                  <div className="mt-3">
                    <EvalButton evalLogId={latestResponse.eval_log_id} labels={evalLabels} orgId={latestResponse.orgId} />
                  </div>
                </section>
              </>
            ) : (
              <p className="px-4 py-5 text-[12px] leading-6 text-[var(--text-secondary)]">
                Submit a question to inspect cited sources and the execution trace.
              </p>
            )}

            {historyEntries.length ? (
              <section className="border-t px-4 py-4" aria-labelledby="huginn-history" style={{ borderColor: "var(--line-soft)" }}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]" id="huginn-history">
                    {historyLabels.recentQueries}
                  </h2>
                  <button className="min-h-11 px-2 text-[11px] text-[var(--text-secondary)] underline-offset-4 hover:underline" onClick={clearHistory} type="button">
                    {historyLabels.clearHistory}
                  </button>
                </div>
                <ul className="mt-2 divide-y" style={{ borderColor: "var(--line-soft)" }}>
                  {historyEntries.slice(0, 8).map((entry) => (
                    <li className="flex min-h-11 items-center gap-2" key={entry.id}>
                      <button
                        className="min-w-0 flex-1 truncate py-2 text-left text-[12px] text-[var(--text-primary)] underline-offset-4 hover:underline"
                        onClick={() => {
                          setInputPrefill(entry.question);
                          setDraftQuestion(entry.question);
                        }}
                        type="button"
                      >
                        {entry.question}
                      </button>
                      <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">{relativeTime(entry.timestamp)}</span>
                      {entry.confidence !== null ? (
                        <span className="shrink-0 text-[11px] text-[var(--signal)]">{Math.round(entry.confidence * 100)}%</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </aside>

    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpDown, GitBranch, Search } from "lucide-react";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { GapAnalysisModal } from "@/components/ui/gap-analysis-modal";
import { CascadeMapModal } from "@/components/ui/cascade-map-modal";
import { ExportButton } from "@/components/ui/export-button";
import { SavedSearchBar } from "@/components/ui/saved-search-bar";
import { EntityCompare } from "@/components/ui/entity-compare";
import { AnomalyBadge } from "@/components/ui/anomaly-badge";
import { useFavorites } from "@/lib/stores/favorites";
import { detectSectorRotation } from "@/lib/pipeline/sector-rotation";

type Entity = {
  id: string;
  name: string;
  score: number;
  committed: string;
  lead: number;
  confidence: number;
  sector?: string;
  signalCount?: number;
  divergence?: number;
  layers?: Record<string, number>;
  scoreHistory?: number[];
  anomaly?: { severity: "anomaly" | "critical"; zScore: number } | null;
};

type LayerStat = { layer: string; count: number; confidence: number; source: string };
type OntologyLink = { type: string; from: string; to: string; confidence: number; source: string };
type TimelineEvent = { date: string; layer: string; title: string; source: string; confidence: number };

type EvidencePathView = {
  id: string;
  title: string;
  confidence: number;
  citationCoverage: number;
  traceCompleteness: number;
  rationale: string;
  sources: Array<{ sourceId: string; title: string; url: string }>;
};

type EntityEvidenceSummary = {
  entityId: string;
  entityLabel: string;
  paths: EvidencePathView[];
  metrics: {
    citationCoverage: number;
    traceCompleteness: number;
    averageConfidence: number;
    nodeCount: number;
    edgeCount: number;
    sourceCount: number;
  };
};

type Messages = {
  entity: {
    panels: { entities: string; links: string };
    metrics: { score: string; committed: string; leadTime: string };
    timeline: string;
    filterAll: string;
    filterWatched: string;
    dailyBrief: string;
    narrativeGap: string;
    search: string;
    sortBy: string;
    sortScore: string;
    sortGap: string;
    sortConfidence: string;
    sortName: string;
    cascadeMap?: string;
    cascadeMapTitle?: string;
    lowCoverage?: string;
    cascadeClose?: string;
    evidenceGraph?: string;
    evidencePaths?: string;
    citationCoverage?: string;
    traceCompleteness?: string;
  };
  layers: string[];
};

const LAYER_COLOR: Record<string, string> = {
  Energy: "var(--text-secondary)",
  Cash: "var(--evidence)",
  Land: "var(--text-tertiary)",
  Compute: "var(--signal)",
  Water: "var(--evidence)",
  "Raw Materials": "var(--text-secondary)",
  Logistics: "var(--text-tertiary)",
  エネルギー: "var(--text-secondary)",
  資本: "var(--evidence)",
  土地: "var(--text-tertiary)",
  計算資源: "var(--signal)",
  水: "var(--evidence)",
  原材料: "var(--text-secondary)",
  物流: "var(--text-tertiary)"
};

const divider = "color-mix(in srgb, var(--text) 13%, transparent)";
const quiet = "color-mix(in srgb, var(--text) 66%, transparent)";
const faint = "color-mix(in srgb, var(--text) 46%, transparent)";

function Label({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="mono text-[11px] tracking-[0.14em]" style={{ color: faint }}>{children}</p>;
}

function ConfidenceBar({ value, label = "Confidence" }: Readonly<{ value: number; label?: string }>) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mono mb-2 flex items-center justify-between text-[11px]" style={{ color: faint }}>
        <span>{label}</span>
        <span style={{ color: "var(--evidence)" }}>{percent}%</span>
      </div>
      <div className="h-[3px] w-full" style={{ background: "color-mix(in srgb, var(--text) 14%, transparent)" }}>
        <div className="h-full transition-[width] duration-[var(--motion-state)]" style={{ width: `${percent}%`, background: "var(--evidence)" }} />
      </div>
    </div>
  );
}

function Metric({ label, value, accent = false }: Readonly<{ label: string; value: React.ReactNode; accent?: boolean }>) {
  return (
    <div className="border-l pl-3" style={{ borderColor: divider }}>
      <p className="mono text-[11px]" style={{ color: faint }}>{label}</p>
      <p className="mono mt-1 text-[16px] tabular-nums" style={{ color: accent ? "var(--signal)" : "var(--text)" }}>{value}</p>
    </div>
  );
}

function EvidenceInspector({
  entity,
  summary,
  timelineEvents,
  ontologyLinks,
  messages
}: Readonly<{
  entity: Entity;
  summary?: EntityEvidenceSummary;
  timelineEvents: TimelineEvent[];
  ontologyLinks: OntologyLink[];
  messages: Messages["entity"];
}>) {
  const paths = summary?.paths.slice(0, 3) ?? [];
  return (
    <aside className="min-w-0 bg-[var(--surface)]" aria-label="Evidence inspector">
      <div className="border-b px-5 py-4" style={{ borderColor: divider }}>
        <Label>{messages.evidenceGraph ?? "Evidence graph"}</Label>
        <p className="mt-2 text-[14px] font-medium" style={{ color: "var(--text)" }}>Source provenance</p>
        <p className="mt-1 text-[12px] leading-5" style={{ color: quiet }}>
          The selected object stays connected to the records and relationships behind it.
        </p>
      </div>
      <div className="border-b px-5 py-4" style={{ borderColor: divider }}>
        {summary ? (
          <div className="grid grid-cols-2 gap-4">
            <Metric label={messages.citationCoverage ?? "Citation coverage"} value={`${Math.round(summary.metrics.citationCoverage * 100)}%`} accent />
            <Metric label={messages.traceCompleteness ?? "Trace completeness"} value={`${Math.round(summary.metrics.traceCompleteness * 100)}%`} />
            <Metric label="Nodes" value={summary.metrics.nodeCount} />
            <Metric label="Sources" value={summary.metrics.sourceCount} />
          </div>
        ) : (
          <p className="text-[12px] leading-5" style={{ color: faint }}>No graph summary is available for this object.</p>
        )}
      </div>
      <div className="border-b px-5 py-4" style={{ borderColor: divider }}>
        <Label>{messages.evidencePaths ?? "Evidence paths"}</Label>
        <div className="mt-3">
          {paths.length ? paths.map((path, index) => (
            <div key={path.id} className="border-t py-3 first:border-t-0 first:pt-0" style={{ borderColor: divider }}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-medium leading-5" style={{ color: "var(--text)" }}>{path.title}</p>
                <span className="mono shrink-0 text-[11px]" style={{ color: index === 0 ? "var(--evidence)" : quiet }}>{Math.round(path.confidence * 100)}%</span>
              </div>
              <p className="mt-1 text-[12px] leading-5" style={{ color: quiet }}>{path.rationale}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {path.sources.slice(0, 4).map((source) => (
                  <span key={`${path.id}:${source.sourceId}`} className="mono text-[11px]" style={{ color: "var(--evidence)" }}>{source.sourceId}</span>
                ))}
              </div>
            </div>
          )) : <p className="text-[12px]" style={{ color: faint }}>No linked paths yet.</p>}
        </div>
      </div>
      <div className="px-5 py-4">
        <Label>Recent source records</Label>
        <div className="mt-3">
          {timelineEvents.slice(0, 5).map((event, index) => (
            <div key={`${event.date}-${event.title}`} className="flex gap-3 border-t py-3 first:border-t-0 first:pt-0" style={{ borderColor: divider }}>
              <span className="mono w-12 shrink-0 text-[11px]" style={{ color: faint }}>{event.date.slice(5)}</span>
              <div className="min-w-0">
                <p className="truncate text-[12px]" style={{ color: "var(--text)" }}>{event.title}</p>
                <p className="mono mt-1 truncate text-[11px]" style={{ color: index === 0 ? "var(--evidence)" : faint }}>{event.source} · {Math.round(event.confidence * 100)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {ontologyLinks.length ? (
        <div className="border-t px-5 py-4" style={{ borderColor: divider }}>
          <Label>{messages.panels.links}</Label>
          <div className="mt-3">
            {ontologyLinks.slice(0, 4).map((link) => (
              <div key={`${link.from}-${link.to}-${link.type}`} className="border-t py-3 first:border-t-0 first:pt-0" style={{ borderColor: divider }}>
                <p className="mono text-[11px]" style={{ color: "var(--evidence)" }}>{link.type} · {Math.round(link.confidence * 100)}%</p>
                <p className="mt-1 truncate text-[12px]" style={{ color: quiet }}>{link.from} <span style={{ color: "var(--signal)" }}>→</span> {link.to}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function EntityDetail({
  entity,
  timelineEvents,
  ontologyLinks,
  summary,
  messages,
  onGap,
  onBack,
  mobileTab,
  setMobileTab
}: Readonly<{
  entity: Entity;
  timelineEvents: TimelineEvent[];
  ontologyLinks: OntologyLink[];
  summary?: EntityEvidenceSummary;
  messages: Messages["entity"];
  onGap: () => void;
  onBack?: () => void;
  mobileTab?: "object" | "evidence";
  setMobileTab?: (tab: "object" | "evidence") => void;
}>) {
  const timeline = timelineEvents.slice(0, 8);
  const objectContent = (
    <div className="space-y-7 px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <Label>Selected object</Label>
          <h2 className="mt-2 text-[22px] font-medium leading-tight tracking-[-0.02em]" style={{ color: "var(--text)" }}>{entity.name}</h2>
          <p className="mt-2 text-[13px]" style={{ color: quiet }}>{entity.sector ?? "Unclassified"} · {entity.id}</p>
        </div>
        {onBack ? (
          <button type="button" onClick={onBack} className="odim-control inline-flex min-h-11 items-center gap-2 px-3 text-[12px] lg:hidden" aria-label="Back to entity list">
            <ArrowLeft size={15} /> Back to list
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-y-5 border-y py-5 sm:grid-cols-4" style={{ borderColor: divider }}>
        <Metric label={messages.metrics.score} value={entity.score} accent />
        <Metric label={messages.metrics.committed} value={entity.committed} />
        <Metric label={messages.metrics.leadTime} value={`+${entity.lead}d`} accent />
        <Metric label="Signals" value={entity.signalCount ?? timeline.length} />
      </div>

      <div className="border-l-2 pl-4" style={{ borderColor: "var(--signal)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label>{messages.narrativeGap}</Label>
            <p className="mt-2 text-[17px] leading-6" style={{ color: "var(--text)" }}>Reality is {entity.lead} days ahead of narrative confirmation.</p>
          </div>
          <button type="button" onClick={onGap} className="odim-control inline-flex min-h-11 items-center gap-2 px-3 text-[12px]" style={{ color: "var(--signal)" }}>
            Review gap <ArrowUpDown size={14} />
          </button>
        </div>
        <div className="mt-5 max-w-[480px]"><ConfidenceBar value={entity.confidence} /></div>
        {entity.divergence !== undefined ? <p className="mono mt-3 text-[11px]" style={{ color: faint }}>Divergence {Math.round(entity.divergence * 100)} · {entity.signalCount ?? 0} signals</p> : null}
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <Label>{messages.timeline}</Label>
          <span className="mono text-[11px]" style={{ color: faint }}>{timeline.length} records</span>
        </div>
        <div className="mt-3 border-l pl-4" style={{ borderColor: "color-mix(in srgb, var(--evidence) 50%, transparent)" }}>
          {timeline.map((event, index) => {
            const color = LAYER_COLOR[event.layer] ?? "var(--text-secondary)";
            return (
              <div key={`${event.date}-${event.title}`} className="relative border-t py-3 first:border-t-0 first:pt-0" style={{ borderColor: divider }}>
                <span className="absolute -left-[21px] top-4 h-2 w-2 border bg-[var(--field)]" style={{ borderColor: index === 0 ? "var(--signal)" : "var(--evidence)" }} aria-hidden="true" />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="mono text-[11px]" style={{ color: faint }}>{event.date.slice(5)}</span>
                  <span className="mono text-[11px]" style={{ color }}>{event.layer}</span>
                  <span className="mono text-[11px]" style={{ color: faint }}>{Math.round(event.confidence * 100)}%</span>
                </div>
                <p className="mt-1 text-[13px] leading-5" style={{ color: "var(--text)" }}>{event.title}</p>
                <p className="mono mt-1 text-[11px]" style={{ color: faint }}>{event.source}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t pt-5" style={{ borderColor: divider }}>
        <Label>{messages.panels.links}</Label>
        <div className="mt-3 grid gap-x-8 sm:grid-cols-2">
          {ontologyLinks.slice(0, 6).map((link) => (
            <div key={`${link.from}-${link.to}-${link.type}`} className="border-t py-3 first:border-t-0" style={{ borderColor: divider }}>
              <p className="mono text-[11px]" style={{ color: "var(--evidence)" }}>{link.type} · {Math.round(link.confidence * 100)}%</p>
              <p className="mt-1 truncate text-[12px]" style={{ color: quiet }}>{link.from} <span style={{ color: "var(--signal)" }}>→</span> {link.to}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <section className="min-w-0 bg-[var(--field)]" aria-label="Entity workspace">
      <div className="border-b px-5 py-3 lg:hidden" style={{ borderColor: divider }}>
        <div role="tablist" aria-label="Entity detail views" className="flex gap-1">
          {(["object", "evidence"] as const).map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={mobileTab === tab} onClick={() => setMobileTab?.(tab)} className="odim-control min-h-11 flex-1 px-3 text-[12px]" style={{ color: mobileTab === tab ? "var(--text)" : quiet }}>
              {tab === "object" ? "Object" : "Evidence"}
            </button>
          ))}
        </div>
      </div>
      <div className={mobileTab === "evidence" ? "hidden lg:block" : "block"}>{objectContent}</div>
      <div className="lg:hidden">{mobileTab === "evidence" ? <EvidenceInspector entity={entity} summary={summary} timelineEvents={timelineEvents} ontologyLinks={ontologyLinks} messages={messages} /> : null}</div>
    </section>
  );
}

export function EntityWorkstation({
  entities,
  layerActivity,
  ontologyLinks,
  timelineEvents,
  evidenceWorkbench,
  messages
}: Readonly<{
  entities: Entity[];
  layerActivity: LayerStat[];
  ontologyLinks: OntologyLink[];
  timelineEvents: TimelineEvent[];
  watchlistBriefs: { name: string; status: string; brief: string; source: string }[];
  evidenceWorkbench?: { entitySummaries: EntityEvidenceSummary[]; source: "fallback" | "supabase" };
  messages: Messages;
}>) {
  const favorites = useFavorites();
  const [filterTab, setFilterTab] = useState<"all" | "watched">("all");
  const [selectedId, setSelectedId] = useState(entities[0]?.id ?? "");
  const [showGapAnalysis, setShowGapAnalysis] = useState(false);
  const [cascadeEntityId, setCascadeEntityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"score" | "gap" | "confidence" | "name">("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [mobileTab, setMobileTab] = useState<"object" | "evidence">("object");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayed = useMemo(() => {
    let base = filterTab === "watched" ? entities.filter((entity) => favorites.has(entity.id)) : entities;
    const query = searchQuery.trim().toLowerCase();
    if (query) base = base.filter((entity) => entity.name.toLowerCase().includes(query) || entity.id.toLowerCase().includes(query));
    return [...base].sort((a, b) => {
      const left = sortKey === "score" ? a.score : sortKey === "gap" ? a.lead : sortKey === "confidence" ? a.confidence : a.name;
      const right = sortKey === "score" ? b.score : sortKey === "gap" ? b.lead : sortKey === "confidence" ? b.confidence : b.name;
      const comparison = typeof left === "string" && typeof right === "string" ? left.localeCompare(right) : Number(left) - Number(right);
      return sortDirection === "desc" ? -comparison : comparison;
    });
  }, [entities, favorites, filterTab, searchQuery, sortKey, sortDirection]);

  const selected = displayed.find((entity) => entity.id === selectedId) ?? displayed[0];
  const selectedEvidence = selected ? evidenceWorkbench?.entitySummaries.find((summary) => summary.entityId === selected.id || summary.entityLabel === selected.name) : undefined;
  const sectorRotations = useMemo(() => detectSectorRotation(displayed), [displayed]);
  const compareEntities = useMemo(
    () => displayed
      .filter((entity) => compareIds.includes(entity.id))
      .map((entity) => ({
        ...entity,
        divergence: entity.divergence ?? 0,
        signalCount: entity.signalCount ?? 0,
        layers: entity.layers ?? {}
      })),
    [compareIds, displayed]
  );
  const maxLayerCount = Math.max(1, ...layerActivity.map((layer) => layer.count));

  function selectEntity(id: string) {
    setSelectedId(id);
    setMobileView("detail");
    setMobileTab("object");
  }

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDirection((direction) => direction === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDirection("desc"); }
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= 4 ? [...current.slice(1), id] : [...current, id]);
  }

  useEffect(() => {
    if (!displayed.length) {
      setSelectedId("");
      setMobileView("list");
    }
    else if (!displayed.some((entity) => entity.id === selectedId)) setSelectedId(displayed[0].id);
  }, [displayed, selectedId]);

  useEffect(() => {
    function onListNav(event: Event) {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (!displayed.length) return;
      const index = Math.max(0, displayed.findIndex((entity) => entity.id === selectedId));
      if (key === "j" || key === "n") selectEntity(displayed[Math.min(displayed.length - 1, index + 1)].id);
      if (key === "k" || key === "p") selectEntity(displayed[Math.max(0, index - 1)].id);
    }
    function onListOpen() { if (selectedId) setShowGapAnalysis(true); }
    function onFocusSearch() { searchInputRef.current?.focus(); }
    function onEscape() { setShowGapAnalysis(false); setCascadeEntityId(null); setCompareMode(false); }
    window.addEventListener("odim:list-nav", onListNav as EventListener);
    window.addEventListener("odim:list-open", onListOpen);
    window.addEventListener("odim:focus-search", onFocusSearch);
    window.addEventListener("odim:list-escape", onEscape);
    return () => {
      window.removeEventListener("odim:list-nav", onListNav as EventListener);
      window.removeEventListener("odim:list-open", onListOpen);
      window.removeEventListener("odim:focus-search", onFocusSearch);
      window.removeEventListener("odim:list-escape", onEscape);
    };
  }, [displayed, selectedId]);

  const listContent = (
    <aside className="min-w-0 bg-[var(--surface)]" aria-label="Entity index">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-4" style={{ borderColor: divider }}>
        <div><Label>Entity index</Label><p className="mt-1 text-[14px] font-medium" style={{ color: "var(--text)" }}>{displayed.length} objects</p></div>
        <div className="flex items-center gap-1"><ExportButton type="entities" /><button type="button" className={`odim-control inline-flex min-h-11 items-center gap-2 px-2.5 text-[11px] ${compareMode ? "border-[var(--signal)]" : ""}`} aria-pressed={compareMode} onClick={() => setCompareMode((value) => !value)}><GitBranch size={14} /> Compare</button></div>
      </div>
      <div className="border-b px-4 py-3" style={{ borderColor: divider }}>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: faint }} />
          <input ref={searchInputRef} type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={messages.entity.search} className="min-h-11 w-full rounded-[4px] border pl-9 pr-3 text-[13px] outline-none transition-colors duration-[var(--motion-micro)] focus:border-[var(--signal)]" style={{ borderColor: divider, background: "var(--field)", color: "var(--text)" }} />
        </div>
        <SavedSearchBar type="entity" currentQuery={searchQuery} currentFilters={{ sortKey, sortDirection, filterTab }} onApply={(entry) => { setSearchQuery(entry.query); setSortKey((entry.filters.sortKey as typeof sortKey) ?? "score"); setSortDirection((entry.filters.sortDirection as typeof sortDirection) ?? "desc"); setFilterTab((entry.filters.filterTab as typeof filterTab) ?? "all"); }} />
      </div>
      <div className="flex items-center border-b px-4" style={{ borderColor: divider }} role="tablist" aria-label="Entity filters">
        {(["all", "watched"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={filterTab === tab} onClick={() => setFilterTab(tab)} className="min-h-11 border-b-2 px-3 text-[12px] transition-colors duration-[var(--motion-micro)]" style={{ borderColor: filterTab === tab ? "var(--signal)" : "transparent", color: filterTab === tab ? "var(--text)" : quiet }}>{tab === "all" ? messages.entity.filterAll : messages.entity.filterWatched}</button>)}
      </div>
      <div className="flex flex-wrap gap-1 border-b px-4 py-2" style={{ borderColor: divider }}>
        {(["score", "gap", "confidence", "name"] as const).map((key) => <button key={key} type="button" onClick={() => toggleSort(key)} className="odim-control min-h-11 px-2 text-[11px]" aria-label={`Sort by ${key}`} aria-pressed={sortKey === key}>{key === "score" ? messages.entity.sortScore : key === "gap" ? messages.entity.sortGap : key === "confidence" ? messages.entity.sortConfidence : messages.entity.sortName}{sortKey === key ? (sortDirection === "desc" ? " ↓" : " ↑") : ""}</button>)}
      </div>
      {displayed.length === 0 ? (
        <div className="px-5 py-12" role="status"><p className="text-[14px]" style={{ color: "var(--text)" }}>No entities match this view.</p><button type="button" onClick={() => { setSearchQuery(""); setFilterTab("all"); }} className="mt-4 min-h-11 text-[12px] underline underline-offset-4" style={{ color: "var(--signal)" }}>Reset filters</button></div>
      ) : (
        <div>
          {displayed.map((entity) => {
            const selectedRow = selectedId === entity.id;
            const compared = compareIds.includes(entity.id);
            return <div key={entity.id} className="border-b transition-[background-color,border-color] duration-[var(--motion-state)]" style={{ borderColor: divider, background: selectedRow ? "var(--signal-wash)" : "transparent", borderLeft: selectedRow ? "2px solid var(--signal)" : "2px solid transparent" }}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setCascadeEntityId(entity.id)} aria-label={`${messages.entity.cascadeMap ?? "Open cascade map"}: ${entity.name}`} className="odim-icon-control odim-control h-11 w-11 shrink-0"><GitBranch size={15} /></button>
                <button type="button" onClick={() => selectEntity(entity.id)} className="min-w-0 flex-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" aria-current={selectedRow ? "true" : undefined}>
                  <span className="block truncate text-[13px] font-medium" style={{ color: selectedRow ? "var(--text)" : quiet }}>{entity.name}</span>
                  <span className="mono mt-1 flex items-center gap-2 text-[11px]" style={{ color: faint }}><span style={{ color: selectedRow ? "var(--signal)" : faint }}>{entity.score}</span><span>·</span><span>{Math.round(entity.confidence * 100)}%</span>{entity.divergence !== undefined ? <><span>·</span><span>D{Math.round(entity.divergence * 100)}</span></> : null}{entity.anomaly ? <AnomalyBadge severity={entity.anomaly.severity} zScore={entity.anomaly.zScore} /> : null}</span>
                </button>
                {compareMode ? <button type="button" onClick={() => toggleCompare(entity.id)} aria-pressed={compared} className="odim-control h-11 w-11 shrink-0 text-[12px]" style={{ color: compared ? "var(--signal)" : quiet }}>{compared ? "✓" : "+"}</button> : null}
                <FavoriteButton id={entity.id} category="entity" label={entity.name} size={15} />
              </div>
            </div>;
          })}
        </div>
      )}
    </aside>
  );

  const detailContent = selected ? (
    compareMode ? (
      <div>
        <button type="button" onClick={() => setMobileView("list")} className="odim-control mx-5 mt-4 inline-flex min-h-11 items-center gap-2 px-3 text-[12px] lg:hidden" aria-label="Back to entity list"><ArrowLeft size={15} /> Back to list</button>
        <EntityCompare entities={compareEntities} onRemove={toggleCompare} />
      </div>
    ) : <EntityDetail entity={selected} timelineEvents={timelineEvents} ontologyLinks={ontologyLinks} summary={selectedEvidence} messages={messages.entity} onGap={() => setShowGapAnalysis(true)} onBack={() => setMobileView("list")} mobileTab={mobileTab} setMobileTab={setMobileTab} />
  ) : <div className="p-6 text-[14px]" style={{ color: quiet }}>Select an entity to inspect.</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 border-y px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5" style={{ borderColor: divider, background: "var(--field)" }}>
        <div><Label>Entity intelligence</Label><p className="mt-1 text-[13px]" style={{ color: quiet }}>Search an object, verify its path, then decide what to retain.</p></div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]" style={{ color: faint }}><span>{entities.length} indexed</span><span>{layerActivity.reduce((total, layer) => total + layer.count, 0)} source records</span>{evidenceWorkbench ? <span style={{ color: evidenceWorkbench.source === "supabase" ? "var(--evidence)" : faint }}>{evidenceWorkbench.source === "supabase" ? "Graph synced" : "Fixture graph"}</span> : null}</div>
      </div>
      {sectorRotations.length ? <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 pb-3 text-[12px] sm:px-5" style={{ borderColor: divider }}><Label>Sector movement</Label>{sectorRotations.slice(0, 3).map((rotation) => <span key={`${rotation.fromSector}-${rotation.toSector}`} style={{ color: quiet }}>{rotation.fromSector} <span style={{ color: "var(--signal)" }}>→</span> {rotation.toSector} <span className="mono ml-1 text-[11px]" style={{ color: "var(--evidence)" }}>Δ{rotation.magnitude}</span></span>)}</div> : null}
      <div className="border-y" style={{ borderColor: divider }}>
        <div className="hidden min-h-[620px] lg:grid lg:grid-cols-[280px_minmax(0,1fr)_340px]">
          <div className="border-r" style={{ borderColor: divider }}>{listContent}</div>
          <div className="min-w-0">{detailContent}</div>
          {selected ? <div className="border-l" style={{ borderColor: divider }}><EvidenceInspector entity={selected} summary={selectedEvidence} timelineEvents={timelineEvents} ontologyLinks={ontologyLinks} messages={messages.entity} /></div> : null}
        </div>
        <div className="lg:hidden">
          {mobileView === "list" ? listContent : detailContent}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[11px]" style={{ color: faint }}>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2" style={{ background: "var(--evidence)" }} />Evidence path visible</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2" style={{ background: "var(--signal)" }} />Selected object</span>
        <span className="ml-auto">Layer activity: {layerActivity.slice(0, 4).map((layer, index) => <span key={layer.layer} className="mono ml-2" style={{ color: index === 0 ? "var(--evidence)" : quiet }}>{messages.layers[index] ?? layer.layer} {Math.round((layer.count / maxLayerCount) * 100)}%</span>)}</span>
      </div>
      {showGapAnalysis && selected ? <GapAnalysisModal entity={selected} timelineEvents={timelineEvents} ontologyLinks={ontologyLinks} onClose={() => setShowGapAnalysis(false)} /> : null}
      <CascadeMapModal open={Boolean(cascadeEntityId)} entityId={cascadeEntityId} onClose={() => setCascadeEntityId(null)} messages={{ cascadeMapTitle: messages.entity.cascadeMapTitle ?? "3-Level Cascade Map", cascadeClose: messages.entity.cascadeClose ?? "Close", lowCoverage: messages.entity.lowCoverage ?? "Low coverage", loading: "Loading…", errorRetry: "Retry" }} />
    </div>
  );
}

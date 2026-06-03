"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Confidence } from "@/components/ui/confidence";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { GapAnalysisModal } from "@/components/ui/gap-analysis-modal";
import { CascadeMapModal } from "@/components/ui/cascade-map-modal";
import { Sparkline } from "@/components/ui/sparkline";
import { ExportButton } from "@/components/ui/export-button";
import { SavedSearchBar } from "@/components/ui/saved-search-bar";
import { EntityCompare } from "@/components/ui/entity-compare";
import { AnomalyBadge } from "@/components/ui/anomaly-badge";
import { useFavorites } from "@/lib/stores/favorites";
import { detectSectorRotation } from "@/lib/pipeline/sector-rotation";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type LayerStat = {
  layer: string;
  count: number;
  confidence: number;
  source: string;
};

type OntologyLink = {
  type: string;
  from: string;
  to: string;
  confidence: number;
  source: string;
};

type TimelineEvent = {
  date: string;
  layer: string;
  title: string;
  source: string;
  confidence: number;
};

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

// ─── Layer color map (label → CSS token) ────────────────────────────────────

const LAYER_COLOR: Record<string, string> = {
  Energy:       "var(--layer-energy)",
  Cash:         "var(--layer-cash)",
  Land:         "var(--layer-land)",
  Compute:      "var(--layer-compute)",
  Water:        "var(--layer-water)",
  "Raw Materials": "var(--layer-material)",
  Logistics:    "var(--layer-logistics)",
  // Japanese labels
  エネルギー:    "var(--layer-energy)",
  資本:          "var(--layer-cash)",
  土地:          "var(--layer-land)",
  計算資源:      "var(--layer-compute)",
  水:            "var(--layer-water)",
  原材料:        "var(--layer-material)",
  物流:          "var(--layer-logistics)"
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="mono text-[10px] font-medium uppercase tracking-[0.14em]"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--line-faint)" }} />;
}

function MetricPill({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div
      className="mono rounded-[var(--radius-xs)] px-2 py-1 text-[9px] uppercase tracking-[0.08em]"
      style={{ background: "var(--ink-850)", border: "1px solid var(--line-faint)", color: "var(--text-tertiary)" }}
    >
      {label}
      <span className="ml-1.5 tabular-nums" style={{ color: "var(--rune)" }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function EvidenceGraphSummary({
  summary,
  labels
}: Readonly<{
  summary?: EntityEvidenceSummary;
  labels: {
    title: string;
    paths: string;
    citation: string;
    trace: string;
  };
}>) {
  if (!summary) return null;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>{labels.title}</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          <MetricPill label={labels.citation} value={summary.metrics.citationCoverage} />
          <MetricPill label={labels.trace} value={summary.metrics.traceCompleteness} />
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {summary.paths.slice(0, 3).map((path) => (
          <div
            key={path.id}
            className="rounded-[var(--radius-sm)] px-3 py-2.5"
            style={{ background: "var(--ink-850)", border: "1px solid var(--line-faint)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {path.title}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {path.rationale}
                </div>
              </div>
              <div className="mono shrink-0 text-[10px] tabular-nums" style={{ color: "var(--rune)" }}>
                {Math.round(path.confidence * 100)}%
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>
                {labels.paths}
              </span>
              {path.sources.slice(0, 4).map((source) => (
                <span
                  key={`${path.id}:${source.sourceId}`}
                  className="mono max-w-[160px] truncate rounded-[3px] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.06em]"
                  style={{ background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.14)", color: "var(--rune-dim)" }}
                >
                  {source.sourceId}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  evidenceWorkbench?: {
    entitySummaries: EntityEvidenceSummary[];
    source: "fallback" | "supabase";
  };
  messages: Messages;
}>) {
  const favorites = useFavorites();
  const [filterTab, setFilterTab] = useState<"all" | "watched">("all");
  const [selectedId, setSelectedId] = useState<string>(entities[0]?.id ?? "");
  const [showGapAnalysis, setShowGapAnalysis] = useState(false);
  const [cascadeEntityId, setCascadeEntityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"score" | "gap" | "confidence" | "name">("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayed = useMemo(() => {
    let base =
      filterTab === "watched"
        ? entities.filter((e) => favorites.has(e.id))
        : entities;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      base = base.filter((e) => e.name.toLowerCase().includes(q));
    }

    return [...base].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "score") cmp = a.score - b.score;
      else if (sortKey === "gap") cmp = a.lead - b.lead;
      else if (sortKey === "confidence") cmp = a.confidence - b.confidence;
      else if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      return sortDirection === "desc" ? -cmp : cmp;
    });
  }, [entities, filterTab, favorites, searchQuery, sortKey, sortDirection]);

  const sectorRotations = useMemo(() => detectSectorRotation(displayed), [displayed]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  }

  function toggleCompare(entityId: string) {
    setCompareIds((current) => {
      if (current.includes(entityId)) return current.filter((id) => id !== entityId);
      if (current.length >= 4) return [...current.slice(1), entityId];
      return [...current, entityId];
    });
  }

  useEffect(() => {
    if (!displayed.length) {
      setSelectedId("");
      return;
    }
    if (!displayed.some((entity) => entity.id === selectedId)) {
      setSelectedId(displayed[0].id);
    }
  }, [displayed, selectedId]);

  useEffect(() => {
    function onListNav(event: Event) {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      const currentIndex = Math.max(0, displayed.findIndex((entity) => entity.id === selectedId));
      if (!displayed.length) return;
      if (detail?.key === "j" || detail?.key === "n") {
        setSelectedId(displayed[Math.min(displayed.length - 1, currentIndex + 1)].id);
      }
      if (detail?.key === "k" || detail?.key === "p") {
        setSelectedId(displayed[Math.max(0, currentIndex - 1)].id);
      }
    }

    function onListOpen() {
      if (selectedId) setShowGapAnalysis(true);
    }

    function onEscape() {
      setShowGapAnalysis(false);
      setCascadeEntityId(null);
      setCompareMode(false);
    }

    function onFocusSearch() {
      searchInputRef.current?.focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "c") {
        event.preventDefault();
        setCompareMode((current) => !current);
      }
      if (event.key === " ") {
        event.preventDefault();
        if (selectedId) toggleCompare(selectedId);
      }
    }

    window.addEventListener("odim:list-nav", onListNav as EventListener);
    window.addEventListener("odim:list-open", onListOpen);
    window.addEventListener("odim:list-escape", onEscape);
    window.addEventListener("odim:focus-search", onFocusSearch);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("odim:list-nav", onListNav as EventListener);
      window.removeEventListener("odim:list-open", onListOpen);
      window.removeEventListener("odim:list-escape", onEscape);
      window.removeEventListener("odim:focus-search", onFocusSearch);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [displayed, selectedId]);

  const selected = entities.find((e) => e.id === selectedId) ?? entities[0];
  const selectedEvidence = selected
    ? evidenceWorkbench?.entitySummaries.find((summary) => summary.entityId === selected.id || summary.entityLabel === selected.name)
    : undefined;

  // Normalise layer counts for the activity bar widths
  const maxCount = Math.max(1, ...layerActivity.map((l) => l.count));

  return (
    <div className="flex flex-col gap-4">
      <SavedSearchBar
        type="entity"
        currentQuery={searchQuery}
        currentFilters={{ sortKey, sortDirection, filterTab }}
        onApply={(entry) => {
          setSearchQuery(entry.query);
          setSortKey((entry.filters.sortKey as typeof sortKey) ?? "score");
          setSortDirection((entry.filters.sortDirection as typeof sortDirection) ?? "desc");
          setFilterTab((entry.filters.filterTab as typeof filterTab) ?? "all");
        }}
      />

      {sectorRotations.length ? (
        <div
          className="rounded-[var(--radius-md)] px-4 py-3"
          style={{ background: "var(--ink-850)", border: "1px solid var(--line-faint)", boxShadow: "var(--shadow-inset)" }}
        >
          <div className="mb-2 flex items-baseline gap-2">
            <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
              Sector Rotation
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>
              — capital moving between sectors (score delta)
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {sectorRotations.slice(0, 4).map((rotation) => (
              <div key={`${rotation.fromSector}-${rotation.toSector}`} className="rounded-[var(--radius-sm)] px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--line-faint)" }}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] leading-tight" style={{ color: "var(--text-primary)" }}>
                    <span style={{ color: "var(--text-tertiary)" }}>{rotation.fromSector}</span>
                    <span className="mx-1.5 text-[10px]" style={{ color: "var(--text-quaternary)" }}>→</span>
                    <span>{rotation.toSector}</span>
                  </span>
                  <span
                    className="mono shrink-0 tabular-nums"
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--rune)", lineHeight: 1.2 }}
                  >
                    Δ{rotation.magnitude}
                  </span>
                </div>
                <div className="mono mt-1.5 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>
                  {Math.round(rotation.confidence * 100)}% conf.
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Layer Activity Strip ──────────────────────────────────────── */}
      <div
        className="rounded-[var(--radius-md)] px-4 py-3"
        style={{
          background: "var(--ink-850)",
          border: "1px solid var(--line-faint)",
          boxShadow: "var(--shadow-inset)"
        }}
      >
        <div className="mb-2.5">
          <SectionLabel>Signal Activity by Layer</SectionLabel>
        </div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-2.5 sm:grid-cols-7">
          {layerActivity.map((layer, i) => {
            const label = messages.layers[i] ?? layer.layer;
            const color = LAYER_COLOR[label] ?? LAYER_COLOR[layer.layer] ?? "var(--rune)";
            const barWidth = Math.round((layer.count / maxCount) * 100);
            return (
              <div key={layer.layer} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-1">
                  <span
                    className="mono text-[9px] uppercase tracking-[0.1em] truncate"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {label}
                  </span>
                  <span
                    className="mono text-[13px] font-medium shrink-0"
                    style={{ color }}
                  >
                    {layer.count}
                  </span>
                </div>
                <div
                  className="h-[3px] overflow-hidden rounded-full"
                  style={{ background: "var(--ink-700)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${barWidth}%`,
                      background: color,
                      opacity: 0.85,
                      animation: "bar-fill 600ms var(--ease-out-expo) both"
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main 2-column layout ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[224px_1fr]">

        {/* ── Entity List ─────────────────────────────────────────────── */}
        <div
          className="rounded-[var(--radius-lg)]"
          style={{
            background: "var(--ink-800)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow-inset), var(--shadow-sm)",
            backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.016) 0%, transparent 64px)"
          }}
        >
          {/* Row 1: title + export */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--line-faint)" }}
          >
            <span
              className="mono text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: "var(--text-secondary)" }}
            >
              {messages.entity.panels.entities}
            </span>
            <ExportButton type="entities" />
          </div>

          {/* Row 2: filter tabs + compare toggle */}
          <div
            className="flex items-center justify-between px-3 py-1.5"
            style={{ borderBottom: "1px solid var(--line-faint)" }}
          >
            <div
              className="flex rounded-[var(--radius-xs)] p-0.5"
              style={{ background: "var(--ink-750)", border: "1px solid var(--line-faint)" }}
            >
              {(["all", "watched"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className="mono rounded-[2px] px-2.5 py-0.5 text-[9px] uppercase tracking-[0.1em] transition-all duration-[var(--dur-fast)]"
                  style={{
                    background: filterTab === tab ? "var(--ink-600)" : "transparent",
                    color: filterTab === tab ? "var(--text-primary)" : "var(--text-quaternary)",
                    border: filterTab === tab ? "1px solid var(--line-soft)" : "1px solid transparent"
                  }}
                >
                  {tab === "all" ? messages.entity.filterAll : messages.entity.filterWatched}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCompareMode((current) => !current)}
              className="mono flex items-center gap-1 rounded px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] transition-all duration-[var(--dur-fast)]"
              style={{
                background: compareMode ? "var(--rune-wash)" : "transparent",
                border: `1px solid ${compareMode ? "rgba(201,169,97,0.25)" : "var(--line-faint)"}`,
                color: compareMode ? "var(--rune)" : "var(--text-tertiary)"
              }}
            >
              {compareMode ? (
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <rect x="0.5" y="0.5" width="3.5" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
                  <rect x="5" y="0.5" width="3.5" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              ) : (
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <rect x="0.5" y="2" width="3.5" height="6.5" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
                  <rect x="5" y="0.5" width="3.5" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              )}
              Cmp
            </button>
          </div>

          {/* Search bar */}
          <div className="relative px-3 py-2" style={{ borderBottom: "1px solid var(--line-faint)" }}>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={messages.entity.search}
              className="w-full rounded-[var(--radius-sm)] px-2.5 py-1.5 pr-8 text-[12px] outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--line-faint)",
                color: "var(--text-primary)",
              }}
            />
            <span
              className="mono pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 rounded px-1 text-[9px]"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-quaternary)" }}
            >
              /
            </span>
          </div>

          {/* Sort controls — no "Sort by" label */}
          <div
            className="flex items-center gap-0.5 overflow-x-auto px-3 py-1.5"
            style={{ borderBottom: "1px solid var(--line-faint)" }}
          >
            {(
              [
                ["score", messages.entity.sortScore],
                ["gap", messages.entity.sortGap],
                ["confidence", messages.entity.sortConfidence],
                ["name", messages.entity.sortName],
              ] as const
            ).map(([key, label]) => {
              const active = sortKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSort(key)}
                  className="mono shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] transition-colors duration-[var(--dur-fast)]"
                  style={{
                    background: active ? "var(--rune-wash)" : "transparent",
                    color: active ? "var(--rune)" : "var(--text-tertiary)",
                    border: active ? "1px solid rgba(201,169,97,0.2)" : "1px solid transparent",
                  }}
                >
                  {label}
                  {active && (
                    <span className="ml-0.5 opacity-80">{sortDirection === "desc" ? "↓" : "↑"}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Entity rows */}
          <div className="px-0">
            {displayed.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text-quaternary)" }}>
                  No entities match filters
                </div>
              </div>
            ) : (
              displayed.map((entity) => {
                const isSelected = selectedId === entity.id;
                const compared = compareIds.includes(entity.id);
                return (
                  <div
                    key={entity.id}
                    className="w-full"
                    style={{
                      borderBottom: "1px solid var(--line-faint)",
                      borderLeft: isSelected ? "2px solid var(--rune)" : "2px solid transparent",
                      background: isSelected ? "rgba(201,169,97,0.05)" : "transparent",
                      transition: "background 120ms, border-color 120ms"
                    }}
                  >
                    <div className="flex items-center gap-1.5 px-3 py-2.5"
                      style={{ paddingLeft: isSelected ? "calc(0.75rem)" : "calc(0.75rem + 2px)" }}>
                      {/* Cascade map button */}
                      <button
                        type="button"
                        aria-label={messages.entity.cascadeMap ?? "Cascade"}
                        onClick={() => setCascadeEntityId(entity.id)}
                        className="shrink-0 flex h-5 w-5 items-center justify-center rounded transition-colors hover:text-[var(--rune)]"
                        style={{ color: "var(--text-quaternary)" }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.1" />
                          <line x1="5" y1="2" x2="5" y2="8" stroke="currentColor" strokeWidth="1.1" />
                          <line x1="2" y1="5" x2="8" y2="5" stroke="currentColor" strokeWidth="1.1" />
                        </svg>
                      </button>

                      {/* Main content */}
                      <button
                        type="button"
                        onClick={() => setSelectedId(entity.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        {/* Name + score on one line */}
                        <div className="flex items-baseline justify-between gap-1.5">
                          <span
                            className="truncate text-[12px] font-medium leading-tight"
                            style={{ color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}
                          >
                            {entity.name}
                          </span>
                          <span
                            className="mono shrink-0 tabular-nums text-[11px] font-semibold"
                            style={{ color: isSelected ? "var(--rune)" : "var(--text-tertiary)" }}
                          >
                            {entity.score}
                          </span>
                        </div>
                        {/* Meta row */}
                        <div className="mono mt-1 flex items-center gap-1.5 text-[9px]">
                          <span
                            className="tabular-nums"
                            style={{ color: isSelected ? "var(--rune-dim)" : "var(--text-quaternary)" }}
                          >
                            {Math.round(entity.confidence * 100)}%
                          </span>
                          {entity.divergence !== undefined && (
                            <>
                              <span style={{ opacity: 0.3 }}>·</span>
                              <span className="tabular-nums" style={{ color: "var(--text-quaternary)" }}>
                                D{Math.round(entity.divergence * 100)}
                              </span>
                            </>
                          )}
                          <span style={{ opacity: 0.3 }}>·</span>
                          <Sparkline data={entity.scoreHistory ?? [entity.score - 4, entity.score - 2, entity.score + 1, entity.score]} width={48} height={14} />
                          {entity.anomaly ? <AnomalyBadge severity={entity.anomaly.severity} zScore={entity.anomaly.zScore} /> : null}
                        </div>
                      </button>

                      {/* Actions */}
                      {compareMode && (
                        <button
                          type="button"
                          onClick={() => toggleCompare(entity.id)}
                          className="mono shrink-0 rounded px-1 py-0.5 text-[8px] uppercase tracking-[0.08em] transition-all"
                          style={{
                            background: compared ? "var(--rune-wash)" : "transparent",
                            border: `1px solid ${compared ? "rgba(201,169,97,0.3)" : "var(--line-faint)"}`,
                            color: compared ? "var(--rune)" : "var(--text-quaternary)"
                          }}
                        >
                          {compared ? "✓" : "+"}
                        </button>
                      )}
                      <FavoriteButton id={entity.id} category="entity" label={entity.name} size={12} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Entity Detail ────────────────────────────────────────────── */}
        {compareMode ? (
          <EntityCompare
            entities={displayed
              .filter((entity) => compareIds.includes(entity.id))
              .map((entity) => ({
                ...entity,
                divergence: entity.divergence ?? 0,
                signalCount: entity.signalCount ?? 0,
                layers: entity.layers ?? {}
              }))}
            onRemove={(id) => toggleCompare(id)}
          />
        ) : selected ? (
          <div
            className="overflow-hidden rounded-[var(--radius-lg)]"
            style={{
              background: "var(--ink-800)",
              border: "1px solid var(--line-strong)",
              boxShadow: "var(--shadow-inset), var(--shadow-md), var(--shadow-glow)",
              backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.016) 0%, transparent 64px)"
            }}
          >
            {/* Detail header */}
            <div
              className="flex items-start justify-between gap-4 px-5 py-4"
              style={{ borderBottom: "1px solid var(--line-soft)" }}
            >
              <div className="min-w-0">
                <h2
                  className="text-[15px] font-semibold leading-tight truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {selected.name}
                </h2>
                <div className="mono mt-1 flex items-center gap-3 text-[11px]">
                  <span style={{ color: "var(--text-secondary)" }}>
                    {messages.entity.metrics.committed}
                    <span
                      className="ml-1.5 font-medium"
                      style={{ color: "var(--rune)" }}
                    >
                      {selected.committed}
                    </span>
                  </span>
                  <span style={{ color: "var(--line-vivid)" }}>·</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {messages.entity.metrics.score}
                    <span
                      className="ml-1.5 font-medium"
                      style={{ color: "var(--rune)" }}
                    >
                      {selected.score}
                    </span>
                  </span>
                </div>
              </div>
              <FavoriteButton id={selected.id} category="entity" label={selected.name} size={15} />
            </div>

            <div className="px-5 py-4 flex flex-col gap-5">

              {/* ── Narrative–Reality Gap (hero) ───────────────────────── */}
              <div
                className="rounded-[var(--radius-md)] p-4"
                style={{
                  background: "linear-gradient(135deg, rgba(201,169,97,0.08) 0%, rgba(201,169,97,0.03) 100%)",
                  border: "1px solid rgba(201,169,97,0.14)",
                  boxShadow: "var(--shadow-inset)"
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel>{messages.entity.narrativeGap}</SectionLabel>
                  <button
                    type="button"
                    onClick={() => setShowGapAnalysis(true)}
                    className="mono flex items-center gap-1 rounded px-2 py-1 text-[9px] uppercase tracking-[0.1em] transition-colors duration-[var(--dur-fast)] hover:brightness-110"
                    style={{
                      background: "rgba(201,169,97,0.1)",
                      border: "1px solid rgba(201,169,97,0.22)",
                      color: "var(--rune)"
                    }}
                  >
                    Evidence
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4h6M5 2l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <span
                    className="mono text-3xl font-semibold leading-none"
                    style={{
                      color: "var(--rune)",
                      textShadow: "0 0 18px rgba(201,169,97,0.25)"
                    }}
                  >
                    +{selected.lead}d
                  </span>
                  <span
                    className="pb-0.5 text-[12px] leading-tight"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    ahead of narrative confirmation
                  </span>
                </div>
                <div className="mt-4">
                  <Confidence value={selected.confidence} />
                </div>
                {selected.divergence !== undefined ? (
                  <div className="mono mt-3 text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
                    Divergence {Math.round(selected.divergence * 100)} / Signals {selected.signalCount ?? 0}
                  </div>
                ) : null}
              </div>

              <Divider />

              <EvidenceGraphSummary
                summary={selectedEvidence}
                labels={{
                  title: messages.entity.evidenceGraph ?? "Evidence Graph",
                  paths: messages.entity.evidencePaths ?? "paths",
                  citation: messages.entity.citationCoverage ?? "citation",
                  trace: messages.entity.traceCompleteness ?? "trace"
                }}
              />

              {selectedEvidence ? <Divider /> : null}

              {/* ── Capital Commitment Timeline ─────────────────────────── */}
              <div>
                <SectionLabel>{messages.entity.timeline}</SectionLabel>
                <div className="mt-3 flex flex-col">
                  {timelineEvents.slice(0, 6).map((event, i) => {
                    const color = LAYER_COLOR[event.layer] ?? "var(--rune-dim)";
                    return (
                      <div
                        key={`${event.date}-${event.title}`}
                        className="grid items-baseline gap-x-3 py-2.5 text-[12px]"
                        style={{
                          gridTemplateColumns: "72px 1fr auto",
                          borderTop: i > 0 ? "1px solid var(--line-faint)" : "none"
                        }}
                      >
                        <span
                          className="mono text-[10px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {event.date.slice(5)}
                        </span>
                        <span className="flex items-center gap-2 truncate">
                          <span
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: color }}
                          />
                          <span className="truncate" style={{ color: "var(--text-primary)" }}>
                            {event.title}
                          </span>
                        </span>
                        <span
                          className="mono shrink-0 text-[10px] font-medium"
                          style={{ color }}
                        >
                          {Math.round(event.confidence * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Divider />

              {/* ── Ontology Connections ────────────────────────────────── */}
              <div>
                <SectionLabel>{messages.entity.panels.links}</SectionLabel>
                <div className="mt-3 flex flex-col">
                  {ontologyLinks.slice(0, 5).map((link, i) => (
                    <div
                      key={`${link.from}-${link.to}-${link.type}`}
                      className="py-2"
                      style={{ borderTop: i > 0 ? "1px solid var(--line-faint)" : "none" }}
                    >
                      {/* Relationship label row */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="mono shrink-0 rounded-[3px] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em]"
                            style={{
                              background: "rgba(201,169,97,0.08)",
                              border: "1px solid rgba(201,169,97,0.15)",
                              color: "var(--rune-dim)"
                            }}
                          >
                            {link.type}
                          </span>
                          <span className="mono text-[10px] tabular-nums" style={{ color: "var(--text-quaternary)" }}>
                            {Math.round(link.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      {/* From → To */}
                      <div className="flex items-baseline gap-1 text-[11px]">
                        <span className="truncate font-medium" style={{ color: "var(--text-secondary)" }}>{link.from}</span>
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="shrink-0 opacity-40">
                          <path d="M0 4h10M7 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="truncate" style={{ color: "var(--text-tertiary)" }}>{link.to}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        ) : null}
      </div>

      {showGapAnalysis && selected && (
        <GapAnalysisModal
          entity={selected}
          timelineEvents={timelineEvents}
          ontologyLinks={ontologyLinks}
          onClose={() => setShowGapAnalysis(false)}
        />
      )}

      <CascadeMapModal
        open={!!cascadeEntityId}
        entityId={cascadeEntityId}
        onClose={() => setCascadeEntityId(null)}
        messages={{
          cascadeMapTitle: messages.entity.cascadeMapTitle ?? "3-Level Cascade Map",
          cascadeClose: messages.entity.cascadeClose ?? "Close",
          lowCoverage: messages.entity.lowCoverage ?? "Low Cov.",
          loading: "Loading…",
          errorRetry: "Retry"
        }}
      />
    </div>
  );
}

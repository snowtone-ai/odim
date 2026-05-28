"use client";

import { useState } from "react";
import { Confidence } from "@/components/ui/confidence";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { GapAnalysisModal } from "@/components/ui/gap-analysis-modal";
import { useFavorites } from "@/lib/stores/favorites";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entity = {
  id: string;
  name: string;
  score: number;
  committed: string;
  lead: number;
  confidence: number;
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

type Messages = {
  entity: {
    panels: { entities: string; links: string };
    metrics: { score: string; committed: string; leadTime: string };
    timeline: string;
    filterAll: string;
    filterWatched: string;
    dailyBrief: string;
    narrativeGap: string;
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

// ─── Main component ───────────────────────────────────────────────────────────

export function EntityWorkstation({
  entities,
  layerActivity,
  ontologyLinks,
  timelineEvents,
  messages
}: Readonly<{
  entities: Entity[];
  layerActivity: LayerStat[];
  ontologyLinks: OntologyLink[];
  timelineEvents: TimelineEvent[];
  watchlistBriefs: { name: string; status: string; brief: string; source: string }[];
  messages: Messages;
}>) {
  const favorites = useFavorites();
  const [filterTab, setFilterTab] = useState<"all" | "watched">("all");
  const [selectedId, setSelectedId] = useState<string>(entities[0]?.id ?? "");
  const [showGapAnalysis, setShowGapAnalysis] = useState(false);

  const displayed =
    filterTab === "watched"
      ? entities.filter((e) => favorites.has(e.id))
      : entities;

  const selected = entities.find((e) => e.id === selectedId) ?? entities[0];

  // Normalise layer counts for the activity bar widths
  const maxCount = Math.max(1, ...layerActivity.map((l) => l.count));

  return (
    <div className="flex flex-col gap-4">

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
                  className="h-[2px] overflow-hidden rounded-full"
                  style={{ background: "var(--ink-700)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${barWidth}%`,
                      background: color,
                      opacity: 0.7,
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
          className="overflow-hidden rounded-[var(--radius-lg)]"
          style={{
            background: "var(--ink-800)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow-inset), var(--shadow-sm)",
            backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.016) 0%, transparent 64px)"
          }}
        >
          {/* Panel header with integrated filter tabs */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--line-soft)" }}
          >
            <span
              className="mono text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "var(--text-secondary)" }}
            >
              {messages.entity.panels.entities}
            </span>
            <div
              className="flex rounded-[var(--radius-xs)] p-0.5"
              style={{ background: "var(--ink-750)", border: "1px solid var(--line-faint)" }}
            >
              {(["all", "watched"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className="mono rounded-[2px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] transition-all duration-[var(--dur-fast)]"
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
          </div>

          {/* Entity rows */}
          <div className="px-0">
            {displayed.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                —
              </div>
            ) : (
              displayed.map((entity) => {
                const isSelected = selectedId === entity.id;
                return (
                  <div
                    key={entity.id}
                    className="flex w-full items-center justify-between px-4 py-3"
                    style={{
                      borderBottom: "1px solid var(--line-faint)",
                      borderLeft: isSelected ? "2px solid var(--rune)" : "2px solid transparent",
                      background: isSelected ? "rgba(201,169,97,0.05)" : "transparent",
                      paddingLeft: isSelected ? "calc(1rem - 0px)" : "calc(1rem + 2px)"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(entity.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div
                        className="text-[12px] font-medium leading-tight truncate"
                        style={{ color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}
                      >
                        {entity.name}
                      </div>
                      <div
                        className="mono mt-1 text-[10px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        Score {entity.score}
                        <span style={{ color: "var(--line-vivid)" }}> · </span>
                        <span style={{ color: isSelected ? "var(--rune-dim)" : "var(--text-tertiary)" }}>
                          {Math.round(entity.confidence * 100)}%
                        </span>
                      </div>
                    </button>
                    <FavoriteButton id={entity.id} category="entity" label={entity.name} size={13} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Entity Detail ────────────────────────────────────────────── */}
        {selected ? (
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
                <div className="flex items-center justify-between gap-2">
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
              </div>

              <Divider />

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
                        <span className="truncate" style={{ color: "var(--text-primary)" }}>
                          {event.title}
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
                      className="py-2.5"
                      style={{ borderTop: i > 0 ? "1px solid var(--line-faint)" : "none" }}
                    >
                      <div className="flex items-baseline gap-2 text-[12px]">
                        <span
                          className="mono shrink-0 text-[10px] font-medium"
                          style={{ color: "var(--rune-dim)" }}
                        >
                          {link.type}
                        </span>
                        <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                          {link.from}
                          <span style={{ color: "var(--text-quaternary)" }}> → </span>
                          {link.to}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Confidence value={link.confidence} />
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
    </div>
  );
}

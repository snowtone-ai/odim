"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/panel";
import { Confidence } from "@/components/ui/confidence";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { useFavorites } from "@/lib/stores/favorites";

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

type Brief = {
  name: string;
  status: string;
  brief: string;
  source: string;
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

export function EntityWorkstation({
  entities,
  layerActivity,
  ontologyLinks,
  timelineEvents,
  watchlistBriefs,
  messages
}: Readonly<{
  entities: Entity[];
  layerActivity: LayerStat[];
  ontologyLinks: OntologyLink[];
  timelineEvents: TimelineEvent[];
  watchlistBriefs: Brief[];
  messages: Messages;
}>) {
  const favorites = useFavorites();
  const [filterTab, setFilterTab] = useState<"all" | "watched">("all");
  const [selectedId, setSelectedId] = useState<string>(entities[0]?.id ?? "");
  const [briefOpen, setBriefOpen] = useState(false);

  const displayedEntities =
    filterTab === "watched"
      ? entities.filter((e) => favorites.has(e.id))
      : entities;

  const selected = entities.find((e) => e.id === selectedId) ?? entities[0];

  return (
    <div className="grid gap-5">
      {/* Sector Heat Row */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {layerActivity.map((layer, index) => (
          <div
            key={layer.layer}
            className="rounded-[var(--radius-md)] p-3 transition-all duration-[var(--dur-fast)] hover:translate-y-[-1px]"
            style={{
              background: "var(--ink-850)",
              border: "1px solid var(--line-faint)",
              boxShadow: "var(--shadow-inset)"
            }}
          >
            <div
              className="mono text-[10px] uppercase tracking-[0.12em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {messages.layers[index] ?? layer.layer}
            </div>
            <div
              className="mono mt-3 text-lg font-medium"
              style={{ color: "var(--rune)" }}
            >
              {layer.count}
            </div>
            <div
              className="mono mt-0.5 text-[10px] uppercase tracking-[0.1em]"
              style={{ color: "var(--text-quaternary)" }}
            >
              {layer.source}
            </div>
          </div>
        ))}
      </div>

      {/* Three-column grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[260px_1fr_300px]">
        {/* Entity List */}
        <div className="flex flex-col gap-0">
          {/* Filter tabs */}
          <div
            className="mb-3 flex rounded-[var(--radius-sm)] p-0.5"
            style={{ background: "var(--ink-800)", border: "1px solid var(--line-faint)" }}
          >
            {(["all", "watched"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                className="mono flex-1 rounded-[var(--radius-xs)] py-1.5 text-[10px] uppercase tracking-[0.12em] transition-all duration-[var(--dur-fast)]"
                style={{
                  background: filterTab === tab ? "var(--ink-650)" : "transparent",
                  color: filterTab === tab ? "var(--text-primary)" : "var(--text-tertiary)",
                  border: filterTab === tab ? "1px solid var(--line-soft)" : "1px solid transparent",
                  boxShadow: filterTab === tab ? "var(--shadow-sm)" : "none"
                }}
              >
                {tab === "all" ? messages.entity.filterAll : messages.entity.filterWatched}
              </button>
            ))}
          </div>

          <Panel title={messages.entity.panels.entities}>
            {displayedEntities.length === 0 ? (
              <div className="py-4 text-center text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                —
              </div>
            ) : (
              displayedEntities.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => setSelectedId(entity.id)}
                  className="flex w-full items-start justify-between py-3 text-left transition-all duration-[var(--dur-fast)]"
                  style={{
                    borderBottom: "1px solid var(--line-faint)",
                    background: selectedId === entity.id ? "var(--rune-wash)" : "transparent"
                  }}
                >
                  <div>
                    <div
                      className="text-[13px]"
                      style={{ color: selectedId === entity.id ? "var(--rune)" : "var(--text-primary)" }}
                    >
                      {entity.name}
                    </div>
                    <div
                      className="mono mt-0.5 text-[11px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Score {entity.score} · {Math.round(entity.confidence * 100)}%
                    </div>
                  </div>
                  <FavoriteButton id={entity.id} category="entity" label={entity.name} />
                </button>
              ))
            )}
          </Panel>
        </div>

        {/* Entity Detail */}
        {selected && (
          <Panel title={selected.name} accent>
            {/* Metrics row */}
            <div className="grid grid-cols-3 gap-3">
              <Metric label={messages.entity.metrics.score} value={selected.score.toString()} />
              <Metric label={messages.entity.metrics.committed} value={selected.committed} />
              <Metric label={messages.entity.metrics.leadTime} value={`${selected.lead}d`} />
            </div>

            {/* Narrative–Reality Gap */}
            <div
              className="mt-4 rounded-[var(--radius-md)] p-4"
              style={{
                background: "var(--ink-800)",
                border: "1px solid rgba(201,169,97,0.10)",
                boxShadow: "var(--shadow-inset)"
              }}
            >
              <div
                className="mono mb-2.5 text-[10px] font-medium uppercase tracking-[0.12em]"
                style={{ color: "var(--rune-dim)" }}
              >
                {messages.entity.narrativeGap}
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="mono text-2xl font-medium"
                  style={{ color: "var(--rune)" }}
                >
                  +{selected.lead}d
                </span>
                <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  ahead of narrative confirmation
                </span>
              </div>
              <div className="mt-3">
                <Confidence value={selected.confidence} />
              </div>
            </div>

            {/* Timeline */}
            <div
              className="mt-4 rounded-[var(--radius-md)] p-4"
              style={{
                background: "var(--ink-850)",
                border: "1px solid var(--line-faint)",
                boxShadow: "var(--shadow-inset)"
              }}
            >
              <div
                className="mono mb-3 text-[11px] font-medium uppercase tracking-[0.12em]"
                style={{ color: "var(--text-secondary)" }}
              >
                {messages.entity.timeline}
              </div>
              <div className="grid gap-2.5">
                {timelineEvents.slice(0, 5).map((event) => (
                  <div
                    className="grid grid-cols-[80px_1fr_auto] gap-2 pb-2.5 text-[13px]"
                    style={{ borderBottom: "1px solid var(--line-faint)" }}
                    key={`${event.date}-${event.title}`}
                  >
                    <span className="mono" style={{ color: "var(--text-tertiary)" }}>
                      {event.date}
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>{event.title}</span>
                    <span className="mono" style={{ color: "var(--rune)" }}>
                      {Math.round(event.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Brief (collapsible) */}
            <div
              className="mt-4 overflow-hidden rounded-[var(--radius-md)]"
              style={{ border: "1px solid var(--line-faint)" }}
            >
              <button
                type="button"
                onClick={() => setBriefOpen((open) => !open)}
                className="flex w-full items-center justify-between px-4 py-3 transition-all duration-[var(--dur-fast)]"
                style={{ background: "var(--ink-850)" }}
              >
                <span
                  className="mono text-[11px] font-medium uppercase tracking-[0.12em]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {messages.entity.dailyBrief}
                </span>
                <span
                  className="mono text-[10px] uppercase tracking-[0.1em] transition-transform duration-[var(--dur-fast)]"
                  style={{
                    color: "var(--text-tertiary)",
                    transform: briefOpen ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                >
                  ▾
                </span>
              </button>
              {briefOpen && (
                <div className="px-4 pb-3 pt-1" style={{ background: "var(--ink-850)" }}>
                  {watchlistBriefs.map((brief) => (
                    <div
                      key={brief.name}
                      className="py-2.5"
                      style={{ borderBottom: "1px solid var(--line-faint)" }}
                    >
                      <div className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                        {brief.brief}
                      </div>
                      <div
                        className="mono mt-1 text-[10px] uppercase tracking-[0.1em]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {brief.source}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* Ontology Links */}
        <Panel title={messages.entity.panels.links}>
          {ontologyLinks.slice(0, 8).map((link) => (
            <div
              className="py-3"
              style={{ borderBottom: "1px solid var(--line-faint)" }}
              key={`${link.from}-${link.to}-${link.type}`}
            >
              <div className="mono text-[11px] font-medium" style={{ color: "var(--rune)" }}>
                {link.type}
              </div>
              <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-primary)" }}>
                {link.from} → {link.to}
              </div>
              <div className="mt-2.5">
                <Confidence value={link.confidence} />
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div
      className="rounded-[var(--radius-md)] p-3.5"
      style={{
        background: "var(--ink-850)",
        border: "1px solid var(--line-faint)",
        boxShadow: "var(--shadow-inset), var(--shadow-sm)"
      }}
    >
      <div
        className="mono text-[10px] font-medium uppercase tracking-[0.13em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>
      <div
        className="mono mt-2.5 text-xl font-medium"
        style={{ color: "var(--rune)", textShadow: "0 0 14px rgba(201,169,97,0.18)" }}
      >
        {value}
      </div>
    </div>
  );
}

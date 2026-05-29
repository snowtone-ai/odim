"use client";

import { useMemo } from "react";
import { alerts, entities, layerActivity, timelineEvents } from "@/lib/data";
import { useDashboardConfig, type Widget, type WidgetType } from "@/lib/stores/dashboard-config";

const widgetPalette: Array<{ type: WidgetType; label: string }> = [
  { type: "entity-list", label: "Entities" },
  { type: "alert-queue", label: "Alerts" },
  { type: "map-mini", label: "Map" },
  { type: "sparkline-grid", label: "Sparklines" },
  { type: "daily-diff", label: "Daily Diff" },
  { type: "sector-rotation", label: "Sector Rotation" },
  { type: "source-health", label: "Source Health" },
  { type: "huginn-mini", label: "Huginn" }
];

function WidgetBody({ widget }: Readonly<{ widget: Widget }>) {
  switch (widget.type) {
    case "entity-list":
      return <div className="grid gap-2">{entities.slice(0, 5).map((entity) => <div key={entity.id} className="flex justify-between text-sm"><span>{entity.name}</span><span>{entity.score}</span></div>)}</div>;
    case "alert-queue":
      return <div className="grid gap-2">{alerts.slice(0, 4).map((alert) => <div key={alert.id} className="text-sm">{alert.priority} · {alert.title}</div>)}</div>;
    case "map-mini":
      return <div className="grid h-full place-items-center text-sm" style={{ color: "var(--text-secondary)" }}>Geo drill and hotspot overlay</div>;
    case "sparkline-grid":
      return <div className="grid gap-2">{entities.slice(0, 4).map((entity) => <div key={entity.id} className="text-sm">{entity.name} · {entity.scoreHistory?.join(" / ")}</div>)}</div>;
    case "daily-diff":
      return <div className="grid gap-2">{timelineEvents.slice(-4).map((event) => <div key={`${event.date}-${event.title}`} className="text-sm">{event.date} · {event.title}</div>)}</div>;
    case "sector-rotation":
      return <div className="grid gap-2">{layerActivity.slice(0, 5).map((layer) => <div key={layer.layer} className="flex justify-between text-sm"><span>{layer.layer}</span><span>{layer.count}</span></div>)}</div>;
    case "source-health":
      return <div className="grid gap-2">{layerActivity.slice(0, 5).map((layer) => <div key={layer.layer} className="text-sm">{layer.source} · {Math.round(layer.confidence * 100)}%</div>)}</div>;
    case "huginn-mini":
      return <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Template query surface for quick morning briefs.</div>;
    default:
      return null;
  }
}

export function DashboardBuilder() {
  const { dashboards, activeId, editMode, setActive, toggleEdit, addWidget, moveWidget, removeWidget, saveDashboard } = useDashboardConfig();
  const active = useMemo(() => dashboards.find((dashboard) => dashboard.id === activeId) ?? dashboards[0], [activeId, dashboards]);

  return (
    <div className="grid gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        {dashboards.map((dashboard) => (
          <button
            key={dashboard.id}
            type="button"
            onClick={() => setActive(dashboard.id)}
            className="rounded px-3 py-1.5 text-sm"
            style={{
              background: dashboard.id === active.id ? "var(--rune-wash)" : "var(--surface-secondary)",
              color: dashboard.id === active.id ? "var(--rune)" : "var(--text-secondary)",
              border: "1px solid var(--line-faint)"
            }}
          >
            {dashboard.name}
          </button>
        ))}
        <button type="button" onClick={toggleEdit} className="rounded px-3 py-1.5 text-sm" style={{ background: "var(--surface-secondary)", border: "1px solid var(--line-faint)" }}>
          {editMode ? "Done" : "Edit"}
        </button>
        <button type="button" onClick={() => saveDashboard(active.name)} className="rounded px-3 py-1.5 text-sm" style={{ background: "var(--surface-secondary)", border: "1px solid var(--line-faint)" }}>
          Duplicate
        </button>
      </div>

      {editMode && (
        <div className="flex flex-wrap gap-2">
          {widgetPalette.map((entry) => (
            <button key={entry.type} type="button" onClick={() => addWidget(entry.type)} className="rounded px-3 py-1.5 text-sm" style={{ background: "var(--surface-secondary)", border: "1px solid var(--line-faint)" }}>
              + {entry.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-12">
        {active.widgets.map((widget) => (
          <section
            key={widget.id}
            draggable={editMode}
            onDragStart={(event) => event.dataTransfer.setData("text/widget-id", widget.id)}
            onDragOver={(event) => editMode && event.preventDefault()}
            onDrop={(event) => {
              if (!editMode) return;
              event.preventDefault();
              const dragged = event.dataTransfer.getData("text/widget-id");
              if (!dragged) return;
              moveWidget(dragged, widget.x, widget.y);
            }}
            className="rounded-[8px] p-4"
            style={{
              gridColumn: `span ${widget.w} / span ${widget.w}`,
              minHeight: `${widget.h * 140}px`,
              background: "var(--surface-primary)",
              border: `1px solid ${editMode ? "var(--rune-dim)" : "var(--line-faint)"}`
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm" style={{ color: "var(--text-primary)" }}>{widget.type}</h2>
              {editMode && <button type="button" onClick={() => removeWidget(widget.id)} className="text-xs" style={{ color: "var(--text-secondary)" }}>Remove</button>}
            </div>
            <WidgetBody widget={widget} />
          </section>
        ))}
      </div>
    </div>
  );
}

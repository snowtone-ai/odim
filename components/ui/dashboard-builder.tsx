"use client";

import { useMemo } from "react";
import { alerts, entities, layerActivity, timelineEvents } from "@/lib/data";
import { useDashboardConfig, type Widget, type WidgetType } from "@/lib/stores/dashboard-config";

const widgetPalette: Array<{ type: WidgetType; label: string; hint: string }> = [
  { type: "entity-list", label: "Entities", hint: "ranked objects" },
  { type: "alert-queue", label: "Alerts", hint: "unread signals" },
  { type: "map-mini", label: "Map", hint: "geographic context" },
  { type: "sparkline-grid", label: "Sparklines", hint: "score movement" },
  { type: "daily-diff", label: "Daily diff", hint: "new evidence" },
  { type: "sector-rotation", label: "Sector rotation", hint: "layer activity" },
  { type: "source-health", label: "Source health", hint: "freshness" },
  { type: "huginn-mini", label: "Huginn", hint: "briefing prompt" }
];

function WidgetBody({ widget }: Readonly<{ widget: Widget }>) {
  switch (widget.type) {
    case "entity-list":
      return <div className="grid gap-1.5">{entities.slice(0, 5).map((entity) => <div key={entity.id} className="flex min-h-7 items-center justify-between border-b text-[11px]" style={{ borderColor: "var(--line-faint)" }}><span className="truncate" style={{ color: "var(--text-secondary)" }}>{entity.name}</span><span className="mono" style={{ color: "var(--evidence)" }}>{entity.score}</span></div>)}</div>;
    case "alert-queue":
      return <div className="grid gap-1.5">{alerts.slice(0, 4).map((alert) => <div key={alert.id} className="flex min-h-7 items-center gap-2 border-b text-[11px]" style={{ borderColor: "var(--line-faint)" }}><span className="mono shrink-0" style={{ color: "var(--critical)" }}>{alert.priority}</span><span className="truncate" style={{ color: "var(--text-secondary)" }}>{alert.title}</span></div>)}</div>;
    case "map-mini":
      return <div className="grid h-full min-h-20 place-items-center text-[11px]" style={{ color: "var(--text-secondary)" }}>Geo drill · hotspot overlay</div>;
    case "sparkline-grid":
      return <div className="grid gap-1.5">{entities.slice(0, 4).map((entity) => <div key={entity.id} className="flex min-h-7 items-center justify-between border-b text-[11px]" style={{ borderColor: "var(--line-faint)" }}><span className="truncate" style={{ color: "var(--text-secondary)" }}>{entity.name}</span><span className="mono truncate" style={{ color: "var(--evidence)" }}>{entity.scoreHistory?.join(" / ")}</span></div>)}</div>;
    case "daily-diff":
      return <div className="grid gap-1.5">{timelineEvents.slice(-4).map((event) => <div key={event.date + "-" + event.title} className="border-b py-1 text-[11px]" style={{ borderColor: "var(--line-faint)", color: "var(--text-secondary)" }}><span className="mono mr-2" style={{ color: "var(--text-tertiary)" }}>{event.date}</span>{event.title}</div>)}</div>;
    case "sector-rotation":
      return <div className="grid gap-1.5">{layerActivity.slice(0, 5).map((layer) => <div key={layer.layer} className="flex min-h-7 items-center justify-between border-b text-[11px]" style={{ borderColor: "var(--line-faint)" }}><span style={{ color: "var(--text-secondary)" }}>{layer.layer}</span><span className="mono" style={{ color: "var(--evidence)" }}>{layer.count}</span></div>)}</div>;
    case "source-health":
      return <div className="grid gap-1.5">{layerActivity.slice(0, 5).map((layer) => <div key={layer.layer} className="flex min-h-7 items-center justify-between border-b text-[11px]" style={{ borderColor: "var(--line-faint)" }}><span className="truncate" style={{ color: "var(--text-secondary)" }}>{layer.source}</span><span className="mono" style={{ color: "var(--evidence)" }}>{Math.round(layer.confidence * 100)}%</span></div>)}</div>;
    case "huginn-mini":
      return <div className="min-h-20 text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>Template query surface for quick morning briefs.</div>;
    default:
      return null;
  }
}

function ToolButton({
  entry,
  onAdd,
  disabled
}: Readonly<{
  entry: (typeof widgetPalette)[number];
  onAdd: () => void;
  disabled: boolean;
}>) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="flex min-h-11 min-w-[150px] flex-1 items-center justify-between gap-3 border px-3 text-left transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
      style={{ borderColor: "var(--line-soft)", background: "var(--surface-inset)" }}
    >
      <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>{entry.label}</span>
      <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{entry.hint}</span>
    </button>
  );
}

export function DashboardBuilder() {
  const { dashboards, activeId, editMode, setActive, toggleEdit, addWidget, moveWidget, removeWidget, saveDashboard } = useDashboardConfig();
  const active = useMemo(() => dashboards.find((dashboard) => dashboard.id === activeId) ?? dashboards[0], [activeId, dashboards]);

  if (!active) {
    return <div className="border-y px-5 py-8 text-sm" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>No dashboard configured.</div>;
  }

  return (
    <div className="min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4 sm:px-6" style={{ borderColor: "var(--line-soft)" }}>
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>Custom workspace</div>
          <h1 className="mt-1 text-[21px] font-medium" style={{ color: "var(--text-primary)" }}>{active.name}</h1>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>Arrange evidence surfaces for a repeatable operating view.</p>
        </div>
        <div className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>Fixture workspace · browser local</div>
      </header>

      <div className="border-b px-4 py-3 sm:px-6" style={{ borderColor: "var(--line-soft)" }}>
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Saved dashboards">
          {dashboards.map((dashboard) => (
            <button
              key={dashboard.id}
              type="button"
              role="tab"
              aria-selected={dashboard.id === active.id}
              onClick={() => setActive(dashboard.id)}
              className="min-h-11 border px-3 text-[12px] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none"
              style={{
                background: dashboard.id === active.id ? "var(--signal-wash)" : "transparent",
                color: dashboard.id === active.id ? "var(--text-primary)" : "var(--text-secondary)",
                borderColor: dashboard.id === active.id ? "var(--signal)" : "var(--line-soft)"
              }}
            >
              {dashboard.name}
            </button>
          ))}
          <span className="hidden h-6 w-px sm:block" style={{ background: "var(--line-soft)" }} aria-hidden="true" />
          <button type="button" onClick={toggleEdit} aria-pressed={editMode} className="min-h-11 border px-3 text-[12px] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ background: editMode ? "var(--signal-wash)" : "transparent", borderColor: editMode ? "var(--signal)" : "var(--line-soft)", color: editMode ? "var(--signal)" : "var(--text-secondary)" }}>
            {editMode ? "Finish layout" : "Edit layout"}
          </button>
          <button type="button" onClick={() => saveDashboard(active.name)} className="min-h-11 border px-3 text-[12px] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>
            Duplicate
          </button>
        </div>
        <p aria-live="polite" className="mono mt-2 text-[11px] uppercase tracking-[0.1em]" style={{ color: editMode ? "var(--signal)" : "var(--text-tertiary)" }}>
          {editMode ? "Layout editing · drag a surface to reposition" : String(active.widgets.length) + " surfaces · read-only arrangement"}
        </p>
      </div>

      {editMode ? (
        <aside aria-label="Add workspace surface" className="border-b px-4 py-3 sm:px-6" style={{ borderColor: "var(--line-soft)" }}>
          <div className="mono mb-2 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>Build tools</div>
          <div className="flex flex-wrap gap-2">
            {widgetPalette.map((entry) => <ToolButton key={entry.type} entry={entry} onAdd={() => addWidget(entry.type)} disabled={false} />)}
          </div>
        </aside>
      ) : null}

      <div className="overflow-x-auto px-4 py-4 sm:px-6 sm:py-5" aria-label="Dashboard canvas">
        <div className="min-w-[640px] border" style={{ borderColor: "var(--line-soft)", background: "var(--field)" }}>
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--line-soft)" }}>
            <span className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>Canvas / 12 columns</span>
            <span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-quaternary)" }}>source → object → signal</span>
          </div>
          {active.widgets.length ? (
            <div className="grid min-h-[420px] grid-cols-12 auto-rows-[80px] gap-px p-px" style={{ background: "var(--line-soft)" }}>
              {active.widgets.map((widget) => (
                <article
                  key={widget.id}
                  draggable={editMode}
                  aria-label={widget.type + " surface"}
                  onDragStart={(event) => event.dataTransfer.setData("text/widget-id", widget.id)}
                  onDragOver={(event) => editMode && event.preventDefault()}
                  onDrop={(event) => {
                    if (!editMode) return;
                    event.preventDefault();
                    const dragged = event.dataTransfer.getData("text/widget-id");
                    if (dragged) moveWidget(dragged, widget.x, widget.y);
                  }}
                  className="group relative min-h-0 overflow-hidden border p-3 transition-colors duration-[180ms] hover:border-[var(--line-vivid)] focus-within:border-[var(--signal)] motion-reduce:transition-none"
                  style={{
                    gridColumn: String(Math.max(1, Math.min(widget.x, 12))) + " / span " + String(Math.max(1, Math.min(widget.w, 12))),
                    gridRow: String(Math.max(1, widget.y)) + " / span " + String(Math.max(1, widget.h)),
                    background: "var(--surface)",
                    borderColor: editMode ? "var(--signal)" : "var(--line-soft)"
                  }}
                >
                  <div className="mb-2 flex min-h-11 items-start justify-between gap-2 border-b pb-2" style={{ borderColor: "var(--line-faint)" }}>
                    <h2 className="mono truncate text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-secondary)" }}>{widget.type}</h2>
                    {editMode ? <button type="button" onClick={() => removeWidget(widget.id)} className="min-h-11 px-1 text-[12px] text-[var(--critical)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--signal)]">Remove</button> : null}
                  </div>
                  <WidgetBody widget={widget} />
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-[280px] place-items-center px-5 py-12 text-center">
              <div>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>Canvas is empty.</p>
                <p className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>Enter layout editing to add an evidence surface.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

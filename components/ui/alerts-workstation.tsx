"use client";

import { useState, useMemo } from "react";
import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Confidence } from "@/components/ui/confidence";
import { ExportButton } from "@/components/ui/export-button";
import { useAlertState } from "@/lib/stores/alert-state";

type EvidenceRef = { sourceId?: string; title?: string; url?: string };

type Alert = {
  id: string;
  priority: string;
  title: string;
  source: string;
  confidence: number;
  description: string;
  evidence: EvidenceRef[];
};

type Messages = {
  title: string;
  panels: { queue: string; chain: string };
  markAllRead: string;
  unread: string;
  viewList: string;
  viewGrouped: string;
};

/** Extract a rough entity name from alert title for grouping. */
function extractEntityName(title: string): string {
  // Patterns: "Tesla SEC 8-K", "NextEra TX Solar", "BHP Pilbara …"
  // Take first 1–3 words before a separator keyword.
  const stopWords = /\b(sec|8-k|s-1|filing|alert|signal|permit|acquisition|investment|capital|fund|report)\b/i;
  const words = title.split(/\s+/);
  const stopIdx = words.findIndex((w) => stopWords.test(w));
  const entityWords = stopIdx > 0 ? words.slice(0, stopIdx) : words.slice(0, 2);
  return entityWords.join(" ") || title.slice(0, 30);
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3
};

function priorityLevel(p: string): number {
  return PRIORITY_ORDER[p.toLowerCase()] ?? 99;
}

type AlertGroup = {
  entityName: string;
  alerts: Alert[];
  highestPriority: string;
  isCritical: boolean;
};

export function AlertsWorkstation({
  alerts,
  messages,
}: Readonly<{
  alerts: Alert[];
  messages: Messages;
}>) {
  const [selectedId, setSelectedId] = useState<string | null>(alerts[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { markRead, markAllRead, isUnread } = useAlertState();

  const selectedAlert = alerts.find((a) => a.id === selectedId) ?? alerts[0];
  const allIds = alerts.map((a) => a.id);

  function handleSelectAlert(id: string) {
    setSelectedId(id);
    markRead(id);
  }

  function handleMarkAllRead() {
    markAllRead(allIds);
  }

  const groups = useMemo<AlertGroup[]>(() => {
    const map = new Map<string, Alert[]>();
    for (const alert of alerts) {
      const key = extractEntityName(alert.title);
      const arr = map.get(key) ?? [];
      arr.push(alert);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([entityName, entityAlerts]) => {
        const sorted = [...entityAlerts].sort((a, b) => priorityLevel(a.priority) - priorityLevel(b.priority));
        const highestPriority = sorted[0]?.priority ?? "low";
        return {
          entityName,
          alerts: sorted,
          highestPriority,
          isCritical: priorityLevel(highestPriority) === 0
        };
      })
      .sort((a, b) => priorityLevel(a.highestPriority) - priorityLevel(b.highestPriority));
  }, [alerts]);

  const chainSteps: string[] = selectedAlert?.evidence.length
    ? selectedAlert.evidence.map((ev: EvidenceRef) =>
        String(ev.title ?? ev.sourceId ?? "Source-backed evidence")
      )
    : [
        "Raw filing observed",
        "Entity resolution matched",
        "SPV confidence threshold exceeded",
        "Alert emitted",
      ];

  return (
    <Screen title={messages.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <Panel title={messages.panels.queue}>
          {/* Controls row */}
          <div className="mb-3 flex items-center justify-between">
            {/* View toggle */}
            <div
              className="flex overflow-hidden rounded-[var(--radius-sm)]"
              style={{ border: "1px solid var(--line-faint)" }}
            >
              {(["list", "grouped"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className="mono px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] transition-colors"
                  style={{
                    background: viewMode === mode ? "var(--rune-wash)" : "transparent",
                    color: viewMode === mode ? "var(--rune)" : "var(--text-tertiary)"
                  }}
                >
                  {mode === "list" ? messages.viewList : messages.viewGrouped}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ExportButton type="alerts" />
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="mono text-[10px] uppercase tracking-[0.1em] transition-colors hover:text-[var(--rune)]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {messages.markAllRead}
              </button>
            </div>
          </div>

          {viewMode === "list" ? (
            /* ── List view ── */
            alerts.map((alert) => {
              const isSelected = selectedId === alert.id;
              const unread = isUnread(alert.id);
              return (
                <button
                  key={alert.id}
                  type="button"
                  className="w-full text-left py-3.5 transition-colors"
                  style={{
                    borderBottom: "1px solid var(--line-faint)",
                    borderLeft: isSelected ? "3px solid var(--rune)" : "3px solid transparent",
                    paddingLeft: isSelected ? "12px" : "0",
                    background: isSelected ? "rgba(201,169,97,0.04)" : "transparent",
                  }}
                  onClick={() => handleSelectAlert(alert.id)}
                >
                  <div className="flex items-center gap-2">
                    {unread && (
                      <span
                        className="inline-block shrink-0 rounded-full"
                        style={{
                          width: 8,
                          height: 8,
                          background: "#3b82f6",
                          boxShadow: "0 0 4px rgba(59,130,246,0.6)"
                        }}
                        aria-label={messages.unread}
                      />
                    )}
                    <div
                      className="mono text-[10px] font-medium uppercase tracking-[0.13em]"
                      style={{ color: "var(--critical)" }}
                    >
                      {alert.priority}
                    </div>
                  </div>
                  <div className="mt-1.5 text-[13px]" style={{ color: "var(--text-primary)" }}>
                    {alert.title}
                  </div>
                  <div className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    {alert.description}
                  </div>
                  <div className="mt-2.5">
                    <Confidence value={alert.confidence} />
                  </div>
                </button>
              );
            })
          ) : (
            /* ── Grouped view ── */
            groups.map((group) => {
              const isExpanded = expandedGroups.has(group.entityName);
              const hasUnread = group.alerts.some((a) => isUnread(a.id));
              return (
                <div key={group.entityName}>
                  {/* Group header */}
                  <button
                    type="button"
                    className="w-full text-left py-2.5 transition-colors"
                    style={{
                      borderBottom: "1px solid var(--line-faint)",
                      borderLeft: group.isCritical
                        ? "3px solid var(--critical)"
                        : "3px solid var(--line-faint)",
                      paddingLeft: "12px",
                      background: group.isCritical
                        ? "rgba(220,38,38,0.04)"
                        : "var(--surface-tertiary)"
                    }}
                    onClick={() =>
                      setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.entityName)) next.delete(group.entityName);
                        else next.add(group.entityName);
                        return next;
                      })
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {hasUnread && (
                          <span
                            className="inline-block shrink-0 rounded-full"
                            style={{
                              width: 6,
                              height: 6,
                              background: "#3b82f6",
                              boxShadow: "0 0 4px rgba(59,130,246,0.6)"
                            }}
                          />
                        )}
                        <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                          {group.entityName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="mono text-[9px] uppercase tracking-[0.1em]"
                          style={{ color: group.isCritical ? "var(--critical)" : "var(--text-tertiary)" }}
                        >
                          {group.highestPriority}
                        </span>
                        <span
                          className="mono text-[9px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {group.alerts.length}
                        </span>
                        <span
                          className="mono text-[10px]"
                          style={{ color: "var(--text-tertiary)", transform: isExpanded ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}
                        >
                          ›
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded group items */}
                  {isExpanded && group.alerts.map((alert) => {
                    const isSelected = selectedId === alert.id;
                    const unread = isUnread(alert.id);
                    return (
                      <button
                        key={alert.id}
                        type="button"
                        className="w-full text-left py-2.5 transition-colors"
                        style={{
                          borderBottom: "1px solid var(--line-faint)",
                          borderLeft: isSelected ? "3px solid var(--rune)" : "3px solid transparent",
                          paddingLeft: isSelected ? "24px" : "20px",
                          background: isSelected ? "rgba(201,169,97,0.04)" : "transparent",
                        }}
                        onClick={() => handleSelectAlert(alert.id)}
                      >
                        <div className="flex items-center gap-1.5">
                          {unread && (
                            <span
                              className="inline-block shrink-0 rounded-full"
                              style={{
                                width: 6,
                                height: 6,
                                background: "#3b82f6",
                                boxShadow: "0 0 4px rgba(59,130,246,0.6)"
                              }}
                              aria-label={messages.unread}
                            />
                          )}
                          <span
                            className="mono text-[9px] uppercase tracking-[0.12em]"
                            style={{ color: "var(--critical)" }}
                          >
                            {alert.priority}
                          </span>
                        </div>
                        <div className="mt-1 text-[12px]" style={{ color: "var(--text-primary)" }}>
                          {alert.title}
                        </div>
                        <div className="mt-1.5">
                          <Confidence value={alert.confidence} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </Panel>

        <Panel title={messages.panels.chain} accent>
          <div className="grid gap-4">
            {chainSteps.map((step, index) => (
              <div
                className="flex gap-4 pb-4"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={`${index}-${step}`}
              >
                <div
                  className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[12px] font-medium"
                  style={{
                    color: "var(--rune)",
                    background: "var(--rune-wash)",
                    border: "1px solid rgba(201,169,97,0.14)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div
                  className="pt-0.5 text-[13px] leading-relaxed"
                  style={{ color: "var(--text-primary)" }}
                >
                  {step}
                </div>
              </div>
            ))}
          </div>
          {selectedAlert && (
            <div
              className="mono mt-3 text-[10px] uppercase tracking-[0.12em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {selectedAlert.source} · {Math.round(selectedAlert.confidence * 100)}% conf.
            </div>
          )}
        </Panel>
      </div>
    </Screen>
  );
}

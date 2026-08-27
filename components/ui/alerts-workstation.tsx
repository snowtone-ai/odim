"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExportButton } from "@/components/ui/export-button";
import { PushNotificationPrompt, type PushNotificationPromptLabels } from "@/components/ui/push-notification-prompt";
import { Screen } from "@/components/ui/screen";
import { WatchtowerWorkflows } from "@/components/ui/watchtower-workflows";
import type { WatchtowerLabels, WatchtowerPlaybookView, WatchtowerRunView } from "@/components/ui/watchtower-workflows";
import { useAlertState } from "@/lib/stores/alert-state";

type EvidenceRef = {
  sourceId?: string;
  title?: string;
  url?: string;
  observedAt?: string;
};

type Alert = {
  id: string;
  priority: string;
  title: string;
  source: string;
  confidence: number;
  relevance?: number;
  asOf?: string;
  createdAt?: string;
  description: string;
  evidence: EvidenceRef[];
};

type Messages = {
  title: string;
  panels: { queue: string; chain: string; watchtower?: string };
  markAllRead: string;
  unread: string;
  viewList: string;
  viewGrouped: string;
  watchtower: WatchtowerLabels;
  notifications?: PushNotificationPromptLabels;
};

type AlertGroup = {
  entityName: string;
  alerts: Alert[];
  highestPriority: string;
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: "var(--critical)",
  high: "var(--signal)",
  medium: "var(--evidence)",
  low: "var(--text-tertiary)"
};

const DEFAULT_NOTIFICATION_LABELS: PushNotificationPromptLabels = {
  title: "Allow browser notifications for critical alerts?",
  enable: "Enable notifications",
  dismiss: "Not now",
  busy: "Working…"
};

function priorityLevel(priority: string) {
  return PRIORITY_ORDER[priority.toLowerCase()] ?? 99;
}

function priorityColor(priority: string) {
  return PRIORITY_COLOR[priority.toLowerCase()] ?? "var(--text-tertiary)";
}

function percent(value: number | undefined) {
  return Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100) + "%";
}

function formatAsOf(value?: string) {
  if (!value) return "Source observation";
  return value.length > 10 ? value.slice(0, 10) : value;
}

function extractEntityName(title: string): string {
  const stopWords = /\b(sec|8-k|s-1|filing|alert|signal|permit|acquisition|investment|capital|fund|report)\b/i;
  const words = title.split(/\s+/);
  const stopIndex = words.findIndex((word) => stopWords.test(word));
  const entityWords = stopIndex > 0 ? words.slice(0, stopIndex) : words.slice(0, 2);
  return entityWords.join(" ") || title.slice(0, 30);
}

function ConfidenceMeter({ value }: Readonly<{ value: number }>) {
  const safeValue = Math.max(0, Math.min(1, value));
  return (
    <div className="min-w-0">
      <div className="mono mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
        <span>Confidence</span>
        <span style={{ color: "var(--evidence)" }}>{percent(safeValue)}</span>
      </div>
      <div className="h-[3px] w-full overflow-hidden" style={{ background: "var(--line-soft)" }}>
        <div
          className="h-full origin-left transition-[width] duration-[var(--motion-state)] motion-reduce:transition-none"
          style={{ width: percent(safeValue), background: "var(--evidence)" }}
        />
      </div>
    </div>
  );
}

function EvidenceThread({ alert }: Readonly<{ alert: Alert }>) {
  const entity = extractEntityName(alert.title);
  const sourceTitle = alert.evidence[0]?.title ?? alert.source;
  const steps = [
    { label: "Source", value: sourceTitle, state: "verified" },
    { label: "Entity", value: entity, state: "resolved" },
    { label: "Signal", value: alert.title, state: "active" },
    { label: "Action", value: "Review case file", state: "ready" }
  ];

  return (
    <ol aria-label="Evidence thread" className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
      {steps.map((step, index) => (
        <li
          key={step.label}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3"
          data-state={step.state}
        >
          <span
            className="mono flex h-7 w-7 items-center justify-center border text-[11px]"
            style={{
              borderColor: index === 2 ? "var(--signal)" : "var(--line-strong)",
              color: index === 2 ? "var(--signal)" : "var(--text-tertiary)"
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0">
            <span className="mono block text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
              {step.label}
            </span>
            <span className="mt-1 block truncate text-[13px]" style={{ color: "var(--text-primary)" }}>
              {step.value}
            </span>
          </span>
          <span
            className="mono text-[11px] uppercase tracking-[0.08em]"
            style={{ color: step.state === "active" ? "var(--signal)" : "var(--evidence)" }}
          >
            {step.state}
          </span>
        </li>
      ))}
    </ol>
  );
}

function WorkstationButton({
  children,
  className = "",
  ...props
}: Readonly<React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }>) {
  return (
    <button
      {...props}
      className={[
        "min-h-11 border transition-[background-color,border-color,color,transform] duration-[var(--motion-micro)]",
        "hover:bg-[var(--signal-wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]",
        "motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      ].join(" ")}
      style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)", ...props.style }}
    >
      {children}
    </button>
  );
}

export function AlertsWorkstation({
  alerts,
  messages,
  watchtower,
  loading = false,
  error
}: Readonly<{
  alerts: Alert[];
  messages: Messages;
  watchtower?: {
    runs: WatchtowerRunView[];
    playbooks: WatchtowerPlaybookView[];
    labels: WatchtowerLabels;
  };
  loading?: boolean;
  error?: string;
}>) {
  const [selectedId, setSelectedId] = useState<string | null>(alerts[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"case" | "automation">("case");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const queueHeadingRef = useRef<HTMLHeadingElement>(null);
  const caseHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousMobileDetail = useRef(false);
  const { markRead, markAllRead, readAlertIds } = useAlertState();

  useEffect(() => {
    if (selectedId && alerts.some((alert) => alert.id === selectedId)) return;
    setSelectedId(alerts[0]?.id ?? null);
  }, [alerts, selectedId]);

  useEffect(() => {
    if (previousMobileDetail.current === mobileDetailOpen) return;
    const frame = window.requestAnimationFrame(() => {
      if (mobileDetailOpen) caseHeadingRef.current?.focus();
      else queueHeadingRef.current?.focus();
    });
    previousMobileDetail.current = mobileDetailOpen;
    return () => window.cancelAnimationFrame(frame);
  }, [mobileDetailOpen]);

  const readAlertSet = useMemo(() => new Set(readAlertIds), [readAlertIds]);
  const isUnread = (id: string) => !readAlertSet.has(id);
  const selectedAlert = useMemo(
    () => alerts.find((alert) => alert.id === selectedId) ?? alerts[0],
    [alerts, selectedId]
  );
  const allIds = useMemo(() => alerts.map((alert) => alert.id), [alerts]);
  const unreadCount = useMemo(
    () => alerts.filter((alert) => !readAlertSet.has(alert.id)).length,
    [alerts, readAlertSet]
  );

  const groups = useMemo<AlertGroup[]>(() => {
    const grouped = new Map<string, Alert[]>();
    for (const alert of alerts) {
      const key = extractEntityName(alert.title);
      const existing = grouped.get(key);
      if (existing) existing.push(alert);
      else grouped.set(key, [alert]);
    }
    return Array.from(grouped.entries())
      .map(([entityName, entityAlerts]) => {
        const sorted = [...entityAlerts].sort((a, b) => priorityLevel(a.priority) - priorityLevel(b.priority));
        return {
          entityName,
          alerts: sorted,
          highestPriority: sorted[0]?.priority ?? "low"
        };
      })
      .sort((a, b) => priorityLevel(a.highestPriority) - priorityLevel(b.highestPriority));
  }, [alerts]);

  function handleSelectAlert(id: string) {
    setSelectedId(id);
    markRead(id);
    setMobileDetailOpen(true);
    setDetailTab("case");
    setFeedback("Alert marked as read");
  }

  function handleMarkAllRead() {
    markAllRead(allIds);
    setFeedback("All alerts marked as read");
  }

  function renderAlertRow(alert: Alert, nested = false) {
    const isSelected = selectedId === alert.id;
    const unread = isUnread(alert.id);
    return (
      <button
        key={alert.id}
        type="button"
        data-alert-id={alert.id}
        aria-current={isSelected ? "true" : undefined}
        onClick={() => handleSelectAlert(alert.id)}
        className="group block min-h-11 w-full border-b py-3 text-left transition-[background-color,border-color,color] duration-[var(--motion-micro)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal)] motion-reduce:transition-none"
        style={{
          borderColor: "var(--line-soft)",
          borderLeft: "3px solid " + (isSelected ? "var(--signal)" : "transparent"),
          paddingLeft: nested ? (isSelected ? "20px" : "16px") : isSelected ? "12px" : "0",
          paddingRight: "4px",
          background: isSelected ? "var(--signal-wash)" : "transparent"
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {unread ? (
            <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--signal)" }} />
          ) : (
            <span className="h-2 w-2 shrink-0" aria-hidden="true" />
          )}
          <span className="mono text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: priorityColor(alert.priority) }}>
            {alert.priority}
          </span>
          <span className="mono min-w-0 truncate text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-quaternary)" }}>
            {alert.source}
          </span>
        </span>
        <span className="mt-1.5 block text-[13px] leading-snug" style={{ color: unread ? "var(--text-primary)" : "var(--text-secondary)" }}>
          {alert.title}
        </span>
        <span className="mt-1 block line-clamp-2 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          {alert.description}
        </span>
        <span className="mt-2.5 block">
          <ConfidenceMeter value={alert.confidence} />
        </span>
      </button>
    );
  }

  const notificationLabels = messages.notifications ?? DEFAULT_NOTIFICATION_LABELS;

  return (
    <Screen
      title={messages.title}
      actions={
        <WorkstationButton
          type="button"
          aria-expanded={notificationOpen}
          onClick={() => setNotificationOpen(true)}
          className="mono inline-flex items-center px-3 text-[11px] uppercase tracking-[0.08em]"
        >
          Notifications
        </WorkstationButton>
      }
    >
      <div className="bg-[var(--field)] px-5 py-5 sm:px-6 md:px-8" aria-busy={loading}>
        {error ? (
          <div role="alert" className="mb-4 border px-3 py-3 text-[12px]" style={{ borderColor: "var(--critical)", background: "var(--critical-wash)", color: "var(--critical)" }}>
            {error}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--line-soft)" }}>
          <div>
            <p className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
              Triage / newest material changes
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {unreadCount} {messages.unread.toLowerCase()} · {alerts.length} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton type="alerts" />
            <WorkstationButton
              type="button"
              onClick={handleMarkAllRead}
              className="mono px-3 text-[11px] uppercase tracking-[0.08em]"
              disabled={loading || alerts.length === 0}
            >
              {messages.markAllRead}
            </WorkstationButton>
          </div>
        </div>

        {loading ? (
          <div role="status" aria-live="polite" className="grid gap-3 border-y py-6" style={{ borderColor: "var(--line-soft)" }}>
            <span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
              Loading alert queue…
            </span>
            <span className="block h-3 w-2/3 animate-pulse bg-[var(--line-soft)] motion-reduce:animate-none" />
            <span className="block h-3 w-1/2 animate-pulse bg-[var(--line-soft)] motion-reduce:animate-none" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)] lg:gap-6">
            <section aria-labelledby="alert-queue-heading" className={mobileDetailOpen ? "hidden lg:block" : "block"}>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 ref={queueHeadingRef} id="alert-queue-heading" tabIndex={-1} className="mono text-[12px] uppercase tracking-[0.1em] outline-none" style={{ color: "var(--text-primary)" }}>
                    {messages.panels.queue}
                  </h2>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    Select a signal to open its case file.
                  </p>
                </div>
                <div role="tablist" aria-label="Queue view" className="flex border" style={{ borderColor: "var(--line-soft)" }}>
                  {(["list", "grouped"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={viewMode === mode}
                      onClick={() => setViewMode(mode)}
                      className="mono min-h-11 px-3 text-[11px] uppercase tracking-[0.08em] transition-colors duration-[var(--motion-micro)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal)] motion-reduce:transition-none"
                      style={{ background: viewMode === mode ? "var(--signal-wash)" : "transparent", color: viewMode === mode ? "var(--signal)" : "var(--text-tertiary)" }}
                    >
                      {mode === "list" ? messages.viewList : messages.viewGrouped}
                    </button>
                  ))}
                </div>
              </div>

              {alerts.length === 0 ? (
                <div role="status" className="border-y px-3 py-8 text-center text-[13px]" style={{ borderColor: "var(--line-soft)", color: "var(--text-tertiary)" }}>
                  No active alerts. New source-backed changes will appear here.
                </div>
              ) : viewMode === "list" ? (
                <div>{alerts.map((alert) => renderAlertRow(alert))}</div>
              ) : (
                <div>
                  {groups.map((group, groupIndex) => {
                    const expanded = expandedGroups.has(group.entityName);
                    const hasUnread = group.alerts.some((alert) => isUnread(alert.id));
                    const groupId = "alert-group-" + groupIndex;
                    return (
                      <div key={group.entityName} className="border-b" style={{ borderColor: "var(--line-soft)" }}>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={groupId}
                          onClick={() => setExpandedGroups((current) => {
                            const next = new Set(current);
                            if (next.has(group.entityName)) next.delete(group.entityName);
                            else next.add(group.entityName);
                            return next;
                          })}
                          className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left transition-colors duration-[var(--motion-micro)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal)] motion-reduce:transition-none"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hasUnread ? "var(--signal)" : "var(--line-strong)" }} />
                            <span className="truncate text-[13px]" style={{ color: "var(--text-primary)" }}>{group.entityName}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: priorityColor(group.highestPriority) }}>{group.highestPriority}</span>
                            <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{group.alerts.length}</span>
                            <span aria-hidden="true" className="mono text-[14px] transition-transform duration-[var(--motion-micro)] motion-reduce:transition-none" style={{ color: "var(--text-tertiary)", transform: expanded ? "rotate(90deg)" : "none" }}>›</span>
                          </span>
                        </button>
                        {expanded ? <div id={groupId}>{group.alerts.map((alert) => renderAlertRow(alert, true))}</div> : null}
                      </div>
                    );
                  })}
                </div>
              )}
              <div role="status" aria-live="polite" className="mt-3 min-h-5 text-[11px]" style={{ color: "var(--evidence)" }}>
                {feedback}
              </div>
            </section>

            <section
              aria-labelledby="case-file-heading"
              className={"alerts-workstation-detail " + (mobileDetailOpen ? "block" : "hidden lg:block") + " min-h-[calc(100dvh-12rem)] border-y lg:min-h-0"}
              style={{ borderColor: "var(--line-soft)" }}
            >
              <div className="flex min-h-11 items-center justify-between border-b px-3 lg:hidden" style={{ borderColor: "var(--line-soft)" }}>
                <WorkstationButton
                  type="button"
                  onClick={() => setMobileDetailOpen(false)}
                  className="mono border-0 px-2 text-[11px] uppercase tracking-[0.08em]"
                >
                  ← Queue
                </WorkstationButton>
                <span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>Case file</span>
              </div>

              {selectedAlert ? (
                <div>
                  <header className="border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--line-soft)" }}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: priorityColor(selectedAlert.priority) }}>{selectedAlert.priority}</span>
                      <span className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-quaternary)" }}>Signal / {selectedAlert.source}</span>
                    </div>
                    <h2 ref={caseHeadingRef} id="case-file-heading" tabIndex={-1} className="mt-3 max-w-3xl text-[20px] font-medium leading-tight tracking-[-0.02em] outline-none" style={{ color: "var(--text-primary)" }}>
                      {selectedAlert.title}
                    </h2>
                    <p className="mt-3 max-w-3xl text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{selectedAlert.description}</p>
                    {selectedAlert.evidence[0]?.url ? (
                      <a
                        href={selectedAlert.evidence[0].url}
                        target="_blank"
                        rel="noreferrer"
                        className="mono mt-3 inline-flex min-h-11 items-center border px-3 text-[11px] uppercase tracking-[0.08em] transition-colors duration-[var(--motion-micro)] hover:bg-[var(--evidence-wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--evidence)] motion-reduce:transition-none"
                        style={{ borderColor: "var(--evidence)", color: "var(--evidence)" }}
                      >
                        Open source ↗
                      </a>
                    ) : null}
                  </header>

                  <dl className="grid grid-cols-2 border-b sm:grid-cols-4" style={{ borderColor: "var(--line-soft)" }}>
                    {[
                      ["Relevance", percent(selectedAlert.relevance ?? selectedAlert.confidence), "var(--signal)"],
                      ["Confidence", percent(selectedAlert.confidence), "var(--evidence)"],
                      ["Source", selectedAlert.source, "var(--text-primary)"],
                      ["As of", formatAsOf(selectedAlert.asOf ?? selectedAlert.createdAt ?? selectedAlert.evidence[0]?.observedAt), "var(--text-primary)"]
                    ].map(([label, value, color]) => (
                      <div key={label} className="border-r px-3 py-3 last:border-r-0" style={{ borderColor: "var(--line-soft)" }}>
                        <dt className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>{label}</dt>
                        <dd className="mt-1 truncate text-[12px]" style={{ color }}>{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {watchtower ? (
                    <div role="tablist" aria-label="Selected alert detail" className="flex border-b px-4 sm:px-5" style={{ borderColor: "var(--line-soft)" }}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={detailTab === "case"}
                        onClick={() => setDetailTab("case")}
                        className="mono min-h-11 border-b-2 px-1 text-[11px] uppercase tracking-[0.08em] transition-colors duration-[var(--motion-state)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] motion-reduce:transition-none"
                        style={{ borderColor: detailTab === "case" ? "var(--signal)" : "transparent", color: detailTab === "case" ? "var(--signal)" : "var(--text-tertiary)" }}
                      >
                        Evidence
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={detailTab === "automation"}
                        onClick={() => setDetailTab("automation")}
                        className="mono ml-5 min-h-11 border-b-2 px-1 text-[11px] uppercase tracking-[0.08em] transition-colors duration-[var(--motion-state)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] motion-reduce:transition-none"
                        style={{ borderColor: detailTab === "automation" ? "var(--signal)" : "transparent", color: detailTab === "automation" ? "var(--signal)" : "var(--text-tertiary)" }}
                      >
                        {messages.panels.watchtower ?? watchtower.labels.title}
                      </button>
                    </div>
                  ) : null}

                  {detailTab === "case" || !watchtower ? (
                    <div>
                      <div className="px-4 py-4 sm:px-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-primary)" }}>{messages.panels.chain}</h3>
                          <span className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--evidence)" }}>source-backed</span>
                        </div>
                        <EvidenceThread alert={selectedAlert} />
                      </div>

                      <div className="border-t px-4 py-3 sm:px-5" style={{ borderColor: "var(--line-soft)" }}>
                        {selectedAlert.evidence.length ? (
                          <div>
                            <p className="mono mb-2 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>Evidence records</p>
                            <ul className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
                              {selectedAlert.evidence.map((evidence, index) => (
                                <li key={(evidence.sourceId ?? "source") + "-" + index} className="flex min-h-11 items-center justify-between gap-3 py-2">
                                  <span className="min-w-0">
                                    <span className="block truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{evidence.title ?? evidence.sourceId ?? "Source record"}</span>
                                    <span className="mono mt-0.5 block truncate text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-quaternary)" }}>{evidence.sourceId ?? selectedAlert.source}</span>
                                  </span>
                                  {evidence.url ? (
                                    <a
                                      href={evidence.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      aria-label={"Open " + (evidence.title ?? evidence.sourceId ?? "source")}
                                      className="mono flex min-h-11 shrink-0 items-center px-2 text-[11px] uppercase tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--evidence)]"
                                      style={{ color: "var(--evidence)" }}
                                    >
                                      View
                                    </a>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p role="status" className="py-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>No evidence records attached to this alert.</p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {detailTab === "automation" && watchtower ? (
                    <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: "var(--line-soft)" }}>
                      <p className="mb-3 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        Approval-gated workflow trace. Start or rerun automation only when the evidence is ready.
                      </p>
                      <WatchtowerWorkflows initialRuns={watchtower.runs} playbooks={watchtower.playbooks} labels={watchtower.labels} compact />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div role="status" className="flex min-h-64 items-center justify-center px-4 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                  Select an alert to inspect its case file.
                </div>
              )}
              <div aria-live="polite" className="sr-only">{feedback}</div>
            </section>
          </div>
        )}
      </div>
      <PushNotificationPrompt open={notificationOpen} labels={notificationLabels} onDismiss={() => setNotificationOpen(false)} />
    </Screen>
  );
}

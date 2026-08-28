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

const JA_ALERT_TEXT: Record<string, readonly [string, string]> = {
  "Large-load power interconnection crossed 1GW": [
    "大口電力接続の申請が1GWを超過",
    "Entergy Louisiana, LLCがER26-2042で2,200MW分の電力接続資料を提出しました。"
  ],
  "Potential SPV-linked construction permit": [
    "特別目的会社との関連が疑われる建築許可",
    "Laidley LLCが、出典で確認できる土地関連の申請に記載されました。"
  ],
  "Compute region expansion signal": [
    "計算拠点の拡張を示す兆候",
    "Microsoftが計算拠点の拡張を示す資料を公開しました。"
  ],
  "Large industrial water request detected": [
    "大規模な産業用水の申請を検知",
    "Laidley LLCが水道当局に日量4,800,000ガロンの供給を申請しました。"
  ],
  "Narrative divergence trigger": [
    "報道・言説との乖離を検知",
    "報道資料が現実の兆候と食い違う可能性があります。事実ではなく、確認のきっかけとして扱ってください。"
  ]
};

const JA_EVIDENCE_TITLES: Record<string, string> = {
  "FERC docket ER26-2042": "FERC案件 ER26-2042",
  "Richland Parish, LA building permit RP-DC-2026-0518": "米ルイジアナ州リッチランド郡の建築許可 RP-DC-2026-0518",
  "Microsoft compute region US Southeast AI region": "Microsoftの米国南東部AI拠点",
  "Richland Parish Water District water filing WTR-2026-0042": "米ルイジアナ州リッチランド郡水道当局の申請 WTR-2026-0042",
  "Meta says no near-term Louisiana data center announcement is planned": "Metaはルイジアナ州のデータセンターについて近日中の発表予定はないと説明"
};

function localizeAlertJa(alert: Alert): Alert {
  const localized = JA_ALERT_TEXT[alert.title];
  return {
    ...alert,
    title: localized?.[0] ?? alert.title,
    description: localized?.[1] ?? alert.description,
    evidence: alert.evidence.map((evidence) => ({
      ...evidence,
      title: evidence.title ? (JA_EVIDENCE_TITLES[evidence.title] ?? evidence.title) : evidence.title
    }))
  };
}

type Messages = {
  title: string;
  panels: { queue: string; chain: string; watchtower?: string };
  markAllRead: string;
  unread: string;
  viewList: string;
  viewGrouped: string;
  watchtower: WatchtowerLabels;
  notifications?: PushNotificationPromptLabels;
  locale?: "en" | "ja";
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

function priorityLabel(priority: string, locale: "en" | "ja" = "en") {
  if (locale !== "ja") return priority;
  return ({ critical: "最重要", high: "高", medium: "中", low: "低" } as Record<string, string>)[priority.toLowerCase()] ?? priority;
}

function percent(value: number | undefined) {
  return Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100) + "%";
}

function formatAsOf(value?: string, locale: "en" | "ja" = "en") {
  if (!value) return locale === "ja" ? "出典の観測" : "Source observation";
  return value.length > 10 ? value.slice(0, 10) : value;
}

function extractEntityName(title: string): string {
  const stopWords = /\b(sec|8-k|s-1|filing|alert|signal|permit|acquisition|investment|capital|fund|report)\b/i;
  const words = title.split(/\s+/);
  const stopIndex = words.findIndex((word) => stopWords.test(word));
  const entityWords = stopIndex > 0 ? words.slice(0, stopIndex) : words.slice(0, 2);
  return entityWords.join(" ") || title.slice(0, 30);
}

function ConfidenceMeter({ value, label = "Confidence" }: Readonly<{ value: number; label?: string }>) {
  const safeValue = Math.max(0, Math.min(1, value));
  return (
    <div className="min-w-0">
      <div className="mono mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
        <span>{label}</span>
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

function EvidenceThread({ alert, locale = "en" }: Readonly<{ alert: Alert; locale?: "en" | "ja" }>) {
  const entity = extractEntityName(alert.title);
  const sourceTitle = alert.evidence[0]?.title ?? alert.source;
  const isJa = locale === "ja";
  const steps = [
    { label: isJa ? "出典" : "Source", value: sourceTitle, state: isJa ? "確認済み" : "verified" },
    { label: isJa ? "対象" : "Entity", value: entity, state: isJa ? "特定済み" : "resolved" },
    { label: isJa ? "兆候" : "Signal", value: alert.title, state: isJa ? "発生中" : "active" },
    { label: isJa ? "行動" : "Action", value: isJa ? "内容を確認" : "Review case file", state: isJa ? "準備完了" : "ready" }
  ];

  return (
    <ol aria-label={isJa ? "根拠の流れ" : "Evidence thread"} className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
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
            style={{ color: index === 2 ? "var(--signal)" : "var(--evidence)" }}
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
  const isJa = messages.locale === "ja";
  const displayAlerts = useMemo(() => isJa ? alerts.map(localizeAlertJa) : alerts, [alerts, isJa]);
  const ui = {
    notifications: isJa ? "通知" : "Notifications",
    triage: isJa ? "優先度確認 / 重要な変化" : "Triage / newest material changes",
    total: isJa ? "合計" : "total",
    loading: isJa ? "通知一覧を読み込み中…" : "Loading alert queue…",
    selectSignal: isJa ? "兆候を選択して案件を開きます。" : "Select a signal to open its case file.",
    queueView: isJa ? "一覧表示" : "Queue view",
    noAlerts: isJa ? "現在、確認が必要な通知はありません。出典に基づく新しい変化がここに表示されます。" : "No active alerts. New source-backed changes will appear here.",
    unread: isJa ? "未読" : "Unread",
    markedRead: isJa ? "通知を既読にしました" : "Alert marked as read",
    allMarkedRead: isJa ? "すべての通知を既読にしました" : "All alerts marked as read",
    queue: isJa ? "一覧" : "Queue",
    caseFile: isJa ? "案件" : "Case file",
    signal: isJa ? "兆候" : "Signal",
    openSource: isJa ? "出典を開く ↗" : "Open source ↗",
    relevance: isJa ? "関連度" : "Relevance",
    confidence: isJa ? "信頼度" : "Confidence",
    source: isJa ? "出典" : "Source",
    asOf: isJa ? "基準日" : "As of",
    evidence: isJa ? "根拠" : "Evidence",
    sourceBacked: isJa ? "出典に基づく" : "source-backed",
    evidenceRecords: isJa ? "根拠記録" : "Evidence records",
    view: isJa ? "表示" : "View",
    noEvidence: isJa ? "このアラートには根拠記録がありません。" : "No evidence records attached to this alert.",
    automationHint: isJa ? "承認制の自動処理です。根拠が整った場合のみ開始または再実行してください。" : "Approval-gated workflow trace. Start or rerun automation only when the evidence is ready.",
    selectAlert: isJa ? "通知を選択して案件を確認します。" : "Select an alert to inspect its case file.",
    backAria: isJa ? "通知一覧へ戻る" : "Back to alert queue",
    detailAria: isJa ? "選択中の通知の詳細" : "Selected alert detail"
  };
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
    () => displayAlerts.find((alert) => alert.id === selectedId) ?? displayAlerts[0],
    [displayAlerts, selectedId]
  );
  const allIds = useMemo(() => alerts.map((alert) => alert.id), [alerts]);
  const unreadCount = useMemo(
    () => alerts.filter((alert) => !readAlertSet.has(alert.id)).length,
    [alerts, readAlertSet]
  );

  const groups = useMemo<AlertGroup[]>(() => {
    const grouped = new Map<string, Alert[]>();
    for (const alert of displayAlerts) {
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
  }, [displayAlerts]);

  function handleSelectAlert(id: string) {
    setSelectedId(id);
    markRead(id);
    setMobileDetailOpen(true);
    setDetailTab("case");
    setFeedback(ui.markedRead);
  }

  function handleMarkAllRead() {
    markAllRead(allIds);
    setFeedback(ui.allMarkedRead);
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
            <span aria-label={ui.unread} className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--signal)" }} />
          ) : (
            <span className="h-2 w-2 shrink-0" aria-hidden="true" />
          )}
          <span className="mono text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: priorityColor(alert.priority) }}>
            {priorityLabel(alert.priority, messages.locale)}
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
          <ConfidenceMeter value={alert.confidence} label={ui.confidence} />
        </span>
      </button>
    );
  }

  const notificationLabels = messages.notifications ?? (isJa ? {
    title: "重要なアラートのブラウザ通知を許可しますか？",
    enable: "通知を有効化",
    dismiss: "今はしない",
    busy: "処理中…"
  } : DEFAULT_NOTIFICATION_LABELS);

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
          {ui.notifications}
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
              {ui.triage}
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {unreadCount} {messages.unread} · {alerts.length} {ui.total}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton type="alerts" label={isJa ? "エクスポート" : "Export"} />
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
              {ui.loading}
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
                    {isJa ? "通知一覧" : messages.panels.queue}
                  </h2>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {ui.selectSignal}
                  </p>
                </div>
                <div role="tablist" aria-label={ui.queueView} className="flex border" style={{ borderColor: "var(--line-soft)" }}>
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
                  {ui.noAlerts}
                </div>
              ) : viewMode === "list" ? (
                <div>{displayAlerts.map((alert) => renderAlertRow(alert))}</div>
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
                            <span className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: priorityColor(group.highestPriority) }}>{priorityLabel(group.highestPriority, messages.locale)}</span>
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
              aria-label={ui.detailAria}
              className={"alerts-workstation-detail " + (mobileDetailOpen ? "block" : "hidden lg:block") + " min-h-[calc(100dvh-12rem)] border-y lg:min-h-0"}
              style={{ borderColor: "var(--line-soft)" }}
            >
              <div className="flex min-h-11 items-center justify-between border-b px-3 lg:hidden" style={{ borderColor: "var(--line-soft)" }}>
                <WorkstationButton
                  type="button"
                  onClick={() => setMobileDetailOpen(false)}
                  aria-label={ui.backAria}
                  className="mono border-0 px-2 text-[11px] uppercase tracking-[0.08em]"
                >
                  ← {ui.queue}
                </WorkstationButton>
                <span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{ui.caseFile}</span>
              </div>

              {selectedAlert ? (
                <div>
                  <header className="border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--line-soft)" }}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: priorityColor(selectedAlert.priority) }}>{priorityLabel(selectedAlert.priority, messages.locale)}</span>
                      <span className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-quaternary)" }}>{ui.signal} / {selectedAlert.source}</span>
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
                        {ui.openSource}
                      </a>
                    ) : null}
                  </header>

                  <dl className="grid grid-cols-2 border-b sm:grid-cols-4" style={{ borderColor: "var(--line-soft)" }}>
                    {[
                      [ui.relevance, percent(selectedAlert.relevance ?? selectedAlert.confidence), "var(--signal)"],
                      [ui.confidence, percent(selectedAlert.confidence), "var(--evidence)"],
                      [ui.source, selectedAlert.source, "var(--text-primary)"],
                      [ui.asOf, formatAsOf(selectedAlert.asOf ?? selectedAlert.createdAt ?? selectedAlert.evidence[0]?.observedAt, messages.locale), "var(--text-primary)"]
                    ].map(([label, value, color]) => (
                      <div key={label} className="border-r px-3 py-3 last:border-r-0" style={{ borderColor: "var(--line-soft)" }}>
                        <dt className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>{label}</dt>
                        <dd className="mt-1 truncate text-[12px]" style={{ color }}>{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {watchtower ? (
                    <div role="tablist" aria-label={ui.detailAria} className="flex border-b px-4 sm:px-5" style={{ borderColor: "var(--line-soft)" }}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={detailTab === "case"}
                        onClick={() => setDetailTab("case")}
                        className="mono min-h-11 border-b-2 px-1 text-[11px] uppercase tracking-[0.08em] transition-colors duration-[var(--motion-state)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] motion-reduce:transition-none"
                        style={{ borderColor: detailTab === "case" ? "var(--signal)" : "transparent", color: detailTab === "case" ? "var(--signal)" : "var(--text-tertiary)" }}
                      >
                        {ui.evidence}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={detailTab === "automation"}
                        onClick={() => setDetailTab("automation")}
                        className="mono ml-5 min-h-11 border-b-2 px-1 text-[11px] uppercase tracking-[0.08em] transition-colors duration-[var(--motion-state)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] motion-reduce:transition-none"
                        style={{ borderColor: detailTab === "automation" ? "var(--signal)" : "transparent", color: detailTab === "automation" ? "var(--signal)" : "var(--text-tertiary)" }}
                      >
                        {isJa ? "Watchtower 自動処理" : messages.panels.watchtower ?? watchtower.labels.title}
                      </button>
                    </div>
                  ) : null}

                  {detailTab === "case" || !watchtower ? (
                    <div>
                      <details className="border-b px-4 py-3 sm:px-5">
                        <summary className="min-h-11 cursor-pointer list-none py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]">
                          <span className="flex items-center justify-between gap-3"><span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-primary)" }}>{isJa ? "兆候の流れ" : messages.panels.chain}</span><span className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--evidence)" }}>{ui.sourceBacked}</span></span>
                        </summary>
                        <div className="mt-3"><EvidenceThread alert={selectedAlert} locale={messages.locale} /></div>
                      </details>

                      <details className="px-4 py-3 sm:px-5" style={{ borderColor: "var(--line-soft)" }}>
                        <summary className="min-h-11 cursor-pointer list-none py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"><span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{ui.evidenceRecords}</span></summary>
                        {selectedAlert.evidence.length ? (
                          <div>
                            <ul className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
                              {selectedAlert.evidence.map((evidence, index) => (
                                <li key={(evidence.sourceId ?? "source") + "-" + index} className="flex min-h-11 items-center justify-between gap-3 py-2">
                                  <span className="min-w-0">
                                    <span className="block truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{evidence.title ?? evidence.sourceId ?? (isJa ? "出典記録" : "Source record")}</span>
                                    <span className="mono mt-0.5 block truncate text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-quaternary)" }}>{evidence.sourceId ?? selectedAlert.source}</span>
                                  </span>
                                  {evidence.url ? (
                                    <a
                                      href={evidence.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      aria-label={(isJa ? "出典を開く: " : "Open: ") + (evidence.title ?? evidence.sourceId ?? (isJa ? "出典" : "source"))}
                                      className="mono flex min-h-11 shrink-0 items-center px-2 text-[11px] uppercase tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--evidence)]"
                                      style={{ color: "var(--evidence)" }}
                                    >
                                      {ui.view}
                                    </a>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p role="status" className="py-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>{ui.noEvidence}</p>
                        )}
                      </details>
                    </div>
                  ) : null}

                  {detailTab === "automation" && watchtower ? (
                    <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: "var(--line-soft)" }}>
                      <p className="mb-3 text-[12px]" style={{ color: "var(--text-tertiary)" }}>{ui.automationHint}</p>
                      <WatchtowerWorkflows initialRuns={watchtower.runs} playbooks={watchtower.playbooks} labels={watchtower.labels} compact />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div role="status" className="flex min-h-64 items-center justify-center px-4 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                  {ui.selectAlert}
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

import { Screen } from "@/components/ui/screen";
import { SeedMemoryManager } from "@/components/ui/seed-memory-manager";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { SettingsShell, SETTINGS_ICONS } from "@/components/ui/settings-shell";
import type { SettingsSection } from "@/components/ui/settings-shell";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import { getAdminSettings } from "@/lib/repositories/admin";
import { listSeedMemories } from "@/lib/munin/seed";
import { auditEvents } from "@/lib/data";
import { SourceHealthPanel } from "@/components/ui/source-health-panel";
import { HuginnTemplateEditor } from "@/components/ui/huginn-template-editor";
import type { SourceHealthEntry } from "@/components/ui/source-health-panel";
import { AlertRuleBuilder } from "@/components/ui/alert-rule-builder";
import { WebhookSettings } from "@/components/ui/webhook-settings";
import { WatchtowerWorkflows } from "@/components/ui/watchtower-workflows";
import { AuditExportControls } from "@/components/ui/audit-export-controls";
import { sourceBackedPlan } from "@/lib/data";
import { listWatchtowerPlaybooks, listWatchtowerRuns } from "@/lib/repositories/watchtower";
import { buildCalibrationObservations, buildCalibrationReport } from "@/lib/pipeline/calibration";
import { computeSourceAttribution } from "@/lib/pipeline/attribution";
import { checkFreshness } from "@/lib/pipeline/freshness";

const defaultSettingsOrgId = process.env.DEFAULT_ORG_ID || "11111111-1111-4111-8111-111111111111";

function shortDate(value?: string) {
  if (!value) return "not recorded";
  return value.slice(0, 10) + " UTC";
}

function isStuckRunning(startedAt: string): boolean {
  return Date.now() - new Date(startedAt).getTime() > 2 * 60 * 60 * 1000;
}

function buildHealthEntries(
  watermarks: { sourceId: string; lastSuccessAt: string; lastObservedAt?: string; rawSignalCount: number }[]
): SourceHealthEntry[] {
  const freshness = new Map(checkFreshness(watermarks).map((entry) => [entry.sourceId, entry]));
  return watermarks.map((watermark) => {
    const entry = freshness.get(watermark.sourceId);
    return {
      sourceId: watermark.sourceId,
      lastSuccessAt: watermark.lastSuccessAt ?? null,
      lastObservedAt: watermark.lastObservedAt ?? null,
      rawSignalCount: watermark.rawSignalCount,
      status: entry?.status === "fresh" ? "healthy" : entry?.status === "stale" ? "stale" : "failing",
      slaHours: entry?.slaHours,
      hoursSinceUpdate: entry?.hoursSinceUpdate
    };
  });
}

export default async function SettingsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.settings;
  const settings = await getAdminSettings({ orgId: defaultSettingsOrgId });
  const seeds = await listSeedMemories(defaultSettingsOrgId);
  const watchtower = await listWatchtowerRuns({ orgId: defaultSettingsOrgId });
  const orgLabel = settings.org
    ? `${settings.org.name} / ${settings.org.tier}`
    : locale === "ja" ? "組織未設定 / フォールバック" : "org not configured / fallback";
  const calibration = buildCalibrationReport(
    buildCalibrationObservations(sourceBackedPlan.rawSignals, sourceBackedPlan.alerts)
  );
  const attribution = computeSourceAttribution(sourceBackedPlan.rawSignals, sourceBackedPlan.alerts);

  const sections: SettingsSection[] = [
    {
      id: "alertRules",
      title: screen.panels.alertRules,
      description: screen.copy.alertRules,
      icon: SETTINGS_ICONS.alertRules,
      content: (
        <AlertRuleBuilder
          initialRules={settings.alertRules.map((r) => ({
            id: r.id,
            name: r.name,
            layer: r.layer,
            minConfidence: r.minConfidence,
            destination: r.destination,
            enabled: r.enabled
          }))}
          messages={screen.alertRuleBuilder}
        />
      )
    },
    {
      id: "watchtower",
      title: screen.panels.watchtower,
      description: screen.copy.watchtower,
      icon: SETTINGS_ICONS.alertRules,
      content: (
        <WatchtowerWorkflows
          initialRuns={watchtower.runs}
          playbooks={listWatchtowerPlaybooks()}
          labels={screen.watchtower}
        />
      )
    },
    {
      id: "apiKeys",
      title: screen.panels.apiKeys,
      description: screen.copy.apiKeys,
      icon: SETTINGS_ICONS.apiKeys,
      content: (
        <>
          <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
            {locale === "ja" ? "ハッシュ済みキー / ワンタイム発行" : "hashed keys / one-time token issue"}
          </div>
          <div className="mt-4 grid gap-2.5">
            {settings.apiKeys.map((key) => (
              <div
                className="pb-3"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={key.id}
              >
                <div className="flex items-center justify-between text-[13px]">
                  <span style={{ color: "var(--text-primary)" }} className="truncate">{key.name}</span>
                  <span className="mono shrink-0" style={{ color: "var(--rune)" }}>{key.prefix}…</span>
                </div>
                <div className="mono mt-1 text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>
                  {key.scopes.join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </>
      )
    },
    {
      id: "permissions",
      title: screen.panels.permissions,
      description: screen.copy.permissions,
      icon: SETTINGS_ICONS.permissions,
      content: (
        <>
          <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
            {orgLabel}
          </div>
          <div className="mt-4 grid gap-2.5">
            {settings.members.map((member) => (
              <div
                className="flex items-center justify-between pb-3"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={member.id}
              >
                <span className="truncate text-[13px]" style={{ color: "var(--text-primary)" }}>
                  {member.displayName}
                </span>
                <span className="mono shrink-0 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </>
      )
    },
    {
      id: "customKnowledge",
      title: screen.panels.customKnowledge,
      description: screen.copy.customKnowledge,
      icon: SETTINGS_ICONS.customKnowledge,
      content: (
        <SeedMemoryManager
          initialSeeds={seeds.map((seed) => ({
            id: seed.id,
            kind: seed.kind,
            content: seed.content,
            orgId: seed.orgId
          }))}
          labels={screen.seed}
          orgId={defaultSettingsOrgId}
        />
      )
    },
    {
      id: "huginnTemplates",
      title: screen.huginnTemplates.title,
      description: locale === "ja" ? "Huginnのクイックテンプレートを管理・カスタマイズします。" : "Manage and customize Huginn quick templates.",
      icon: SETTINGS_ICONS.customKnowledge,
      content: <HuginnTemplateEditor messages={screen.huginnTemplates} />
    },
    {
      id: "ingestion",
      title: locale === "ja" ? "取込オペレーション" : "Ingestion Operations",
      description: screen.copy.ingestion,
      icon: SETTINGS_ICONS.ingestion,
      content: (
        <>
          <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
            {settings.source} · scheduled scrape / backfill observability
          </div>
          <div className="mt-4 grid gap-3">
            {settings.source === "supabase" && settings.ingestionRuns.length === 0 ? (
              <div className="mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
                no runs recorded — if scrape has run, verify service_role permissions on ingestion_runs
              </div>
            ) : null}
            {settings.ingestionRuns.map((run) => {
              const stuck = run.status === "running" && isStuckRunning(run.startedAt);
              const statusColor = run.status === "failed" || stuck ? "var(--critical)" : "var(--rune)";
              return (
                <div
                  className="pb-3"
                  style={{ borderBottom: "1px solid var(--line-faint)" }}
                  key={run.id}
                >
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="mono uppercase" style={{ color: "var(--text-primary)" }}>
                      {run.mode} / {run.status}{stuck ? " ⚠ stuck" : ""}
                    </span>
                    <span className="mono shrink-0" style={{ color: statusColor }}>
                      {run.rawSignalCount} signals
                    </span>
                  </div>
                  <div className="mono mt-1 text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>
                    {shortDate(run.startedAt)} · limit {run.sourceLimit} · {run.alertCount} alerts
                  </div>
                  {run.error ? (
                    <div className="mt-2 text-[12px]" style={{ color: "var(--critical)" }}>
                      {run.error}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid gap-2">
            {settings.source === "supabase" && settings.sourceWatermarks.length === 0 ? (
              <div className="mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
                no watermarks recorded
              </div>
            ) : null}
            {settings.sourceWatermarks.map((watermark) => (
              <div
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 text-[12px]"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={watermark.sourceId}
              >
                <span className="truncate" style={{ color: "var(--text-primary)" }}>{watermark.sourceId}</span>
                <span className="mono" style={{ color: "var(--text-secondary)" }}>{shortDate(watermark.lastObservedAt)}</span>
                <span className="mono" style={{ color: "var(--rune)" }}>{watermark.rawSignalCount}</span>
              </div>
            ))}
          </div>
        </>
      )
    },
    {
      id: "auditLog",
      title: screen.panels.auditLog,
      description: screen.copy.auditLog,
      icon: SETTINGS_ICONS.auditLog,
      content: (
        <>
          <AuditExportControls />
          <div className="mt-4 max-h-[420px] overflow-y-auto">
            {auditEvents.map((event) => (
              <div
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 py-2.5 text-[13px] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--ink-750)]"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={event.id}
              >
                <span className="mono truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{event.event}</span>
                <span className="truncate" style={{ color: "var(--text-secondary)" }}>{event.actor}</span>
                <span className="mono truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>{event.source}</span>
                <span className="mono text-right text-[12px]" style={{ color: "var(--rune)" }}>{event.confidence}</span>
              </div>
            ))}
          </div>
        </>
      )
    },
    {
      id: "ontology",
      title: screen.panels.ontology,
      description: screen.copy.ontology,
      icon: SETTINGS_ICONS.ontology,
      content: (
        <>
          <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
            {locale === "ja" ? "公開・組織別分離" : "public-or-org isolation"}
          </div>
          <div className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {locale === "ja"
              ? "オントロジー・アラート・監査・APIキー・Muninのデータパスは、org_idまたは公開可視性でスコープ管理されています。"
              : "Ontology, alert, audit, API key, and Munin data paths are scoped by org_id or public visibility."}
          </div>
          <div className="mono mt-4 text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>
            {locale === "ja" ? "出典バックドコントロール / RLS適用" : "source-backed control / rls-backed"}
          </div>
        </>
      )
    },
    {
      id: "sourceHealth",
      title: screen.sourceHealth.title,
      description: locale === "ja" ? "データソースの状態・最終成功時刻・シグナル数を表示します。" : "Data source status, last success time, and signal counts.",
      icon: SETTINGS_ICONS.ingestion,
      content: (
        <div className="grid gap-5">
          <SourceHealthPanel
            sources={buildHealthEntries(settings.sourceWatermarks)}
            messages={screen.sourceHealth}
            attribution={attribution}
          />
          <div>
            <div className="mono mb-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
              {locale === "ja" ? "信頼度較正" : "Confidence calibration"}
            </div>
            <div className="grid gap-2">
              {calibration.buckets.filter((bucket) => bucket.count > 0).slice(0, 6).map((bucket) => (
                <div key={bucket.range.join("-")} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 text-[12px]">
                  <span className="mono" style={{ color: "var(--text-secondary)" }}>
                    {bucket.range[0].toFixed(1)}-{bucket.range[1].toFixed(1)}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-secondary)" }}>
                    <div className="h-full rounded-full" style={{ width: `${bucket.actual * 100}%`, background: "var(--rune)" }} />
                  </div>
                  <span className="mono" style={{ color: "var(--text-secondary)" }}>
                    {Math.round(bucket.actual * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="mono mt-3 text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
              Brier {calibration.overallBrier.toFixed(3)}
            </div>
          </div>
        </div>
      )
    },
    {
      id: "webhook",
      title: screen.webhook.title,
      description: locale === "ja" ? "Slack通知Webhookの状態確認とテスト送信です。" : "Slack notification webhook status and test.",
      icon: SETTINGS_ICONS.alertRules,
      content: (
        <WebhookSettings
          isConfigured={!!process.env.SLACK_WEBHOOK_URL}
          messages={screen.webhook}
        />
      )
    },
    {
      id: "language",
      title: screen.language.panel,
      description: screen.language.description,
      icon: SETTINGS_ICONS.language,
      content: (
        <div className="flex items-center justify-between gap-4">
          <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {screen.language.description}
          </div>
          <LocaleSwitcher current={locale} />
        </div>
      )
    }
  ];

  return (
    <Screen title={screen.title}>
      <SettingsShell sections={sections} />
    </Screen>
  );
}

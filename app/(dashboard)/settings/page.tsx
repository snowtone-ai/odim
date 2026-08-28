import type { Metadata } from "next";

export const dynamic = "force-dynamic";

import { Screen } from "@/components/ui/screen";
import { SeedMemoryManager } from "@/components/ui/seed-memory-manager";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { SettingsShell, SETTINGS_ICONS } from "@/components/ui/settings-shell";
import type { SettingsSection } from "@/components/ui/settings-shell";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import { getAdminSettings, type IngestionRun, type SourceWatermark } from "@/lib/repositories/admin";
import { listSeedMemories } from "@/lib/munin/seed";
import { auditEvents } from "@/lib/data";
import { SourceHealthPanel } from "@/components/ui/source-health-panel";
import { HuginnTemplateEditor } from "@/components/ui/huginn-template-editor";
import { AlertRuleBuilder } from "@/components/ui/alert-rule-builder";
import { WebhookSettings } from "@/components/ui/webhook-settings";
import { WatchtowerWorkflows } from "@/components/ui/watchtower-workflows";
import { AuditExportControls } from "@/components/ui/audit-export-controls";
import { BillingPanel } from "@/components/ui/billing-panel";
import { ApiKeyManager } from "@/components/ui/api-key-manager";
import { OrgMembersPanel } from "@/components/ui/org-members-panel";
import { ALLOWED_API_KEY_SCOPES, DEFAULT_API_KEY_SCOPES } from "@/lib/auth/api-keys";
import { listInvites } from "@/lib/repositories/onboarding";
import { sourceBackedPlan } from "@/lib/data";
import { billingEnabled } from "@/lib/billing/stripe";
import { getOrgBilling } from "@/lib/repositories/billing";
import { listWatchtowerPlaybooks, listWatchtowerRuns } from "@/lib/repositories/watchtower";
import { listPendingMemoryProposals } from "@/lib/munin/proposals";
import { buildCalibrationObservations, buildCalibrationReport } from "@/lib/pipeline/calibration";
import { computeSourceAttribution } from "@/lib/pipeline/attribution";
import { buildSourceHealthEntries } from "@/lib/pipeline/source-health";
import { MuninReviewQueue } from "@/components/ui/munin-review-queue";
import { getMuninReviewContext } from "@/lib/munin/review-auth";
import sourcesConfig from "../../../config/sources.json" with { type: "json" };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === "ja" ? "設定" : "Settings" };
}

function shortDate(value: string | undefined, locale: "en" | "ja") {
  if (!value) return locale === "ja" ? "記録なし" : "Not recorded";
  return value.slice(0, 10) + " UTC";
}

function isStuckRunning(startedAt: string): boolean {
  return Date.now() - new Date(startedAt).getTime() > 2 * 60 * 60 * 1000;
}

function ingestionModeLabel(mode: IngestionRun["mode"], locale: "en" | "ja") {
  if (locale !== "ja") return mode;
  return { daily: "定期収集", backfill: "過去データ補完", "dry-run": "試行" }[mode];
}

function ingestionStatusLabel(status: IngestionRun["status"], locale: "en" | "ja") {
  if (locale !== "ja") return status;
  return { running: "実行中", succeeded: "完了", failed: "失敗" }[status];
}

function auditEventLabel(event: string, locale: "en" | "ja") {
  if (locale !== "ja") return event;
  return ({
    raw_signal_ingested: "情報を取得",
    ontology_object_upserted: "対象情報を更新",
    ontology_link_upserted: "関連情報を更新",
    alert_created: "アラートを作成"
  } as Record<string, string>)[event] ?? "システム操作";
}

const configuredSources = sourcesConfig.sources.map((source) => ({ id: source.id, enabled: source.enabled }));

function buildHealthEntries(ingestionRuns: IngestionRun[], watermarks: SourceWatermark[], forceFixtureOnly: boolean) {
  return buildSourceHealthEntries(configuredSources, ingestionRuns, watermarks, forceFixtureOnly);
}

export default async function SettingsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.settings;
  const ui = locale === "ja"
    ? {
        runSource: "収集状況",
        sampleSource: "サンプルデータ",
        scheduledStatus: "定期収集と過去データ補完の実行状況",
        noRuns: "実行履歴はまだありません。収集を実行済みの場合は、データベースの権限を確認してください。",
        noWatermarks: "情報源ごとの更新記録はまだありません。",
        signals: "件取得",
        alerts: "件のアラート",
        sourceLimit: "対象上限",
        stuck: "長時間実行中",
        calibration: "信頼度の精度",
        auditActor: "実行者",
        auditSource: "情報源"
      }
    : {
        runSource: "Collection status",
        sampleSource: "Sample data",
        scheduledStatus: "Scheduled collection and backfill activity",
        noRuns: "No runs have been recorded. If collection already ran, check the database permissions.",
        noWatermarks: "No per-source update records have been recorded.",
        signals: "signals",
        alerts: "alerts",
        sourceLimit: "source limit",
        stuck: "running too long",
        calibration: "Confidence calibration",
        auditActor: "Actor",
        auditSource: "Source"
      };
  const reviewContext = await getMuninReviewContext().catch((error: unknown) => {
    console.error("[settings] Munin review context failed:", error instanceof Error ? error.message : error);
    return null;
  });
  if (!reviewContext) {
    return (
      <Screen title={screen.title}>
        <div className="flex flex-col gap-3 p-8">
          <p className="mono text-[13px]" style={{ color: "var(--critical)" }}>
            {locale === "ja"
              ? "管理者の組織セッションを確認できません。"
              : "An authorized organization administrator session is required."}
          </p>
        </div>
      </Screen>
    );
  }
  const settingsOrgId = reviewContext.orgId;
  const reviewQueuePromise = reviewContext
    ? listPendingMemoryProposals(reviewContext.orgId)
        .then((proposals) => ({ proposals, error: undefined as string | undefined }))
        .catch((error: unknown) => {
          console.error("[settings] listPendingMemoryProposals failed:", error instanceof Error ? error.message : error);
          return {
            proposals: [],
            error: locale === "ja" ? "確認待ちの提案を読み込めませんでした。" : "The review queue could not be loaded."
          };
        })
    : Promise.resolve({
        proposals: [],
        error: locale === "ja"
          ? "組織セッションが必要です。"
          : "An authorized organization session is required."
      });
  const [settings, seeds, watchtower, billing, invites, reviewQueue] = await Promise.all([
    getAdminSettings({ orgId: settingsOrgId }).catch((err: Error) => {
      console.error("[settings] getAdminSettings failed:", err.message);
      return null;
    }),
    listSeedMemories(settingsOrgId).catch(() => [] as Awaited<ReturnType<typeof listSeedMemories>>),
    listWatchtowerRuns({ orgId: settingsOrgId }).catch(() => ({ runs: [] as Awaited<ReturnType<typeof listWatchtowerRuns>>["runs"] })),
    getOrgBilling(settingsOrgId).catch((err: Error) => {
      console.error("[settings] getOrgBilling failed:", err.message);
      return null;
    }),
    listInvites({ orgId: settingsOrgId }).catch(() => [] as Awaited<ReturnType<typeof listInvites>>),
    reviewQueuePromise
  ]);

  if (!settings) {
    return (
      <Screen title={screen.title}>
        <div className="flex flex-col gap-3 p-8">
          <p className="mono text-[13px]" style={{ color: "var(--critical)" }}>
            {locale === "ja"
              ? "設定データを読み込めませんでした。データベースマイグレーションが必要な可能性があります。"
              : "Failed to load settings. A database migration may be required."}
          </p>
          <p className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {locale === "ja"
              ? "管理者に連絡するか、マイグレーションスクリプトを実行してください: node scripts/apply-db-migrations.mjs production"
              : "Contact your administrator or run: node scripts/apply-db-migrations.mjs production"}
          </p>
        </div>
      </Screen>
    );
  }

  const orgLabel = settings.org
    ? `${settings.org.name} / ${settings.org.tier}`
    : locale === "ja" ? "ワークスペース未設定 / サンプルデータ" : "Workspace not configured / sample data";
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
          locale={locale}
        />
      )
    },
    ...(billing
      ? [
          {
            id: "billing",
            title: screen.panels.billing,
            description: screen.copy.billing,
            icon: SETTINGS_ICONS.permissions,
            content: (
              <BillingPanel
                plan={billing.plan}
                status={billing.status}
                periodEnd={billing.currentPeriodEnd}
                billingEnabled={billingEnabled()}
                labels={screen.billing}
              />
            )
          } satisfies SettingsSection
        ]
      : []),
    {
      id: "apiKeys",
      title: screen.panels.apiKeys,
      description: screen.copy.apiKeys,
      icon: SETTINGS_ICONS.apiKeys,
      content: (
        <ApiKeyManager
          orgId={settingsOrgId}
          initialKeys={settings.apiKeys.map((key) => ({
            id: key.id,
            name: key.name,
            prefix: key.prefix,
            scopes: key.scopes,
            createdAt: key.createdAt
          }))}
          allowedScopes={[...ALLOWED_API_KEY_SCOPES]}
          defaultScopes={[...DEFAULT_API_KEY_SCOPES]}
          labels={screen.apiKeyManager}
        />
      )
    },
    {
      id: "permissions",
      title: screen.panels.permissions,
      description: screen.copy.permissions,
      icon: SETTINGS_ICONS.permissions,
      content: (
        <OrgMembersPanel
          orgId={settingsOrgId}
          members={settings.members.map((member) => ({
            id: member.id,
            displayName: member.displayName,
            role: member.role
          }))}
          initialInvites={invites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expiresAt
          }))}
          labels={{ ...screen.membersPanel, orgLine: orgLabel }}
        />
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
          orgId={settingsOrgId}
        />
      )
    },
    {
      id: "muninReview",
      title: locale === "ja" ? "Muninの確認" : "Munin review",
      description: locale === "ja"
        ? "AIが記憶への追加を提案した情報を、出典と基準時点を確かめてから承認します。"
        : "Review AI-proposed memory with its source and as-of time before explicit approval.",
      icon: SETTINGS_ICONS.customKnowledge,
      content: (
        <MuninReviewQueue
          initialProposals={reviewQueue.proposals}
          initialError={reviewQueue.error}
          locale={locale === "ja" ? "ja" : "en"}
        />
      )
    },
    {
      id: "huginnTemplates",
      title: screen.huginnTemplates.title,
      description: locale === "ja" ? "Huginnですぐ使える質問例を管理します。" : "Manage and customize Huginn quick templates.",
      icon: SETTINGS_ICONS.customKnowledge,
      content: <HuginnTemplateEditor messages={screen.huginnTemplates} locale={locale} />
    },
    {
      id: "ingestion",
      title: locale === "ja" ? "情報収集" : "Data collection",
      description: screen.copy.ingestion,
      icon: SETTINGS_ICONS.ingestion,
      content: (
        <>
          <div className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
            {settings.source === "supabase" ? "Supabase" : ui.sampleSource} · {ui.scheduledStatus}
          </div>
          <div className="mt-4 grid gap-3">
            {settings.source === "supabase" && settings.ingestionRuns.length === 0 ? (
              <div className="mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {ui.noRuns}
              </div>
            ) : null}
            {settings.ingestionRuns.map((run) => {
              const stuck = run.status === "running" && isStuckRunning(run.startedAt);
              const statusColor = run.status === "failed" || stuck ? "var(--critical)" : "var(--signal)";
              return (
                <div
                  className="pb-3"
                  style={{ borderBottom: "1px solid var(--line-faint)" }}
                  key={run.id}
                >
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="mono uppercase" style={{ color: "var(--text-primary)" }}>
                      {ingestionModeLabel(run.mode, locale)} / {ingestionStatusLabel(run.status, locale)}{stuck ? ` ⚠ ${ui.stuck}` : ""}
                    </span>
                    <span className="mono shrink-0" style={{ color: statusColor }}>
                      {run.rawSignalCount} {ui.signals}
                    </span>
                  </div>
                  <div className="mono mt-1 text-[11px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>
                    {shortDate(run.startedAt, locale)} · {ui.sourceLimit} {run.sourceLimit} · {run.alertCount} {ui.alerts}
                  </div>
                  {run.error ? (
                    <div className="mt-2 text-[12px]" style={{ color: "var(--critical)" }}>
                      {locale === "ja" ? "収集中に問題が発生しました。詳細は監査記録を確認してください。" : run.error}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid gap-2">
            {settings.source === "supabase" && settings.sourceWatermarks.length === 0 ? (
              <div className="mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {ui.noWatermarks}
              </div>
            ) : null}
            {settings.sourceWatermarks.map((watermark) => (
              <div
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 text-[12px]"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={watermark.sourceId}
              >
                <span className="truncate" style={{ color: "var(--text-primary)" }}>{watermark.sourceId}</span>
                <span className="mono" style={{ color: "var(--text-secondary)" }}>{shortDate(watermark.lastObservedAt, locale)}</span>
                <span className="mono" style={{ color: "var(--signal)" }}>{watermark.rawSignalCount}</span>
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
          <AuditExportControls locale={locale} />
          <div className="mt-4 max-h-[420px] overflow-y-auto">
            {auditEvents.map((event) => (
              <div
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 py-2.5 text-[13px] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] motion-reduce:transition-none"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={event.id}
              >
                <span className="mono truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{auditEventLabel(event.event, locale)}</span>
                <span className="truncate" style={{ color: "var(--text-secondary)" }}>{event.actor}</span>
                <span className="mono truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>{event.source}</span>
                <span className="mono text-right text-[12px]" style={{ color: "var(--signal)" }}>{event.confidence}</span>
              </div>
            ))}
          </div>
        </>
      )
    },
    {
      id: "sourceHealth",
      title: screen.sourceHealth.title,
      description: locale === "ja" ? "情報源の状態、最終取得時刻、取得件数を確認します。" : "Data source status, last success time, and signal counts.",
      icon: SETTINGS_ICONS.ingestion,
      content: (
        <div className="grid gap-5">
          <SourceHealthPanel
            sources={buildHealthEntries(settings.ingestionRuns, settings.sourceWatermarks, settings.source === "fallback")}
            messages={screen.sourceHealth}
            attribution={attribution}
            locale={locale}
          />
          <div>
            <div className="mono mb-2 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
              {ui.calibration}
            </div>
            <div className="grid gap-2">
              {calibration.buckets.filter((bucket) => bucket.count > 0).slice(0, 6).map((bucket) => (
                <div key={bucket.range.join("-")} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 text-[12px]">
                  <span className="mono" style={{ color: "var(--text-secondary)" }}>
                    {bucket.range[0].toFixed(1)}-{bucket.range[1].toFixed(1)}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-secondary)" }}>
                    <div className="h-full" style={{ width: `${bucket.actual * 100}%`, background: "var(--signal)" }} />
                  </div>
                  <span className="mono" style={{ color: "var(--text-secondary)" }}>
                    {Math.round(bucket.actual * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="mono mt-3 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
              Brier {calibration.overallBrier.toFixed(3)}
            </div>
          </div>
        </div>
      )
    },
    {
      id: "webhook",
      title: screen.webhook.title,
      description: locale === "ja" ? "Slackへの通知が届くか確認し、通知する最低優先度を設定します。" : "Check Slack delivery and set the minimum priority to notify.",
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

  const order = ["language", "alertRules", "webhook", "watchtower", "huginnTemplates", "customKnowledge", "muninReview", "sourceHealth", "ingestion", "permissions", "apiKeys", "billing", "auditLog"];
  const orderedSections = [...sections].sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));

  return (
    <Screen title={screen.title}>
      <SettingsShell
        sections={orderedSections}
        categoryLabels={locale === "ja"
          ? {
              general: "基本設定",
              notifications: "通知",
              intelligence: "分析と記憶",
              data: "情報源",
              workspace: "メンバーとアクセス",
              audit: "監査記録"
            }
          : undefined}
        interfaceLabels={locale === "ja"
          ? {
              navigation: "設定項目",
              categories: "設定",
              section: "設定項目",
              empty: "利用できる設定はありません。",
              back: "設定一覧"
            }
          : undefined}
      />
    </Screen>
  );
}

import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { SeedMemoryManager } from "@/components/ui/seed-memory-manager";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import { getAdminSettings } from "@/lib/repositories/admin";
import { listSeedMemories } from "@/lib/munin/seed";
import { auditEvents } from "@/lib/data";

const defaultSettingsOrgId = process.env.DEFAULT_ORG_ID || "11111111-1111-4111-8111-111111111111";

function shortDate(value?: string) {
  if (!value) return "not recorded";
  return value.slice(0, 10) + " UTC";
}

// M-1: scrape が "running" のまま 2 時間以上経過している場合をスタックとみなす
function isStuckRunning(startedAt: string): boolean {
  return Date.now() - new Date(startedAt).getTime() > 2 * 60 * 60 * 1000;
}

export default async function SettingsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.settings;
  const settings = await getAdminSettings({ orgId: defaultSettingsOrgId });
  const seeds = await listSeedMemories(defaultSettingsOrgId);
  const orgLabel = settings.org
    ? `${settings.org.name} / ${settings.org.tier}`
    : locale === "ja" ? "組織未設定 / フォールバック" : "org not configured / fallback";

  return (
    <Screen title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

        <Panel title={screen.panels.alertRules}>
          <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
            {settings.source} · {locale === "ja" ? "出典バックドルール" : "source-backed rules"}
          </div>
          <div className="mt-4 grid gap-2.5">
            {settings.alertRules.map((rule) => (
              <div
                className="pb-3"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={rule.id}
              >
                <div className="flex items-center justify-between text-[13px]">
                  <span style={{ color: "var(--text-primary)" }} className="truncate">{rule.name}</span>
                  <span className="mono shrink-0" style={{ color: "var(--rune)" }}>
                    {Math.round(rule.minConfidence * 100)}%
                  </span>
                </div>
                <div className="mono mt-1 text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>
                  {rule.layer} · {rule.destination} · {rule.enabled ? (locale === "ja" ? "有効" : "enabled") : (locale === "ja" ? "無効" : "disabled")}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={screen.panels.apiKeys}>
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
        </Panel>

        <Panel title={screen.panels.permissions}>
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
                <span className="mono shrink-0 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={screen.panels.seedMemory}>
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
        </Panel>

        <Panel title="Ingestion Operations">
          {/* M-3: fallback 表示時は明示的にデモデータであることを示す */}
          <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
            {settings.source} · scheduled scrape / backfill observability
          </div>
          <div className="mt-4 grid gap-3">
            {/* H-2: service_role 権限不足などで Supabase から空が返った場合に警告 */}
            {settings.source === "supabase" && settings.ingestionRuns.length === 0 ? (
              <div className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                no runs recorded — if scrape has run, verify service_role permissions on ingestion_runs
              </div>
            ) : null}
            {settings.ingestionRuns.map((run) => {
              // M-1: running のまま 2 時間以上経過していればスタックとみなして警告色
              const stuck = run.status === "running" && isStuckRunning(run.startedAt);
              const statusColor = run.status === "failed" || stuck
                ? "var(--critical)"
                : run.status === "running"
                ? "var(--rune)"
                : "var(--rune)";
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
              <div className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
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
                <span className="mono" style={{ color: "var(--text-tertiary)" }}>{shortDate(watermark.lastObservedAt)}</span>
                <span className="mono" style={{ color: "var(--rune)" }}>{watermark.rawSignalCount}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={screen.panels.auditLog}>
          <div className="max-h-[400px] overflow-y-auto">
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
        </Panel>

        <Panel title={screen.panels.ontology}>
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
        </Panel>

        <Panel title={screen.language.panel}>
          <div className="flex items-center justify-between gap-4">
            <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {screen.language.description}
            </div>
            <LocaleSwitcher current={locale} />
          </div>
        </Panel>

      </div>
    </Screen>
  );
}

import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { getMessages } from "@/lib/i18n/messages";
import { getAdminSettings } from "@/lib/repositories/admin";

const defaultSettingsOrgId = process.env.PAID_SOURCE_ORG_ID || "11111111-1111-4111-8111-111111111111";

export default async function SettingsPage() {
  const messages = getMessages();
  const screen = messages.screens.settings;
  const settings = await getAdminSettings({ orgId: defaultSettingsOrgId });
  const orgLabel = settings.org ? `${settings.org.name} / ${settings.org.tier}` : "org not configured / fallback";

  return (
    <Screen eyebrow={`${messages.common.screen} 08`} title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title={screen.panels.alertRules}>
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--rune)]">{settings.source} / source-backed rules</div>
          <div className="mt-4 grid gap-3">
            {settings.alertRules.map((rule) => (
              <div className="border-b border-[var(--line-faint)] pb-3 text-sm" key={rule.id}>
                <div className="flex items-center justify-between">
                  <span>{rule.name}</span>
                  <span className="mono text-[var(--rune)]">{Math.round(rule.minConfidence * 100)}%</span>
                </div>
                <div className="mono mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  {rule.layer} / {rule.destination} / {rule.enabled ? "enabled" : "disabled"}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-[var(--text-tertiary)]">{screen.copy.alertRules}</div>
        </Panel>
        <Panel title={screen.panels.apiKeys}>
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--rune)]">hashed keys / one-time token issue</div>
          <div className="mt-4 grid gap-3">
            {settings.apiKeys.map((key) => (
              <div className="border-b border-[var(--line-faint)] pb-3 text-sm" key={key.id}>
                <div className="flex items-center justify-between">
                  <span>{key.name}</span>
                  <span className="mono text-[var(--rune)]">{key.prefix}...</span>
                </div>
                <div className="mono mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{key.scopes.join(" / ")}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-[var(--text-tertiary)]">{screen.copy.apiKeys}</div>
        </Panel>
        <Panel title={screen.panels.permissions}>
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--rune)]">{orgLabel}</div>
          <div className="mt-4 grid gap-3">
            {settings.members.map((member) => (
              <div className="flex items-center justify-between border-b border-[var(--line-faint)] pb-3 text-sm" key={member.id}>
                <span>{member.displayName}</span>
                <span className="mono text-[var(--text-tertiary)]">{member.role}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-[var(--text-tertiary)]">{screen.copy.permissions}</div>
        </Panel>
        <Panel title={screen.panels.ontology}>
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--rune)]">public-or-org isolation</div>
          <div className="mt-3 text-sm">Ontology, alert, audit, API key, and Munin data paths are scoped by org_id or public visibility.</div>
          <div className="mono mt-4 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">source-backed control / rls-backed</div>
          <div className="mt-4 text-xs text-[var(--text-tertiary)]">{screen.copy.ontology}</div>
        </Panel>
      </div>
    </Screen>
  );
}

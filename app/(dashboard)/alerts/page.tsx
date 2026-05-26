import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Confidence } from "@/components/ui/confidence";
import { alerts } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

/** Named evidence reference shape — aligns with SourceRef fields */
type EvidenceRef = { sourceId?: string; title?: string; url?: string };

export default async function AlertsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.alerts;

  // Signal chain derived from the highest-priority alert's evidence
  const primaryAlert = alerts[0];
  const chainSteps: string[] = primaryAlert?.evidence.length
    ? primaryAlert.evidence.map((ev: EvidenceRef) =>
        String(ev.title ?? ev.sourceId ?? "Source-backed evidence")
      )
    : [
        "Raw filing observed",
        "Entity resolution matched",
        "SPV confidence threshold exceeded",
        "Alert emitted"
      ];

  return (
    <Screen title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <Panel title={screen.panels.queue}>
          {alerts.map((alert) => (
            <div
              className="py-3.5"
              style={{ borderBottom: "1px solid var(--line-faint)" }}
              key={alert.title}
            >
              <div
                className="mono text-[10px] font-medium uppercase tracking-[0.13em]"
                style={{ color: "var(--critical)" }}
              >
                {alert.priority}
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
            </div>
          ))}
        </Panel>

        <Panel title={screen.panels.chain} accent>
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
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)"
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="pt-0.5 text-[13px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  {step}
                </div>
              </div>
            ))}
          </div>
          {primaryAlert && (
            <div
              className="mono mt-3 text-[10px] uppercase tracking-[0.12em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {primaryAlert.source} · {Math.round(primaryAlert.confidence * 100)}% conf.
            </div>
          )}
        </Panel>
      </div>
    </Screen>
  );
}

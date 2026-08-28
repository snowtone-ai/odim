import type { Metadata } from "next";
import { AlertsWorkstation } from "@/components/ui/alerts-workstation";
import { alerts } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import { listWatchtowerPlaybooks, listWatchtowerRuns } from "@/lib/repositories/watchtower";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === "ja" ? "通知" : "Signal Alerts" };
}

// Repository reads must happen per-request, never baked into static HTML at build time.
export const dynamic = "force-dynamic";

const defaultAlertsOrgId = process.env.DEFAULT_ORG_ID || "11111111-1111-4111-8111-111111111111";

export default async function AlertsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const watchtower = await listWatchtowerRuns({ orgId: defaultAlertsOrgId });
  const alertMessages = {
    ...messages.screens.alerts,
    notifications: locale === "ja"
      ? {
          title: "重要なアラートのブラウザ通知を許可しますか？",
          enable: "通知を有効化",
          dismiss: "今はしない",
          busy: "処理中…"
        }
      : {
          title: "Allow browser notifications for critical alerts?",
          enable: "Enable notifications",
          dismiss: "Not now",
          busy: "Working…"
        }
  };
  return (
    <AlertsWorkstation
      alerts={alerts}
      messages={{ ...alertMessages, locale }}
      watchtower={{
        runs: watchtower.runs,
        playbooks: listWatchtowerPlaybooks(),
        labels: messages.screens.alerts.watchtower
      }}
    />
  );
}

import { AlertsWorkstation } from "@/components/ui/alerts-workstation";
import { alerts } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import { listWatchtowerPlaybooks, listWatchtowerRuns } from "@/lib/repositories/watchtower";

// Repository reads must happen per-request, never baked into static HTML at build time.
export const dynamic = "force-dynamic";

const defaultAlertsOrgId = process.env.DEFAULT_ORG_ID || "11111111-1111-4111-8111-111111111111";

// Mobile-first layout: grid-cols-1 xl:grid-cols-[420px_1fr]
export default async function AlertsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const watchtower = await listWatchtowerRuns({ orgId: defaultAlertsOrgId });
  return (
    <AlertsWorkstation
      alerts={alerts}
      messages={messages.screens.alerts}
      watchtower={{
        runs: watchtower.runs,
        playbooks: listWatchtowerPlaybooks(),
        labels: messages.screens.alerts.watchtower
      }}
    />
  );
}

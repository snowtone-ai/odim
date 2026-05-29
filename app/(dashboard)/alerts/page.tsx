import { AlertsWorkstation } from "@/components/ui/alerts-workstation";
import { alerts } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export default async function AlertsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return (
    <AlertsWorkstation
      alerts={alerts}
      messages={messages.screens.alerts}
    />
  );
}

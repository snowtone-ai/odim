import { Screen } from "@/components/ui/screen";
import { HuginnConsole } from "@/components/ui/huginn-console";
import { submitHuginnQuestion } from "@/app/actions/huginn";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

const defaultHuginnOrgId = process.env.DEFAULT_ORG_ID || "11111111-1111-4111-8111-111111111111";

export default async function HuginnPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.huginn;

  return (
    <Screen title={screen.title}>
      <HuginnConsole
        defaultOrgId={defaultHuginnOrgId}
        cascadeLayers={screen.cascadeLayers}
        memoryRecords={screen.memoryRecords}
        panelLabels={screen.panels}
        badgeLabels={{ reality: screen.badges.reality, narrative: screen.badges.narrative }}
        inputLabels={screen.input}
        traceNote={screen.traceNote}
        evalLabels={screen.eval}
        emptyStateText={screen.emptyState}
        showOnMapLabel={screen.showOnMap}
        webSearchLabel={screen.webSearch}
        action={submitHuginnQuestion}
      />
    </Screen>
  );
}

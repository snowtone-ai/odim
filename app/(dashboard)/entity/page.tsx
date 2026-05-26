import { EntityWorkstation } from "@/components/ui/entity-workstation";
import { Screen } from "@/components/ui/screen";
import { entities, ontologyLinks, timelineEvents, layerActivity, watchlistBriefs } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export default async function EntityPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.entity;

  return (
    <Screen title={screen.title}>
      <EntityWorkstation
        entities={entities}
        layerActivity={layerActivity}
        ontologyLinks={ontologyLinks}
        timelineEvents={timelineEvents}
        watchlistBriefs={watchlistBriefs}
        messages={{
          entity: screen,
          layers: [...messages.layers]
        }}
      />
    </Screen>
  );
}

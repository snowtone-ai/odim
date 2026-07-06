import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entity Intelligence" };

import { EntityWorkstation } from "@/components/ui/entity-workstation";
import { Screen } from "@/components/ui/screen";
import { entities, ontologyLinks, timelineEvents, layerActivity, watchlistBriefs } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import { getEvidenceWorkbench } from "@/lib/repositories/evidence-graph";

// Repository reads must happen per-request, never baked into static HTML at build time.
export const dynamic = "force-dynamic";

export default async function EntityPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.entity;
  const evidenceWorkbench = await getEvidenceWorkbench();

  return (
    <Screen title={screen.title}>
      <EntityWorkstation
        entities={entities}
        layerActivity={layerActivity}
        ontologyLinks={ontologyLinks}
        timelineEvents={timelineEvents}
        watchlistBriefs={watchlistBriefs}
        evidenceWorkbench={evidenceWorkbench}
        messages={{
          entity: screen,
          layers: [...messages.layers]
        }}
      />
    </Screen>
  );
}

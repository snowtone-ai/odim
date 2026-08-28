import type { Metadata } from "next";
import { RealityMap } from "@/components/ui/reality-map";

import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import type { LayerKey } from "@/lib/map/types";
import { buildFixtureRawSignals } from "@/lib/pipeline/fixtures";
import { buildIngestionPlan } from "@/lib/pipeline/ontologize";
import { computeDailyDiff } from "@/lib/pipeline/diff";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === "ja" ? "現実の動き" : "Reality Map" };
}

const VALID_LAYERS: Set<string> = new Set([
  "energy", "cash", "land", "compute", "water", "raw_materials", "logistics"
]);

export default async function RealityMapPage(
  props: { searchParams: Promise<{ filter?: string; lat?: string; lng?: string; zoom?: string }> }
) {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.map;
  const searchParams = await props.searchParams;
  const filterParam = searchParams.filter;
  const initialFilter = filterParam && VALID_LAYERS.has(filterParam) ? (filterParam as LayerKey) : null;
  const lat = searchParams.lat ? Number(searchParams.lat) : undefined;
  const lng = searchParams.lng ? Number(searchParams.lng) : undefined;
  const zoom = searchParams.zoom ? Number(searchParams.zoom) : undefined;
  const initialCenter = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng, zoom: Number.isFinite(zoom ?? NaN) ? zoom : undefined }
    : undefined;
  const todayPlan = buildIngestionPlan(buildFixtureRawSignals());
  const yesterdayPlan = buildIngestionPlan(buildFixtureRawSignals().slice(0, -3));
  const diff = computeDailyDiff(todayPlan, yesterdayPlan);

  return (
    <section data-testid="reality-map-page" className="h-[calc(100dvh-3.5rem)] min-h-[520px] overflow-hidden bg-[var(--field)]">
      <RealityMap
        layerLabels={[...messages.layers]}
        selectLabel={screen.panels.layers}
        searchHint={screen.searchHint}
        initialFilter={initialFilter}
        initialCenter={initialCenter}
        tooltipLabels={screen.tooltip}
        filterLabels={screen.filters}
        dailyDiff={diff}
      />
    </section>
  );
}

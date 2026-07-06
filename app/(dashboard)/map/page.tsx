import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reality Map" };

import { RealityMap } from "@/components/ui/reality-map";
import { DailyDiffPanel } from "@/components/ui/daily-diff";

import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import type { LayerKey } from "@/lib/map/types";
import { buildFixtureRawSignals } from "@/lib/pipeline/fixtures";
import { buildIngestionPlan } from "@/lib/pipeline/ontologize";
import { computeDailyDiff } from "@/lib/pipeline/diff";

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
    <section className="flex h-screen flex-col">
      {/* Compact status bar — no title, just live indicator */}
      <header
        className="flex shrink-0 items-center justify-end px-5 py-2"
        style={{ borderBottom: "1px solid var(--line-faint)" }}
      >
        <div
          className="mono flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]"
          style={{
            color: "var(--text-tertiary)",
            background: "var(--ink-800)",
            border: "1px solid var(--line-faint)",
            boxShadow: "var(--shadow-inset)"
          }}
        >
          <span
            className="inline-block h-[5px] w-[5px] rounded-full bg-[var(--positive)]"
            style={{ boxShadow: "0 0 6px color-mix(in srgb, var(--positive) 45%, transparent)" }}
          />
          {messages.common.live}
        </div>
      </header>

      {/* Map — full bleed, fills remaining height */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-x-3 top-3 z-20">
          <DailyDiffPanel diff={diff} />
        </div>
        <RealityMap
          layerLabels={[...messages.layers]}
          selectLabel={screen.panels.layers}
          searchHint={screen.searchHint}
          initialFilter={initialFilter}
          initialCenter={initialCenter}
          tooltipLabels={screen.tooltip}
          filterLabels={screen.filters}
        />
      </div>
    </section>
  );
}

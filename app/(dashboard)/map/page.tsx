import { RealityMap } from "@/components/ui/reality-map";
import { alerts, layerActivity } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import type { LayerKey } from "@/lib/map/types";

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

      {/* Map + sidebar: fill remaining height */}
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_280px]">
        {/* Map — full bleed, no panel wrapper */}
        <div className="relative min-h-[400px]">
          <RealityMap
            layerLabels={[...messages.layers]}
            selectLabel={screen.panels.layers}
            searchHint={screen.searchHint}
            initialFilter={initialFilter}
            initialCenter={initialCenter}
          />
        </div>

        {/* Right sidebar */}
        <div
          className="hidden overflow-y-auto xl:flex xl:flex-col"
          style={{
            background: "var(--ink-850)",
            borderLeft: "1px solid var(--line-soft)"
          }}
        >
          {/* Layers section */}
          <div
            className="px-4 py-2.5"
            style={{
              borderBottom: "1px solid var(--line-faint)",
              backgroundImage: "linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 1%, transparent) 0%, transparent 50%)"
            }}
          >
            <span
              className="mono text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "var(--text-secondary)" }}
            >
              {screen.panels.layers}
            </span>
          </div>
          <div className="px-4">
            {layerActivity.map((layer, index) => (
              <div
                className="flex items-center justify-between py-2.5"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={layer.layer}
              >
                <div>
                  <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
                    {messages.layers[index] ?? layer.layer}
                  </div>
                  <div
                    className="mono mt-0.5 text-[10px] uppercase tracking-[0.11em]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {layer.source} · {Math.round(layer.confidence * 100)}%
                  </div>
                </div>
                <span className="mono text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  {layer.count}
                </span>
              </div>
            ))}
          </div>

          {/* Live feed section */}
          <div
            className="mt-auto px-4 py-2.5"
            style={{
              borderTop: "1px solid var(--line-faint)",
              borderBottom: "1px solid var(--line-faint)",
              backgroundImage: "linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 1%, transparent) 0%, transparent 50%)"
            }}
          >
            <span
              className="mono text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "var(--text-secondary)" }}
            >
              {screen.panels.liveFeed}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4">
            {alerts.slice(0, 5).map((alert) => (
              <div
                className="py-2.5"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={alert.title}
              >
                <div
                  className="mono text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: "var(--critical)" }}
                >
                  {alert.priority}
                </div>
                <div className="mt-1 text-[13px] leading-snug" style={{ color: "var(--text-primary)" }}>
                  {alert.title}
                </div>
                <div
                  className="mono mt-1 text-[10px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {alert.source}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

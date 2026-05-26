"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as MapType, Marker as MarkerType } from "maplibre-gl";

type LayerKey = "energy" | "cash" | "land" | "compute" | "water" | "raw_materials" | "logistics";

type MapEntity = {
  id: string;
  name: string;
  score: number;
  confidence: number;
  lat: number;
  lng: number;
  layer: LayerKey;
};

type LayerToggle = {
  key: LayerKey;
  label: string;
  color: string;
  enabled: boolean;
};

const LAYER_COLORS: Record<LayerKey, string> = {
  energy:       "#e0904a",
  cash:         "#6fa86f",
  land:         "#c4a96b",
  compute:      "#5e9fd4",
  water:        "#4fb8c8",
  raw_materials:"#b47fbc",
  logistics:    "#8fa8c4"
};

const DEMO_ENTITIES: MapEntity[] = [
  { id: "e1",  name: "Microsoft / Iowa Data Center",      score: 82, confidence: 0.88, lat:  41.6,  lng:  -93.6,  layer: "compute" },
  { id: "e2",  name: "NextEra / TX Solar Farm",           score: 76, confidence: 0.78, lat:  31.9,  lng:  -99.9,  layer: "energy" },
  { id: "e3",  name: "Laidley LLC / NV Land Acquisition", score: 71, confidence: 0.72, lat:  36.2,  lng: -115.1,  layer: "land" },
  { id: "e4",  name: "Brookfield / UK Wind Farm",         score: 68, confidence: 0.66, lat:  53.4,  lng:   -2.2,  layer: "energy" },
  { id: "e5",  name: "Equinix / SG3 Expansion",           score: 74, confidence: 0.82, lat:   1.3,  lng:  103.8,  layer: "compute" },
  { id: "e6",  name: "Saudi Aramco / NEOM Pipeline",      score: 66, confidence: 0.62, lat:  27.5,  lng:   36.5,  layer: "cash" },
  { id: "e7",  name: "BHP / Pilbara Water Rights",        score: 63, confidence: 0.58, lat: -22.3,  lng:  118.6,  layer: "water" },
  { id: "e8",  name: "Maersk / Rotterdam Logistics Hub",  score: 70, confidence: 0.74, lat:  51.9,  lng:    4.5,  layer: "logistics" },
  { id: "e9",  name: "Rio Tinto / QLD Lithium Mine",      score: 65, confidence: 0.64, lat: -20.7,  lng:  139.5,  layer: "raw_materials" },
  { id: "e10", name: "TSMC / Kumamoto Fab",               score: 80, confidence: 0.86, lat:  32.8,  lng:  130.7,  layer: "compute" }
];

// Voyager style: colorful, shows geography clearly while staying professional
const MAP_STYLE = {
  version: 8 as const,
  name: "odim-map",
  sources: {
    "carto-voyager": {
      type: "raster" as const,
      tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"],
      tileSize: 256,
      attribution: ""
    }
  },
  layers: [
    {
      id: "carto-voyager-layer",
      type: "raster" as const,
      source: "carto-voyager",
      minzoom: 0,
      maxzoom: 20,
      paint: {
        "raster-opacity": 0.88,
        "raster-saturation": 0.2
      }
    }
  ]
};

export function RealityMap({
  layerLabels,
  selectLabel
}: Readonly<{
  layerLabels: string[];
  selectLabel: string;
}>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const markersRef = useRef<MarkerType[]>([]);
  const [loaded, setLoaded] = useState(false);

  const layerKeys: LayerKey[] = ["energy", "cash", "land", "compute", "water", "raw_materials", "logistics"];
  const [layers, setLayers] = useState<LayerToggle[]>(
    layerKeys.map((key, i) => ({
      key,
      label: layerLabels[i] ?? key,
      color: LAYER_COLORS[key],
      enabled: true
    }))
  );

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((prev) => prev.map((l) => (l.key === key ? { ...l, enabled: !l.enabled } : l)));
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;
      import("maplibre-gl/dist/maplibre-gl.css");

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [15, 28],
        zoom: 1.6,
        minZoom: 1,
        maxZoom: 16,
        attributionControl: false
      });

      map.on("load", () => {
        if (!cancelled) setLoaded(true);
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !loaded) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const enabledKeys = new Set(layers.filter((l) => l.enabled).map((l) => l.key));
    const visibleEntities = DEMO_ENTITIES.filter((e) => enabledKeys.has(e.layer));

    import("maplibre-gl").then((maplibregl) => {
      if (!mapRef.current) return;

      for (const entity of visibleEntities) {
        const color = LAYER_COLORS[entity.layer];

        // Outer pulse ring
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position:relative; width:24px; height:24px; cursor:pointer;";

        const ring = document.createElement("div");
        ring.style.cssText = `
          position:absolute; inset:-4px; border-radius:50%;
          border: 2px solid ${color};
          opacity: 0.35;
          animation: marker-pulse 2.4s ease-in-out infinite;
        `;

        const dot = document.createElement("div");
        dot.style.cssText = `
          position:absolute; inset:0; border-radius:50%;
          background: ${color};
          border: 2px solid rgba(255,255,255,0.28);
          box-shadow: 0 0 8px ${color}70, 0 0 20px ${color}38;
          transition: transform 200ms cubic-bezier(0.22, 1.2, 0.36, 1), box-shadow 200ms ease;
        `;

        wrapper.appendChild(ring);
        wrapper.appendChild(dot);

        wrapper.addEventListener("mouseenter", () => {
          dot.style.transform = "scale(1.5)";
          dot.style.boxShadow = `0 0 14px ${color}90, 0 0 30px ${color}50`;
        });
        wrapper.addEventListener("mouseleave", () => {
          dot.style.transform = "scale(1)";
          dot.style.boxShadow = `0 0 8px ${color}70, 0 0 20px ${color}38`;
        });

        const popup = new maplibregl.Popup({
          offset: 18,
          closeButton: false,
          className: "odim-popup"
        }).setHTML(`
          <div style="background:rgba(10,12,16,0.94);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 14px;min-width:190px;box-shadow:0 6px 20px rgba(0,0,0,0.5);">
            <div style="font-size:11px;font-weight:500;color:#dde1ea;letter-spacing:0.01em;line-height:1.4;">${entity.name}</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:7px;">
              <span style="font-family:var(--font-plex-mono),monospace;font-size:11px;font-weight:500;color:${color};">Score ${entity.score}</span>
              <span style="font-family:var(--font-plex-mono),monospace;font-size:10px;color:#5c6780;">${Math.round(entity.confidence * 100)}% conf.</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:6px;">
              <span style="width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 5px ${color}60;display:inline-block;"></span>
              <span style="font-family:var(--font-plex-mono),monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#404c61;">${entity.layer.replace("_"," ")}</span>
            </div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: wrapper })
          .setLngLat([entity.lng, entity.lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        markersRef.current.push(marker);
      }
    });
  }, [loaded, layers]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-b-[var(--radius-lg)]">
      {/* Pulse animation keyframe injected inline */}
      <style>{`
        @keyframes marker-pulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.8); opacity: 0.08; }
        }
      `}</style>

      <div ref={containerRef} className="h-full w-full" />

      {/* Layer toggles */}
      <div
        className="absolute right-3 top-3 z-10 grid gap-0.5 rounded-[var(--radius-md)] p-2"
        style={{
          background: "rgba(9,11,15,0.86)",
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-lg)"
        }}
      >
        <div
          className="mono px-2 pb-1.5 text-[10px] uppercase tracking-[0.14em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {selectLabel}
        </div>
        {layers.map((layer) => (
          <button
            key={layer.key}
            onClick={() => toggleLayer(layer.key)}
            className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] hover:bg-[rgba(255,255,255,0.05)]"
            style={{ color: layer.enabled ? "var(--text-primary)" : "var(--text-tertiary)" }}
            type="button"
          >
            <span
              className="h-2 w-2 rounded-full transition-all duration-[var(--dur-fast)]"
              style={{
                backgroundColor: layer.color,
                opacity: layer.enabled ? 1 : 0.2,
                boxShadow: layer.enabled ? `0 0 6px ${layer.color}55` : "none"
              }}
            />
            <span className="text-[12px]">{layer.label}</span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "var(--ink-900)" }}
        >
          <div
            className="mono text-[11px] uppercase tracking-[0.14em]"
            style={{ color: "var(--text-tertiary)", animation: "glow-pulse 2s ease-in-out infinite" }}
          >
            Loading substrate map
          </div>
        </div>
      )}
    </div>
  );
}

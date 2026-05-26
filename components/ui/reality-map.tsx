"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as MapType, GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from "maplibre-gl";
import { DEMO_ENTITIES } from "@/lib/map/entities";
import { DEMO_CONNECTIONS } from "@/lib/map/connections";
import type { LayerKey, MapEntity, MapConnection } from "@/lib/map/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** HTML-escape a string to prevent XSS in setHTML interpolation */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYER_COLORS: Record<LayerKey, string> = {
  energy:        "#e0904a",
  cash:          "#6fa86f",
  land:          "#c4a96b",
  compute:       "#5e9fd4",
  water:         "#4fb8c8",
  raw_materials: "#b47fbc",
  logistics:     "#8fa8c4"
};

const LAYER_KEYS: LayerKey[] = [
  "energy", "cash", "land", "compute", "water", "raw_materials", "logistics"
];

const MAP_STYLE = {
  version: 8 as const,
  name: "odim-dark",
  sources: {
    "carto-dark": {
      type: "raster" as const,
      tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
      tileSize: 256,
      attribution: ""
    }
  },
  layers: [
    {
      id: "carto-dark-layer",
      type: "raster" as const,
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 20,
      paint: { "raster-opacity": 0.92 }
    }
  ]
};

// ─── GeoJSON builders ─────────────────────────────────────────────────────────

type EntityProperties = {
  id: string;
  name: string;
  score: number;
  confidence: number;
  layer: LayerKey;
  color: string;
};

type ConnectionProperties = {
  id: string;
  fromId: string;
  toId: string;
  color: string;
  width: number;
  opacity: number;
  active: boolean;
};

function buildEntityCollection(entities: MapEntity[]) {
  return {
    type: "FeatureCollection" as const,
    features: entities.map((e) => ({
      type: "Feature" as const,
      id: e.id,
      geometry: { type: "Point" as const, coordinates: [e.lng, e.lat] },
      properties: {
        id: e.id,
        name: e.name,
        score: e.score,
        confidence: e.confidence,
        layer: e.layer,
        color: LAYER_COLORS[e.layer]
      } satisfies EntityProperties
    }))
  };
}

function buildConnectionCollection(
  visible: Set<LayerKey>,
  selectedId: string | null,
  allEntities: MapEntity[],
  allConnections: MapConnection[]
) {
  return {
    type: "FeatureCollection" as const,
    features: allConnections.flatMap((conn) => {
      const from = allEntities.find((e) => e.id === conn.fromId);
      const to = allEntities.find((e) => e.id === conn.toId);
      if (!from || !to) return [];
      if (!visible.has(from.layer) || !visible.has(to.layer)) return [];

      const isRelated =
        selectedId === null ||
        conn.fromId === selectedId ||
        conn.toId === selectedId;

      const opacity = isRelated ? (conn.active ? 0.85 : 0.45) : 0.1;
      const width = 1 + conn.confidence * 2;
      const color = LAYER_COLORS[from.layer];

      return [
        {
          type: "Feature" as const,
          id: conn.id,
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [from.lng, from.lat],
              [to.lng, to.lat]
            ]
          },
          properties: {
            id: conn.id,
            fromId: conn.fromId,
            toId: conn.toId,
            color,
            width,
            opacity,
            active: conn.active
          } satisfies ConnectionProperties
        }
      ];
    })
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LayerToggle = {
  key: LayerKey;
  label: string;
  color: string;
  enabled: boolean;
};

type Props = Readonly<{
  layerLabels: string[];
  selectLabel: string;
  searchHint?: string;
  onEntitySelect?: (entity: MapEntity | null) => void;
  /** Override demo data with production entities. Falls back to DEMO_ENTITIES. */
  entities?: MapEntity[];
  /** Override demo data with production connections. Falls back to DEMO_CONNECTIONS. */
  connections?: MapConnection[];
}>;

// ─── Component ────────────────────────────────────────────────────────────────

export function RealityMap({
  layerLabels,
  selectLabel,
  searchHint = "Search entities…",
  onEntitySelect,
  entities: entityData = DEMO_ENTITIES,
  connections: connectionData = DEMO_CONNECTIONS
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const popupRef = useRef<InstanceType<
    typeof import("maplibre-gl")["Popup"]
  > | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<MapEntity[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [layers, setLayers] = useState<LayerToggle[]>(
    LAYER_KEYS.map((key, i) => ({
      key,
      label: layerLabels[i] ?? key,
      color: LAYER_COLORS[key],
      enabled: true
    }))
  );

  // Stable references for use inside map init closure
  const entityDataRef = useRef(entityData);
  const connectionDataRef = useRef(connectionData);
  useEffect(() => { entityDataRef.current = entityData; }, [entityData]);
  useEffect(() => { connectionDataRef.current = connectionData; }, [connectionData]);

  const enabledKeys = new Set(
    layers.filter((l) => l.enabled).map((l) => l.key)
  );

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((prev) =>
      prev.map((l) => (l.key === key ? { ...l, enabled: !l.enabled } : l))
    );
  }, []);

  // Global keyboard shortcut: Cmd+F or / focuses search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === "f" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Filter search results
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    setSearchResults(
      entityData.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.layer.toLowerCase().includes(q)
      ).slice(0, 6)
    );
  }, [searchQuery, entityData]);

  // ── Map init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [15, 28],
        zoom: 1.6,
        minZoom: 1,
        maxZoom: 16,
        attributionControl: false
      });

      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "odim-popup",
        offset: 14
      });

      map.on("load", async () => {
        if (cancelled) return;

        // Fallback: register a white-circle ImageData for any SDF icon that fails to load
        map.on("styleimagemissing", (e: { id: string }) => {
          const size = 16;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            if (!map.hasImage(e.id)) {
              map.addImage(e.id, ctx.getImageData(0, 0, size, size));
            }
          }
        });

        // Load SDF icons
        await Promise.all(
          LAYER_KEYS.map(
            (key) =>
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => {
                  try {
                    if (!map.hasImage(key)) {
                      map.addImage(key, img, { sdf: true });
                    }
                  } catch {
                    // Fallback registered via styleimagemissing
                  }
                  resolve();
                };
                img.onerror = () => resolve(); // styleimagemissing handler covers missing icons
                img.src = `/icons/substrate-${key}.svg`;
              })
          )
        );

        // ── Entity source (clustered) ────────────────────────────────────
        map.addSource("entities", {
          type: "geojson",
          data: buildEntityCollection(entityDataRef.current),
          cluster: true,
          clusterMaxZoom: 8,
          clusterRadius: 50
        });

        // ── Connection source ────────────────────────────────────────────
        map.addSource("connections", {
          type: "geojson",
          data: buildConnectionCollection(
            new Set(LAYER_KEYS),
            null,
            entityDataRef.current,
            connectionDataRef.current
          )
        });

        // ── Connection lines ─────────────────────────────────────────────
        map.addLayer({
          id: "connection-lines",
          type: "line",
          source: "connections",
          layout: {
            "line-cap": "round",
            "line-join": "round"
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["get", "width"],
            "line-opacity": ["get", "opacity"],
            "line-dasharray": [2, 3]
          }
        });

        // ── Confidence circle rings ──────────────────────────────────────
        map.addLayer({
          id: "entity-rings",
          type: "circle",
          source: "entities",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "score"],
              60, 10,
              85, 18
            ],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.12,
            "circle-stroke-color": ["get", "color"],
            "circle-stroke-width": 1,
            "circle-stroke-opacity": 0.35
          }
        });

        // ── Cluster circles ──────────────────────────────────────────────
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "entities",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#2a3348",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              16, 3, 22, 6, 28
            ],
            "circle-stroke-color": "rgba(255,255,255,0.15)",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.9
          }
        });

        // ── Cluster count labels ─────────────────────────────────────────
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "entities",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-font": ["literal", ["Open Sans Bold"]],
            "text-size": 11,
            "text-allow-overlap": true
          },
          paint: {
            "text-color": "#c8cfdc"
          }
        });

        // ── Individual entity symbols ────────────────────────────────────
        map.addLayer({
          id: "entity-symbols",
          type: "symbol",
          source: "entities",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": ["get", "layer"],
            "icon-size": 0.7,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true
          },
          paint: {
            "icon-color": ["get", "color"],
            "icon-opacity": 1
          }
        });

        // ── Interaction: hover ───────────────────────────────────────────
        map.on("mousemove", "entity-symbols", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          map.getCanvas().style.cursor = "pointer";
          const feature = e.features?.[0];
          if (!feature) return;
          const props = feature.properties as EntityProperties;
          const color = props.color;
          const coords = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates;

          popupRef.current
            ?.setLngLat(coords)
            .setHTML(
              `<div style="background:rgba(10,12,16,0.94);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 14px;min-width:190px;box-shadow:0 6px 20px rgba(0,0,0,0.5);">
                <div style="font-size:11px;font-weight:500;color:#dde1ea;letter-spacing:0.01em;line-height:1.4;">${escapeHtml(props.name)}</div>
                <div style="display:flex;align-items:center;gap:10px;margin-top:7px;">
                  <span style="font-family:monospace;font-size:11px;font-weight:500;color:${color};">Score ${props.score}</span>
                  <span style="font-family:monospace;font-size:10px;color:#5c6780;">${Math.round(props.confidence * 100)}% conf.</span>
                </div>
                <div style="display:flex;align-items:center;gap:5px;margin-top:6px;">
                  <span style="width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 5px ${color}60;display:inline-block;"></span>
                  <span style="font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#404c61;">${escapeHtml(props.layer.replace("_", " "))}</span>
                </div>
              </div>`
            )
            .addTo(map);
        });

        map.on("mouseleave", "entity-symbols", () => {
          map.getCanvas().style.cursor = "";
          popupRef.current?.remove();
        });

        // ── Interaction: click entity ────────────────────────────────────
        map.on("click", "entity-symbols", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const props = feature.properties as EntityProperties;
          const entity = entityDataRef.current.find((en) => en.id === props.id) ?? null;

          setSelectedId(props.id);
          onEntitySelect?.(entity);

          map.flyTo({
            center: (feature.geometry as unknown as { coordinates: [number, number] }).coordinates,
            zoom: Math.max(map.getZoom(), 4),
            duration: 900,
            essential: true
          });
        });

        // ── Interaction: click cluster → zoom ────────────────────────────
        map.on("click", "clusters", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const clusterId = feature.properties?.cluster_id as number;
          const source = map.getSource("entities") as GeoJSONSource;
          source.getClusterExpansionZoom(clusterId).then((zoom) => {
            map.flyTo({
              center: (feature.geometry as unknown as { coordinates: [number, number] }).coordinates,
              zoom,
              duration: 700,
              essential: true
            });
          });
        });

        // ── Click background → deselect ──────────────────────────────────
        map.on("click", (e: MapMouseEvent) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["entity-symbols", "clusters"]
          });
          if (features.length === 0) {
            setSelectedId(null);
            onEntitySelect?.(null);
          }
        });

        map.on("mouseenter", "clusters", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "clusters", () => {
          map.getCanvas().style.cursor = "";
        });

        setLoaded(true);
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      popupRef.current?.remove();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync selected entity → connection highlight ───────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const src = map.getSource("connections") as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(buildConnectionCollection(enabledKeys, selectedId, entityData, connectionData));
  }, [selectedId, loaded, enabledKeys, entityData, connectionData]);

  // ── Sync layer visibility → entity source filter ──────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const enabledArr = Array.from(enabledKeys);

    // Update entity symbol filter
    if (map.getLayer("entity-symbols")) {
      map.setFilter("entity-symbols", [
        "all",
        ["!", ["has", "point_count"]],
        ["in", ["get", "layer"], ["literal", enabledArr]]
      ]);
    }
    if (map.getLayer("entity-rings")) {
      map.setFilter("entity-rings", [
        "all",
        ["!", ["has", "point_count"]],
        ["in", ["get", "layer"], ["literal", enabledArr]]
      ]);
    }

    // Rebuild entity source to respect layer filters for clustering
    const src = map.getSource("entities") as GeoJSONSource | undefined;
    if (src) {
      src.setData(
        buildEntityCollection(
          entityDataRef.current.filter((e) => enabledKeys.has(e.layer))
        )
      );
    }

    // Rebuild connections
    const connSrc = map.getSource("connections") as GeoJSONSource | undefined;
    if (connSrc) {
      connSrc.setData(buildConnectionCollection(enabledKeys, selectedId, entityDataRef.current, connectionDataRef.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, layers]);

  // ── Search handlers ───────────────────────────────────────────────────────

  const handleSearchSelect = useCallback(
    (entity: MapEntity) => {
      const map = mapRef.current;
      if (!map) return;

      setSelectedId(entity.id);
      onEntitySelect?.(entity);
      setSearchOpen(false);
      setSearchQuery("");

      map.flyTo({
        center: [entity.lng, entity.lat],
        zoom: 5,
        duration: 1100,
        essential: true
      });
    },
    [onEntitySelect]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full overflow-hidden rounded-b-[var(--radius-lg)]">
      {/* Pulse animation */}
      <style>{`
        .maplibregl-popup-content { background: transparent !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
        .maplibregl-popup-tip { display: none !important; }
        @keyframes marker-pulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.8); opacity: 0.08; }
        }
      `}</style>

      {/* Map canvas */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Search bar */}
      <div
        className="absolute left-3 top-3 z-10"
        style={{ width: 240 }}
      >
        {searchOpen ? (
          <div
            className="rounded-[var(--radius-md)] overflow-hidden"
            style={{
              background: "rgba(9,11,15,0.92)",
              backdropFilter: "blur(14px) saturate(1.2)",
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--shadow-lg)"
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchHint}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchOpen(false);
                  setSearchQuery("");
                }
              }}
              className="w-full bg-transparent px-3 py-2 text-[12px] outline-none"
              style={{
                color: "var(--text-primary)",
                borderBottom: searchResults.length > 0 ? "1px solid var(--line-faint)" : "none"
              }}
            />
            {searchResults.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => handleSearchSelect(entity)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/5"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: LAYER_COLORS[entity.layer],
                    boxShadow: `0 0 5px ${LAYER_COLORS[entity.layer]}60`
                  }}
                />
                <div className="min-w-0">
                  <div className="truncate text-[11px]" style={{ color: "var(--text-primary)" }}>
                    {entity.name}
                  </div>
                  <div className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
                    {entity.layer.replace("_", " ")} · {entity.score}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-[11px] transition-all hover:bg-white/5"
            style={{
              background: "rgba(9,11,15,0.72)",
              backdropFilter: "blur(10px)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-tertiary)"
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <span className="mono uppercase tracking-[0.1em]">{searchHint}</span>
            <span
              className="mono ml-auto rounded px-1 text-[9px] tracking-wide"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-tertiary)" }}
            >
              /
            </span>
          </button>
        )}
      </div>

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

      {/* Loading overlay */}
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "var(--ink-900)" }}
        >
          <div
            className="mono text-[11px] uppercase tracking-[0.14em]"
            style={{
              color: "var(--text-tertiary)",
              animation: "glow-pulse 2s ease-in-out infinite"
            }}
          >
            Loading substrate map
          </div>
        </div>
      )}
    </div>
  );
}

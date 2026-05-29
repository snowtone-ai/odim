"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { Map as MapType, GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from "maplibre-gl";
import { DEMO_ENTITIES, filterEntities, isNewEntity, type TimeRange } from "@/lib/map/entities";
import { DEMO_CONNECTIONS } from "@/lib/map/connections";
import type { LayerKey, MapEntity, MapConnection, MapAlert } from "@/lib/map/types";
import { SubstrateTooltip, type SubstrateTooltipData } from "@/components/ui/substrate-tooltip";
import { aggregateByGeo, buildGeoFeatureCollections, levelForZoom, zoomForLevel, type GeoLevel } from "@/lib/map/geo-drill";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  energy:        "#d97a2b",
  cash:          "#3a9a3a",
  land:          "#b89245",
  compute:       "#3b82d9",
  water:         "#1a9bb0",
  raw_materials: "#9a5aaa",
  logistics:     "#5a7ea0"
};

const LAYER_KEYS: LayerKey[] = [
  "energy", "cash", "land", "compute", "water", "raw_materials", "logistics"
];

const LAYER_DISPLAY: Record<LayerKey, string> = {
  energy:        "Energy",
  cash:          "Capital",
  land:          "Land",
  compute:       "Compute",
  water:         "Water",
  raw_materials: "Materials",
  logistics:     "Logistics"
};

// OpenFreeMap Liberty — colorful OSM vector tiles, no API key required
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// ─── Canvas Icon Builders (Professional Maki-style) ───────────────────────────

const ICON_SIZE = 64;

type IconDrawer = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void;

function createLayerIcon(layer: LayerKey): ImageData {
  const size = ICON_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const circleR = size * 0.36;
  const color = LAYER_COLORS[layer];

  // Outer glow
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.15;

  // Circle background
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // White border ring
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // White symbol
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  const sr = circleR * 0.52;
  ICON_DRAWERS[layer](ctx, cx, cy, sr);

  return ctx.getImageData(0, 0, size, size);
}

const ICON_DRAWERS: Record<LayerKey, IconDrawer> = {
  // Lightning bolt
  energy(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.1, cy - r * 0.95);
    ctx.lineTo(cx - r * 0.5, cy + r * 0.1);
    ctx.lineTo(cx - r * 0.02, cy + r * 0.1);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.95);
    ctx.lineTo(cx + r * 0.5, cy - r * 0.1);
    ctx.lineTo(cx + r * 0.02, cy - r * 0.1);
    ctx.closePath();
    ctx.fill();
  },
  // Dollar sign
  cash(ctx, cx, cy, r) {
    ctx.font = `bold ${r * 1.5}px "Inter", "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", cx, cy + r * 0.05);
  },
  // Mountain peaks
  land(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.85, cy + r * 0.7);
    ctx.lineTo(cx - r * 0.2, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.05, cy - r * 0.05);
    ctx.lineTo(cx + r * 0.3, cy - r * 0.75);
    ctx.lineTo(cx + r * 0.85, cy + r * 0.7);
    ctx.closePath();
    ctx.fill();
  },
  // Microchip
  compute(ctx, cx, cy, r) {
    const half = r * 0.45;
    ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
    const pin = r * 0.12;
    const pinLen = r * 0.22;
    for (const off of [-0.25, 0.25]) {
      ctx.fillRect(cx + r * off - pin / 2, cy - half - pinLen, pin, pinLen);
      ctx.fillRect(cx + r * off - pin / 2, cy + half, pin, pinLen);
      ctx.fillRect(cx - half - pinLen, cy + r * off - pin / 2, pinLen, pin);
      ctx.fillRect(cx + half, cy + r * off - pin / 2, pinLen, pin);
    }
  },
  // Water droplet
  water(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.85);
    ctx.bezierCurveTo(cx + r * 0.7, cy + r * 0.05, cx + r * 0.55, cy + r * 0.7, cx, cy + r * 0.85);
    ctx.bezierCurveTo(cx - r * 0.55, cy + r * 0.7, cx - r * 0.7, cy + r * 0.05, cx, cy - r * 0.85);
    ctx.closePath();
    ctx.fill();
  },
  // Hexagonal gem
  raw_materials(ctx, cx, cy, r) {
    const gr = r * 0.8;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + gr * Math.cos(angle);
      const y = cy + gr * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  },
  // Arrow (logistics flow)
  logistics(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy - r * 0.3);
    ctx.lineTo(cx + r * 0.15, cy - r * 0.3);
    ctx.lineTo(cx + r * 0.15, cy - r * 0.65);
    ctx.lineTo(cx + r * 0.8, cy);
    ctx.lineTo(cx + r * 0.15, cy + r * 0.65);
    ctx.lineTo(cx + r * 0.15, cy + r * 0.3);
    ctx.lineTo(cx - r * 0.7, cy + r * 0.3);
    ctx.closePath();
    ctx.fill();
  }
};

// ─── GeoJSON builders ─────────────────────────────────────────────────────────

type EntityProperties = {
  id: string;
  name: string;
  description: string;
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
        description: e.description ?? "",
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

      const opacity = isRelated ? (conn.active ? 0.9 : 0.5) : 0.12;
      const width = 1.5 + conn.confidence * 2.5;
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

type FilterLabels = {
  label: string;
  timeRange: string;
  confidence: string;
  "7d": string;
  "30d": string;
  "90d": string;
  "1y": string;
  all: string;
  newBadge: string;
};

const DEFAULT_FILTER_LABELS: FilterLabels = {
  label: "Filters",
  timeRange: "Time Range",
  confidence: "Min Confidence",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  "1y": "1y",
  all: "All",
  newBadge: "New"
};

type Props = Readonly<{
  layerLabels: string[];
  selectLabel: string;
  searchHint?: string;
  onEntitySelect?: (entity: MapEntity | null) => void;
  entities?: MapEntity[];
  connections?: MapConnection[];
  alerts?: MapAlert[];
  /** Pre-filter to a specific layer (e.g. from Huginn navigation) */
  initialFilter?: LayerKey | null;
  /** Initial map center from Huginn region detection */
  initialCenter?: { lat: number; lng: number; zoom?: number };
  tooltipLabels?: {
    activeSignals: string;
    topEntity: string;
    gap: string;
    capital: string;
  };
  filterLabels?: FilterLabels;
  alertOverlayLabel?: string;
}>;

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_TOOLTIP_LABELS = {
  activeSignals: "Active Signals",
  topEntity: "Top Entity",
  gap: "Reality Gap",
  capital: "Capital (30d)"
};

const GEO_LEVELS: GeoLevel[] = ["country", "state", "county", "site"];

export function RealityMap({
  layerLabels,
  selectLabel,
  searchHint = "Search entities…",
  onEntitySelect,
  entities: entityData = DEMO_ENTITIES,
  connections: connectionData = DEMO_CONNECTIONS,
  alerts: alertData = [],
  initialFilter = null,
  initialCenter,
  tooltipLabels = DEFAULT_TOOLTIP_LABELS,
  filterLabels = DEFAULT_FILTER_LABELS,
  alertOverlayLabel = "Alerts"
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const popupRef = useRef<InstanceType<
    typeof import("maplibre-gl")["Popup"]
  > | null>(null);
  const dashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseFrameRef = useRef<number | null>(null);
  const cleanupCallbacksRef = useRef<Array<() => void>>([]);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<MapEntity[]>([]);
  const [tooltipState, setTooltipState] = useState<{
    layer: LayerKey;
    position: { x: number; y: number };
    data: SubstrateTooltipData;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [layers, setLayers] = useState<LayerToggle[]>(
    LAYER_KEYS.map((key, i) => ({
      key,
      label: layerLabels[i] ?? key,
      color: LAYER_COLORS[key],
      enabled: initialFilter ? key === initialFilter : true
    }))
  );
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [minConfidence, setMinConfidence] = useState(0);
  const [alertsVisible, setAlertsVisible] = useState(false);
  const [geoPath, setGeoPath] = useState<string[]>([]);
  const [geoZoomLevel, setGeoZoomLevel] = useState<GeoLevel>("country");
  const alertDataRef = useRef(alertData);
  useEffect(() => { alertDataRef.current = alertData; }, [alertData]);

  const enabledKeys = useMemo(
    () => new Set(layers.filter((l) => l.enabled).map((l) => l.key)),
    [layers]
  );

  const filteredEntities = useMemo(
    () => filterEntities(entityData.filter((e) => enabledKeys.has(e.layer)), { timeRange, minConfidence }),
    [entityData, enabledKeys, timeRange, minConfidence]
  );
  const geoTree = useMemo(() => aggregateByGeo(filteredEntities), [filteredEntities]);
  const geoFeatures = useMemo(() => buildGeoFeatureCollections(geoTree), [geoTree]);
  const geoNodes = useMemo(() => {
    let current = geoTree;
    for (const step of geoPath) {
      const next = current.find((node) => node.name === step)?.children ?? [];
      current = next;
    }
    return current;
  }, [geoPath, geoTree]);

  const entityDataRef = useRef(entityData);
  const connectionDataRef = useRef(connectionData);
  const filteredEntitiesRef = useRef(filteredEntities);
  useEffect(() => { entityDataRef.current = entityData; }, [entityData]);
  useEffect(() => { connectionDataRef.current = connectionData; }, [connectionData]);
  useEffect(() => { filteredEntitiesRef.current = filteredEntities; }, [filteredEntities]);

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
        center: initialCenter ? [initialCenter.lng, initialCenter.lat] : [-98.6, 39.8],
        zoom: initialCenter?.zoom ?? 3,
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

      map.on("load", () => {
        if (cancelled) return;

        // Register canvas-rendered icons (Maki-style, pre-colored)
        LAYER_KEYS.forEach((key) => {
          if (!map.hasImage(key)) {
            map.addImage(key, createLayerIcon(key), { sdf: false });
          }
        });

        // Fallback for missing images
        map.on("styleimagemissing", (e: { id: string }) => {
          if (LAYER_KEYS.includes(e.id as LayerKey)) return;
          const size = 16;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
            ctx.fillStyle = "#888";
            ctx.fill();
            if (!map.hasImage(e.id)) {
              map.addImage(e.id, ctx.getImageData(0, 0, size, size));
            }
          }
        });

        // ── Entity source (clustered) ────────────────────────────────────
        map.addSource("entities", {
          type: "geojson",
          data: buildEntityCollection(entityDataRef.current),
          cluster: true,
          clusterMaxZoom: 8,
          clusterRadius: 50
        });

        for (const level of GEO_LEVELS) {
          map.addSource(`geo-${level}`, {
            type: "geojson",
            data: geoFeatures[level]
          });
        }

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

        // ── Connection lines (base) ─────────────────────────────────────
        map.addLayer({
          id: "connection-lines-base",
          type: "line",
          source: "connections",
          layout: {
            "line-cap": "round",
            "line-join": "round"
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["get", "width"],
            "line-opacity": ["*", ["get", "opacity"], 0.3]
          }
        });

        // ── Connection lines (animated flow) ────────────────────────────
        map.addLayer({
          id: "connection-lines",
          type: "line",
          source: "connections",
          layout: {
            "line-cap": "butt",
            "line-join": "round"
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["get", "width"],
            "line-opacity": ["get", "opacity"],
            "line-dasharray": [0, 2, 3]
          }
        });

        // ── Confidence circle rings (pulsing) ────────────────────────────
        map.addLayer({
          id: "entity-rings",
          type: "circle",
          source: "entities",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1, ["interpolate", ["linear"], ["get", "score"], 60, 8, 85, 14],
              6, ["interpolate", ["linear"], ["get", "score"], 60, 14, 85, 24],
              12, ["interpolate", ["linear"], ["get", "score"], 60, 20, 85, 34]
            ],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.1,
            "circle-stroke-color": ["get", "color"],
            "circle-stroke-width": 1.5,
            "circle-stroke-opacity": 0.3
          }
        });

        // ── Cluster circles ──────────────────────────────────────────────
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "entities",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "rgba(255,255,255,0.92)",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              18, 3, 24, 6, 30
            ],
            "circle-stroke-color": "rgba(0,0,0,0.12)",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.95
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
            "text-size": 12,
            "text-allow-overlap": true
          },
          paint: {
            "text-color": "#333"
          }
        });
        const geoZoomConfig: Record<GeoLevel, { minzoom?: number; maxzoom?: number; radius: number }> = {
          country: { maxzoom: 4.5, radius: 26 },
          state: { minzoom: 4.5, maxzoom: 7.5, radius: 22 },
          county: { minzoom: 7.5, maxzoom: 10.5, radius: 18 },
          site: { minzoom: 10.5, radius: 12 }
        };
        for (const level of GEO_LEVELS) {
          map.addLayer({
            id: `geo-${level}-circles`,
            type: "circle",
            source: `geo-${level}`,
            minzoom: geoZoomConfig[level].minzoom,
            maxzoom: geoZoomConfig[level].maxzoom,
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "signalCount"],
                1, Math.max(10, geoZoomConfig[level].radius - 6),
                8, geoZoomConfig[level].radius,
                25, geoZoomConfig[level].radius + 8
              ],
              "circle-color": level === "site" ? "rgba(201,169,97,0.86)" : "rgba(59,130,217,0.18)",
              "circle-stroke-color": level === "site" ? "rgba(201,169,97,0.96)" : "rgba(59,130,217,0.9)",
              "circle-stroke-width": level === "site" ? 1.5 : 2,
              "circle-opacity": level === "site" ? 0.82 : 0.94
            }
          });
          map.addLayer({
            id: `geo-${level}-labels`,
            type: "symbol",
            source: `geo-${level}`,
            minzoom: geoZoomConfig[level].minzoom,
            maxzoom: geoZoomConfig[level].maxzoom,
            layout: {
              "text-field": ["format", ["get", "name"], { "font-scale": 1 }, "\n", {}, ["get", "signalCount"], { "font-scale": 0.85 }],
              "text-size": level === "country" ? 12 : level === "state" ? 11 : 10,
              "text-allow-overlap": false
            },
            paint: {
              "text-color": level === "site" ? "#f3e5b5" : "#dbe7ff"
            }
          });
        }

        // ── Entity symbols (zoom-dependent sizing) ───────────────────────
        map.addLayer({
          id: "entity-symbols",
          type: "symbol",
          source: "entities",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": ["get", "layer"],
            "icon-size": [
              "interpolate", ["linear"], ["zoom"],
              1, 0.3,
              4, 0.45,
              8, 0.6,
              12, 0.75
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "text-field": ["step", ["zoom"], "", 6, ["get", "name"]],
            "text-size": 11,
            "text-offset": [0, 1.8],
            "text-anchor": "top",
            "text-optional": true,
            "text-max-width": 10
          },
          paint: {
            "icon-opacity": 1,
            "text-color": "#1a1a2e",
            "text-halo-color": "rgba(255,255,255,0.85)",
            "text-halo-width": 1.5
          }
        });

        // ── Alert overlay source ─────────────────────────────────────────
        map.addSource("alerts", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: alertDataRef.current.map((a) => ({
              type: "Feature" as const,
              id: a.id,
              geometry: { type: "Point" as const, coordinates: [a.lng, a.lat] },
              properties: { id: a.id, priority: a.priority, title: a.title, entityId: a.entityId }
            }))
          }
        });

        map.addLayer({
          id: "alert-circles",
          type: "circle",
          source: "alerts",
          layout: { visibility: "none" },
          paint: {
            "circle-radius": 9,
            "circle-color": "#dc2626",
            "circle-opacity": 0.85,
            "circle-stroke-color": "rgba(255,255,255,0.6)",
            "circle-stroke-width": 1.5
          }
        });

        // Pulsing ring — reduced-motion aware (added in startAnimations)
        map.addLayer({
          id: "alert-pulse",
          type: "circle",
          source: "alerts",
          layout: { visibility: "none" },
          paint: {
            "circle-radius": 9,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": "#dc2626",
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5
          }
        });

        // Alert click → popup
        map.on("click", "alert-circles", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const props = feature.properties as { priority: string; title: string; entityId: string };
          const coords = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates;
          popupRef.current
            ?.setLngLat(coords)
            .setHTML(
              `<div style="background:rgba(10,12,16,0.96);border:1px solid rgba(220,38,38,0.4);border-radius:8px;padding:10px 12px;min-width:200px;">
                <div style="font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#dc2626;margin-bottom:4px;">${escapeHtml(props.priority)}</div>
                <div style="font-size:12px;font-weight:600;color:#dde1ea;line-height:1.4;">${escapeHtml(props.title)}</div>
                <a href="/alerts" style="font-family:monospace;font-size:10px;color:#c9a961;margin-top:6px;display:block;">View alerts →</a>
              </div>`
            )
            .addTo(map);
        });

        map.on("mouseenter", "alert-circles", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "alert-circles", () => { map.getCanvas().style.cursor = ""; popupRef.current?.remove(); });

        // ── Animations ──────────────────────────────────────────────────

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let dashStep = 0;
        let pulsePhase = 0;

        function stopAnimations() {
          if (dashIntervalRef.current) clearInterval(dashIntervalRef.current);
          if (pulseFrameRef.current) cancelAnimationFrame(pulseFrameRef.current);
          dashIntervalRef.current = null;
          pulseFrameRef.current = null;
        }

        function animatePulse() {
          pulsePhase = (pulsePhase + 0.012) % 1;
          const t = Math.sin(pulsePhase * Math.PI * 2) * 0.5 + 0.5;
          if (map.getLayer("entity-rings")) {
            map.setPaintProperty("entity-rings", "circle-opacity", 0.06 + t * 0.14);
            map.setPaintProperty("entity-rings", "circle-stroke-opacity", 0.15 + t * 0.4);
          }
          pulseFrameRef.current = requestAnimationFrame(animatePulse);
        }

        function startAnimations() {
          if (reduceMotion || document.hidden || dashIntervalRef.current || pulseFrameRef.current) return;
          dashIntervalRef.current = setInterval(() => {
            dashStep = (dashStep + 1) % 24;
            const t = dashStep / 24;
            if (map.getLayer("connection-lines")) {
              map.setPaintProperty("connection-lines", "line-dasharray", [
                t * 3, 2, (1 - t) * 3
              ]);
            }
          }, 65);
          pulseFrameRef.current = requestAnimationFrame(animatePulse);
        }

        function handleVisibilityChange() {
          if (document.hidden) {
            stopAnimations();
          } else {
            startAnimations();
          }
        }
        document.addEventListener("visibilitychange", handleVisibilityChange);
        cleanupCallbacksRef.current.push(() => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          stopAnimations();
        });
        startAnimations();

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
              `<div style="background:rgba(10,12,16,0.94);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 14px;min-width:210px;max-width:260px;box-shadow:0 6px 20px rgba(0,0,0,0.5);">
                <div style="font-size:12px;font-weight:600;color:#dde1ea;letter-spacing:0.01em;line-height:1.4;">${escapeHtml(props.name)}</div>
                ${props.description ? `<div style="font-size:11px;color:#8892a4;margin-top:5px;line-height:1.5;">${escapeHtml(props.description)}</div>` : ""}
                <div style="display:flex;align-items:center;gap:10px;margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,0.06);">
                  <span style="font-family:monospace;font-size:11px;font-weight:500;color:${color};">Score ${props.score}</span>
                  <span style="font-family:monospace;font-size:10px;color:#5c6780;">${Math.round(props.confidence * 100)}% conf.</span>
                </div>
                <div style="display:flex;align-items:center;gap:5px;margin-top:6px;">
                  <span style="width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 5px ${color}60;display:inline-block;flex-shrink:0;"></span>
                  <span style="font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#404c61;">${escapeHtml(props.layer.replace("_", " "))}</span>
                </div>
              </div>`
            )
            .addTo(map);
        });

        map.on("mouseleave", "entity-symbols", () => {
          map.getCanvas().style.cursor = "";
          popupRef.current?.remove();
          if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
          tooltipTimerRef.current = null;
          setTooltipState(null);
        });

        // ── Substrate tooltip (debounced 200ms) ──────────────────────────
        map.on("mousemove", "entity-symbols", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const props = feature.properties as EntityProperties;
          const layer = props.layer as LayerKey;
          const mouseX = (e.originalEvent as MouseEvent).clientX;
          const mouseY = (e.originalEvent as MouseEvent).clientY;

          if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
          tooltipTimerRef.current = setTimeout(() => {
            const layerEntities = entityDataRef.current.filter((en) => en.layer === layer);
            const sorted = [...layerEntities].sort((a, b) => b.score - a.score);
            const topEntity = sorted[0] ?? null;
            const avgScore = layerEntities.reduce((sum, en) => sum + en.score, 0) / Math.max(1, layerEntities.length);
            const narrativeGap: SubstrateTooltipData["narrativeGap"] =
              avgScore > 74 ? "HIGH" : avgScore > 62 ? "MEDIUM" : "LOW";
            const delta = Math.round((props.score - 70) / 5);
            setTooltipState({
              layer,
              position: { x: mouseX, y: mouseY },
              data: {
                activeSignals: layerEntities.length,
                signalsDelta: delta,
                topEntity: topEntity ? { name: topEntity.name, confidence: topEntity.confidence } : null,
                narrativeGap,
                capitalTotal30d: layerEntities.reduce((sum, en) => sum + en.score * 1_200_000, 0)
              }
            });
          }, 200);
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
        const handleGeoClick = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const properties = feature.properties as { level?: GeoLevel; entityId?: string; path?: string };
          const path = (() => {
            try {
              return JSON.parse(properties.path ?? "[]") as string[];
            } catch {
              return [];
            }
          })();
          if (properties.entityId) {
            const entity = filteredEntitiesRef.current.find((entry) => entry.id === properties.entityId);
            if (entity) handleSearchSelect(entity);
            return;
          }
          const level = properties.level ?? "country";
          setGeoPath(path);
          setGeoZoomLevel(level);
          map.flyTo({
            center: (feature.geometry as unknown as { coordinates: [number, number] }).coordinates,
            zoom: zoomForLevel(level === "country" ? "state" : level === "state" ? "county" : "site"),
            duration: 850,
            essential: true
          });
        };

        for (const level of GEO_LEVELS) {
          map.on("click", `geo-${level}-circles`, handleGeoClick);
          map.on("click", `geo-${level}-labels`, handleGeoClick);
          map.on("mouseenter", `geo-${level}-circles`, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", `geo-${level}-circles`, () => { map.getCanvas().style.cursor = ""; });
          map.on("mouseenter", `geo-${level}-labels`, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", `geo-${level}-labels`, () => { map.getCanvas().style.cursor = ""; });
        }

        map.on("moveend", () => {
          setGeoZoomLevel(levelForZoom(map.getZoom()));
        });

        map.on("click", (e: MapMouseEvent) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["entity-symbols", "clusters", ...GEO_LEVELS.flatMap((level) => [`geo-${level}-circles`, `geo-${level}-labels`])]
          });
          if (features.length === 0) {
            setSelectedId(null);
            onEntitySelect?.(null);
          }
        });

        function buildClusterHTML(count: number, layerMap: Map<string, number> | null): string {
          const layerRows = layerMap
            ? Array.from(layerMap.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([key, cnt]) => {
                  const color = LAYER_COLORS[key as LayerKey] ?? "#888";
                  const label = LAYER_DISPLAY[key as LayerKey] ?? key;
                  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:5px;">
                    <div style="display:flex;align-items:center;gap:5px;">
                      <span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
                      <span style="font-family:monospace;font-size:10px;color:#8892a4;">${escapeHtml(label)}</span>
                    </div>
                    <span style="font-family:monospace;font-size:11px;font-weight:600;color:${color};">${cnt}</span>
                  </div>`;
                })
                .join("")
            : `<div style="font-family:monospace;font-size:10px;color:#404c61;margin-top:5px;">Loading…</div>`;

          return `<div style="background:rgba(10,12,16,0.94);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 14px;min-width:190px;box-shadow:0 6px 20px rgba(0,0,0,0.5);">
            <div style="font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#5c6780;margin-bottom:4px;">Substrate Cluster</div>
            <div style="font-size:16px;font-weight:700;color:#dde1ea;">${count} signals</div>
            ${layerRows}
            <div style="font-family:monospace;font-size:9px;color:#404c61;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05);">Click to zoom in</div>
          </div>`;
        }

        map.on("mousemove", "clusters", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          map.getCanvas().style.cursor = "pointer";
          const feature = e.features?.[0];
          if (!feature) return;
          const count = feature.properties?.point_count as number;
          const clusterId = feature.properties?.cluster_id as number;
          const coords = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates;

          // Show loading state immediately
          popupRef.current
            ?.setLngLat(coords)
            .setHTML(buildClusterHTML(count, null))
            .addTo(map);

          // Fetch layer breakdown asynchronously
          const source = map.getSource("entities") as GeoJSONSource;
          source.getClusterLeaves(clusterId, count, 0).then((leaves) => {
            const layerMap = new Map<string, number>();
            for (const leaf of leaves) {
              const layer = (leaf.properties as EntityProperties).layer as LayerKey;
              layerMap.set(layer, (layerMap.get(layer) ?? 0) + 1);
            }
            // Only update if popup is still showing (mouse still on cluster)
            if (popupRef.current?.isOpen()) {
              popupRef.current.setHTML(buildClusterHTML(count, layerMap));
            }
          }).catch(() => {});
        });
        map.on("mouseleave", "clusters", () => {
          map.getCanvas().style.cursor = "";
          popupRef.current?.remove();
        });

        setLoaded(true);
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (dashIntervalRef.current) clearInterval(dashIntervalRef.current);
      if (pulseFrameRef.current) cancelAnimationFrame(pulseFrameRef.current);
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      dashIntervalRef.current = null;
      pulseFrameRef.current = null;
      tooltipTimerRef.current = null;
      for (const cleanupCallback of cleanupCallbacksRef.current.splice(0)) cleanupCallback();
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
    const connSrc = map.getSource("connections") as GeoJSONSource | undefined;
    if (!connSrc) return;
    connSrc.setData(buildConnectionCollection(enabledKeys, selectedId, entityData, connectionData));
  }, [selectedId, loaded, enabledKeys, entityData, connectionData]);

  // ── Sync layer visibility + filters → entity source ──────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const enabledArr = Array.from(enabledKeys);

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

    const src = map.getSource("entities") as GeoJSONSource | undefined;
    if (src) {
      src.setData(buildEntityCollection(filteredEntities));
    }

    const connSrc = map.getSource("connections") as GeoJSONSource | undefined;
    if (connSrc) {
      connSrc.setData(buildConnectionCollection(enabledKeys, selectedId, filteredEntities, connectionDataRef.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, layers, filteredEntities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    for (const level of GEO_LEVELS) {
      const source = map.getSource(`geo-${level}`) as GeoJSONSource | undefined;
      if (source) source.setData(geoFeatures[level]);
    }
  }, [geoFeatures, loaded]);

  // ── Sync alert overlay visibility ─────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const vis = alertsVisible ? "visible" : "none";
    if (map.getLayer("alert-circles")) map.setLayoutProperty("alert-circles", "visibility", vis);
    if (map.getLayer("alert-pulse")) map.setLayoutProperty("alert-pulse", "visibility", vis);
  }, [alertsVisible, loaded]);

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

  const handleGeoNodeSelect = useCallback(
    (name: string) => {
      const node = geoNodes.find((entry) => entry.name === name);
      const map = mapRef.current;
      if (!node || !map) return;
      if (node.children.length) {
        setGeoPath((current) => [...current, node.name]);
        setGeoZoomLevel(node.level);
        map.flyTo({ center: [node.lng, node.lat], zoom: zoomForLevel(node.level === "country" ? "state" : node.level === "state" ? "county" : "site"), duration: 900, essential: true });
        return;
      }
      if (node.entityId) {
        const entity = filteredEntities.find((entry) => entry.id === node.entityId);
        if (entity) handleSearchSelect(entity);
      }
    },
    [filteredEntities, geoNodes, handleSearchSelect]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full overflow-hidden rounded-b-[var(--radius-lg)]">
      {/* Map canvas */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Search bar */}
      <div
        className="absolute left-3 top-3 z-10"
        style={{ width: 240 }}
      >
        {searchOpen ? (
          <div
            className="overflow-hidden rounded-[var(--radius-md)]"
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

      {/* Time range + confidence filter controls */}
      <div
        className="absolute right-3 z-10 rounded-[var(--radius-md)] p-2"
        style={{
          top: "calc(3rem + 230px)",
          background: "rgba(9,11,15,0.86)",
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-lg)",
          width: 148
        }}
      >
        <div
          className="mono px-1 pb-1.5 text-[10px] uppercase tracking-[0.14em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {filterLabels.timeRange}
        </div>
        <div className="flex flex-wrap gap-0.5 pb-2" style={{ borderBottom: "1px solid var(--line-faint)" }}>
          {(["7d", "30d", "90d", "1y", "all"] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className="mono rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] transition-colors"
              style={{
                background: timeRange === range ? "var(--rune-wash)" : "transparent",
                color: timeRange === range ? "var(--rune)" : "var(--text-tertiary)",
                border: `1px solid ${timeRange === range ? "rgba(201,169,97,0.3)" : "transparent"}`
              }}
            >
              {filterLabels[range]}
            </button>
          ))}
        </div>
        <div className="pt-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
              {filterLabels.confidence}
            </span>
            <span className="mono text-[9px]" style={{ color: "var(--rune)" }}>
              {minConfidence}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--rune)" }}
          />
        </div>
      </div>

      {/* Alert overlay toggle */}
      <div
        className="absolute right-3 z-10"
        style={{ top: "calc(3rem + 230px + 130px + 8px)" }}
      >
        <button
          type="button"
          onClick={() => setAlertsVisible((v) => !v)}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 transition-all"
          style={{
            background: alertsVisible ? "rgba(220,38,38,0.15)" : "rgba(9,11,15,0.86)",
            backdropFilter: "blur(14px) saturate(1.2)",
            WebkitBackdropFilter: "blur(14px) saturate(1.2)",
            border: alertsVisible ? "1px solid rgba(220,38,38,0.4)" : "1px solid var(--glass-border)",
            boxShadow: "var(--shadow-lg)"
          }}
        >
          <span
            className="inline-block rounded-full"
            style={{
              width: 6,
              height: 6,
              background: alertsVisible ? "#dc2626" : "var(--text-tertiary)",
              boxShadow: alertsVisible ? "0 0 5px rgba(220,38,38,0.7)" : "none"
            }}
          />
          <span
            className="mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: alertsVisible ? "#dc2626" : "var(--text-tertiary)" }}
          >
            {alertOverlayLabel}
          </span>
        </button>
      </div>

      {/* Geographic drill-down */}
      <div
        className="absolute bottom-3 left-3 z-10 max-w-[280px] rounded-[var(--radius-md)] p-3"
        style={{
          background: "rgba(9,11,15,0.86)",
          backdropFilter: "blur(14px) saturate(1.2)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-lg)"
        }}
      >
        <div className="mono mb-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
          Geographic Drill · {geoZoomLevel}
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setGeoPath([])}
            className="mono rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]"
            style={{ background: geoPath.length === 0 ? "var(--rune-wash)" : "transparent", color: geoPath.length === 0 ? "var(--rune)" : "var(--text-tertiary)" }}
          >
            Global
          </button>
          {geoPath.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setGeoPath(geoPath.slice(0, index + 1))}
              className="mono rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]"
              style={{ background: "transparent", color: "var(--text-tertiary)" }}
            >
              {step}
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          {geoNodes.slice(0, 6).map((node) => (
            <button
              key={`${node.level}:${node.name}`}
              type="button"
              onClick={() => handleGeoNodeSelect(node.name)}
              className="flex items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors hover:bg-white/5"
            >
              <div className="min-w-0">
                <div className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>
                  {node.name}
                </div>
                <div className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
                  {node.level}
                </div>
              </div>
              <span className="mono text-[10px]" style={{ color: "var(--rune)" }}>
                {node.signalCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading overlay */}
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(245,245,240,0.95)" }}
        >
          <div
            className="mono text-[11px] uppercase tracking-[0.14em]"
            style={{
              color: "#666",
              animation: "glow-pulse 2s ease-in-out infinite"
            }}
          >
            Loading substrate map
          </div>
        </div>
      )}

      {/* Substrate tooltip */}
      {tooltipState && (
        <SubstrateTooltip
          layer={tooltipState.layer}
          position={tooltipState.position}
          data={tooltipState.data}
          labels={tooltipLabels}
        />
      )}
    </div>
  );
}

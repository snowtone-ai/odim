"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { Map as MapType, GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from "maplibre-gl";
import { DEMO_ENTITIES } from "@/lib/map/entities";
import { DEMO_CONNECTIONS } from "@/lib/map/connections";
import type { LayerKey, MapEntity, MapConnection } from "@/lib/map/types";

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

type Props = Readonly<{
  layerLabels: string[];
  selectLabel: string;
  searchHint?: string;
  onEntitySelect?: (entity: MapEntity | null) => void;
  entities?: MapEntity[];
  connections?: MapConnection[];
  /** Pre-filter to a specific layer (e.g. from Huginn navigation) */
  initialFilter?: LayerKey | null;
  /** Initial map center from Huginn region detection */
  initialCenter?: { lat: number; lng: number; zoom?: number };
}>;

// ─── Component ────────────────────────────────────────────────────────────────

export function RealityMap({
  layerLabels,
  selectLabel,
  searchHint = "Search entities…",
  onEntitySelect,
  entities: entityData = DEMO_ENTITIES,
  connections: connectionData = DEMO_CONNECTIONS,
  initialFilter = null,
  initialCenter
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const popupRef = useRef<InstanceType<
    typeof import("maplibre-gl")["Popup"]
  > | null>(null);
  const dashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseFrameRef = useRef<number | null>(null);
  const cleanupCallbacksRef = useRef<Array<() => void>>([]);

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
      enabled: initialFilter ? key === initialFilter : true
    }))
  );

  const entityDataRef = useRef(entityData);
  const connectionDataRef = useRef(connectionData);
  useEffect(() => { entityDataRef.current = entityData; }, [entityData]);
  useEffect(() => { connectionDataRef.current = connectionData; }, [connectionData]);

  const enabledKeys = useMemo(
    () => new Set(layers.filter((l) => l.enabled).map((l) => l.key)),
    [layers]
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
      dashIntervalRef.current = null;
      pulseFrameRef.current = null;
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

  // ── Sync layer visibility → entity source filter ──────────────────────────

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
      src.setData(
        buildEntityCollection(
          entityDataRef.current.filter((e) => enabledKeys.has(e.layer))
        )
      );
    }

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
    </div>
  );
}

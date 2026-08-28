"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X
} from "lucide-react";
import type { Map as MapType, GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from "maplibre-gl";
import { DEMO_ENTITIES, filterEntities, isNewEntity, type TimeRange } from "@/lib/map/entities";
import { DEMO_CONNECTIONS } from "@/lib/map/connections";
import type { LayerKey, MapEntity, MapConnection, MapAlert } from "@/lib/map/types";
import { SubstrateTooltip, type SubstrateTooltipData } from "@/components/ui/substrate-tooltip";
import { EvidenceThread } from "@/components/ui/evidence-thread";
import { DailyDiffPanel } from "@/components/ui/daily-diff";
import { aggregateByGeo, buildGeoFeatureCollections, levelForZoom, zoomForLevel, type GeoLevel } from "@/lib/map/geo-drill";
import type { DailyDiff } from "@/lib/pipeline/diff";

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
  energy:        "#5cc6d2",
  cash:          "#5cc6d2",
  land:          "#5cc6d2",
  compute:       "#5cc6d2",
  water:         "#5cc6d2",
  raw_materials: "#5cc6d2",
  logistics:     "#5cc6d2"
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

// ─── Inline popup colors ───────────────────────────────────────────────────────
// CSS custom properties (var(--…)) cannot be used inside MapLibre setHTML strings.
// These values mirror styles/tokens.css — update both when design tokens change.
const POPUP_COLORS = {
  bg:          "#131d26",
  border:      "rgba(232,239,242,0.15)",
  borderAlert: "rgba(226,116,91,0.6)",
  divider:     "rgba(232,239,242,0.12)",
  primary:     "#e8eff2",
  secondary:   "#a2adb4",
  tertiary:    "#7d8990",
  rune:        "#4c90f0",
  critical:    "#e2745b"
} as const;

// Official OpenFreeMap Dark style — public, keyless, and visually continuous with Field.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
const MAP_TRANSITION_MS = 280;

function mapTransitionDuration() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : MAP_TRANSITION_MS;
}

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

  // Circle background
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
  ctx.fill();

  // Restrained field ring and an icon shape keep categories discernible without color coding.
  ctx.strokeStyle = "rgba(232,239,242,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Field-colored symbol
  ctx.fillStyle = "#0a1016";
  ctx.strokeStyle = "#0a1016";
  ctx.lineWidth = 1;
  const sr = circleR * 0.52;
  ICON_DRAWERS[layer](ctx, cx, cy, sr);

  return ctx.getImageData(0, 0, size, size);
}

/**
 * OpenFreeMap's public styles can reference a small sprite that is absent from
 * the fetched sprite sheet (currently circle-11). Register a local substitute
 * as soon as MapLibre asks for it, before the first style render.
 */
function createMissingStyleImage(imageId: string): ImageData {
  const match = /^circle-(\d+)$/.exec(imageId);
  const size = Math.max(11, Math.min(32, match ? Number(match[1]) : 16));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const center = size / 2;
  const radius = Math.max(2, center - 1.25);

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(19,29,38,0.92)";
  ctx.fill();
  ctx.lineWidth = Math.max(1, size / 12);
  ctx.strokeStyle = "#5cc6d2";
  ctx.stroke();

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
    ctx.font = `bold ${r * 1.5}px "Noto Sans", sans-serif`;
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
  selected: boolean;
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
  const entityById = new Map(allEntities.map((entity) => [entity.id, entity]));
  return {
    type: "FeatureCollection" as const,
    features: allConnections.flatMap((conn) => {
      const from = entityById.get(conn.fromId);
      const to = entityById.get(conn.toId);
      if (!from || !to) return [];
      if (!visible.has(from.layer) || !visible.has(to.layer)) return [];

      const isRelated =
        selectedId === null ||
        conn.fromId === selectedId ||
        conn.toId === selectedId;
      const isSelectedPath = selectedId !== null && isRelated;

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
            active: conn.active,
            selected: isSelectedPath
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
  confidence: "Confidence",
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
  dailyDiff?: DailyDiff;
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
  alertOverlayLabel = "Alerts",
  dailyDiff
}: Props) {
  // The map route already passes the translated message groups as props. Keep
  // that contract and use the existing labels to select the few strings that
  // are owned by this canvas (popups and recovery states).
  const isJapanese = /[ぁ-んァ-ヶ一-龯]/.test(searchHint)
    || /[ぁ-んァ-ヶ一-龯]/.test(filterLabels.label)
    || layerLabels.some((label) => /[ぁ-んァ-ヶ一-龯]/.test(label));
  const layerDisplay = Object.fromEntries(
    LAYER_KEYS.map((key, index) => [key, layerLabels[index] ?? LAYER_DISPLAY[key]])
  ) as Record<LayerKey, string>;
  const copy = isJapanese
    ? {
        workspace: "現実の動きマップ",
        closeSearch: "検索を閉じる",
        resetWorkspace: "マップ表示をリセット",
        fixtureStatus: "検証用データの地図・実データではありません",
        entitySearchResults: "対象の検索結果",
        noFixtureMatch: "この検索に一致する検証用の対象はありません。",
        searchByName: "名前または情報の層で対象を検索",
        mapScope: "表示範囲",
        global: "全体",
        selectedEntity: (name: string) => `選択中の対象: ${name}`,
        closeSelectedEntity: "選択中の対象を閉じる",
        fixtureEntity: "検証用の対象・実データではありません",
        noDescription: "この対象の説明はありません。",
        score: "スコア",
        confidence: "信頼度",
        scope: "範囲",
        evidencePath: "根拠の流れ",
        fixtureEvidencePath: "検証用データの根拠の流れ",
        fixtureData: "検証用データ",
        notLive: "実データではありません",
        linkedObjects: (count: number) => `関連対象 ${count}件`,
        review: "確認",
        openEntityWorkspace: "対象の分析画面を開く",
        newFixtureRecord: "新しい検証用記録",
        fixtureRecord: "検証用記録",
        inspectEntity: "対象を確認",
        basemapError: "公開された暗色の地図を読み込めませんでした。",
        rendererError: "地図表示を開始できませんでした。",
        basemapUnavailable: "暗色の地図を利用できません",
        retryMap: "地図を再試行",
        loadingBasemap: "暗色の地図を読み込み中",
        popupViewAlerts: "アラートを見る →",
        popupScore: "スコア",
        popupConfidence: "信頼度",
        popupLoading: "読み込み中…",
        popupCluster: "情報の層クラスター",
        popupSignals: (count: number) => `${count}件の兆候`,
        popupZoom: "クリックして拡大"
      }
    : {
        workspace: "Reality map workspace",
        closeSearch: "Close search",
        resetWorkspace: "Reset map workspace",
        fixtureStatus: "Fixture map · not live",
        entitySearchResults: "Entity search results",
        noFixtureMatch: "No fixture entities match this search.",
        searchByName: "Search fixture entities by name or substrate.",
        mapScope: "Map scope",
        global: "Global",
        selectedEntity: (name: string) => `Selected entity: ${name}`,
        closeSelectedEntity: "Close selected entity",
        fixtureEntity: "fixture entity · not live",
        noDescription: "No fixture description is available for this entity.",
        score: "Score",
        confidence: "Confidence",
        scope: "Scope",
        evidencePath: "Evidence path",
        fixtureEvidencePath: "Fixture evidence path",
        fixtureData: "Fixture data",
        notLive: "not live",
        linkedObjects: (count: number) => `${count} linked objects`,
        review: "Review",
        openEntityWorkspace: "open entity workspace",
        newFixtureRecord: "New fixture record",
        fixtureRecord: "Fixture record",
        inspectEntity: "Inspect entity",
        basemapError: "The public dark basemap could not be loaded.",
        rendererError: "The map renderer could not be started.",
        basemapUnavailable: "Dark basemap unavailable",
        retryMap: "Retry map",
        loadingBasemap: "Loading dark basemap",
        popupViewAlerts: "View alerts →",
        popupScore: "Score",
        popupConfidence: "conf.",
        popupLoading: "Loading…",
        popupCluster: "Substrate cluster",
        popupSignals: (count: number) => `${count} signals`,
        popupZoom: "Click to zoom in"
      };

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const popupRef = useRef<InstanceType<
    typeof import("maplibre-gl")["Popup"]
  > | null>(null);
  const dashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseFrameRef = useRef<number | null>(null);
  const cleanupCallbacksRef = useRef<Array<() => void>>([]);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const animationControllerRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tooltipState, setTooltipState] = useState<{
    layer: LayerKey;
    position: { x: number; y: number };
    data: SubstrateTooltipData;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const inspectorCloseRef = useRef<HTMLButtonElement>(null);
  const inspectorRestoreFocusRef = useRef<HTMLElement | null>(null);
  const mobileInspectorOpenRef = useRef(false);

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
  useEffect(() => {
    selectedIdRef.current = selectedId;
    animationControllerRef.current?.start();
  }, [selectedId]);

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
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return entityData
      .filter((entity) => entity.name.toLowerCase().includes(query) || entity.layer.toLowerCase().includes(query))
      .slice(0, 6);
  }, [entityData, searchQuery]);

  // ── Map init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    let styleReady = false;

    setLoaded(false);
    setMapError(null);

    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: initialCenter ? [initialCenter.lng, initialCenter.lat] : [-98.6, 39.8],
        zoom: initialCenter?.zoom ?? 3,
        minZoom: 1,
        maxZoom: 16,
        attributionControl: { compact: true }
      });

      const installMissingStyleImage = (imageId: string) => {
        if (cancelled || map.hasImage(imageId)) return;
        try {
          if (LAYER_KEYS.includes(imageId as LayerKey)) {
            map.addImage(imageId, createLayerIcon(imageId as LayerKey), { sdf: false });
            return;
          }
          map.addImage(imageId, createMissingStyleImage(imageId), { sdf: false });
        } catch {
          // The map may have been torn down between a style-image request and registration.
        }
      };

      // Register before load: the public basemap can request circle-11 during
      // its first render, before the load callback runs.
      map.on("styleimagemissing", (event: { id: string }) => {
        installMissingStyleImage(event.id);
      });

      const markStyleError = () => {
        if (!styleReady && !cancelled) {
          setMapError(copy.basemapError);
        }
      };
      map.on("error", markStyleError);
      loadTimeoutRef.current = setTimeout(markStyleError, 12_000);

      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "odim-popup",
        offset: 14
      });

      map.on("load", () => {
        if (cancelled) return;
        styleReady = true;
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
        setMapError(null);

        // Register canvas-rendered icons (Maki-style, pre-colored)
        LAYER_KEYS.forEach((key) => {
          installMissingStyleImage(key);
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
            "line-opacity": [
              "*",
              ["get", "opacity"],
              ["case", ["get", "selected"], 1, 0.46]
            ],
            "line-dasharray": [0, 2, 3]
          }
        });

        // A static, line-following arrow preserves fromId → toId direction
        // even when reduced motion disables the selected-path dash animation.
        map.addLayer({
          id: "connection-direction-arrows",
          type: "symbol",
          source: "connections",
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 150,
            "text-field": "→",
            "text-font": ["Noto Sans Regular"],
            "text-size": 13,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
            "text-keep-upright": false,
            "text-rotation-alignment": "map",
            "text-pitch-alignment": "map"
          },
          paint: {
            "text-color": ["get", "color"],
            "text-opacity": ["*", ["get", "opacity"], 0.78],
            "text-halo-color": "#0a1016",
            "text-halo-width": 1
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

        // The selected object carries the only animated map affordance.
        map.addLayer({
          id: "entity-selected-ring",
          type: "circle",
          source: "entities",
          filter: ["==", ["get", "id"], "__none__"],
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1, 14,
              6, 22,
              12, 32
            ],
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": "#4c90f0",
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.86
          }
        });

        // ── Cluster circles ──────────────────────────────────────────────
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "entities",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#131d26",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              18, 3, 24, 6, 30
            ],
            "circle-stroke-color": "#5cc6d2",
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
            "text-font": ["Noto Sans Regular"],
            "text-allow-overlap": true
          },
          paint: {
            "text-color": "#e8eff2"
          }
        });
        const geoZoomConfig: Record<GeoLevel, { minzoom?: number; maxzoom?: number }> = {
          country: { maxzoom: 4.5 },
          state: { minzoom: 4.5, maxzoom: 7.5 },
          county: { minzoom: 7.5, maxzoom: 10.5 },
          site: { minzoom: 10.5 }
        };
        for (const level of GEO_LEVELS) {
          map.addLayer({
            id: `geo-${level}-labels`,
            type: "symbol",
            source: `geo-${level}`,
            minzoom: geoZoomConfig[level].minzoom,
            maxzoom: geoZoomConfig[level].maxzoom,
            layout: {
              "text-field": ["get", "name"],
              "text-size": level === "country" ? 13 : level === "state" ? 11 : 10,
              "text-allow-overlap": false,
              "text-font": ["Noto Sans Regular"]
            },
            paint: {
              "text-color": level === "site" ? "#5cc6d2" : "rgba(232,239,242,0.76)",
              "text-halo-color": "rgba(10,16,22,0.88)",
              "text-halo-width": 1.2
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
            "text-font": ["Noto Sans Regular"],
            "text-offset": [0, 1.8],
            "text-anchor": "top",
            "text-optional": true,
            "text-max-width": 10
          },
          paint: {
            "icon-opacity": 1,
            "text-color": "#e8eff2",
            "text-halo-color": "rgba(10,16,22,0.88)",
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
            "circle-color": "#e2745b",
            "circle-opacity": 0.85,
            "circle-stroke-color": "rgba(232,239,242,0.7)",
            "circle-stroke-width": 1.5
          }
        });

        // Alert ring remains static; selected-entity context owns map motion.
        map.addLayer({
          id: "alert-pulse",
          type: "circle",
          source: "alerts",
          layout: { visibility: "none" },
          paint: {
            "circle-radius": 9,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": "#e2745b",
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
              `<div style="background:${POPUP_COLORS.bg};border:1px solid ${POPUP_COLORS.borderAlert};border-radius:4px;padding:10px 12px;min-width:200px;">
                <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:${POPUP_COLORS.critical};margin-bottom:4px;">${escapeHtml(props.priority)}</div>
                <div style="font-size:12px;font-weight:600;color:${POPUP_COLORS.primary};line-height:1.4;">${escapeHtml(props.title)}</div>
                <a href="/alerts" style="font-family:monospace;font-size:11px;color:${POPUP_COLORS.rune};margin-top:6px;display:block;">${escapeHtml(copy.popupViewAlerts)}</a>
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
          if (!selectedIdRef.current || document.hidden) {
            pulseFrameRef.current = null;
            return;
          }
          pulsePhase = (pulsePhase + 0.012) % 1;
          const t = Math.sin(pulsePhase * Math.PI * 2) * 0.5 + 0.5;
          if (map.getLayer("entity-selected-ring")) {
            map.setPaintProperty("entity-selected-ring", "circle-radius", 18 + t * 8);
            map.setPaintProperty("entity-selected-ring", "circle-stroke-opacity", 0.48 + t * 0.42);
          }
          pulseFrameRef.current = requestAnimationFrame(animatePulse);
        }

        function startAnimations() {
          if (reduceMotion || document.hidden) return;
          if (!dashIntervalRef.current) {
            dashIntervalRef.current = setInterval(() => {
              dashStep = (dashStep + 1) % 24;
              const t = dashStep / 24;
              if (map.getLayer("connection-lines")) {
                map.setPaintProperty("connection-lines", "line-dasharray", [
                  t * 3, 2, (1 - t) * 3
                ]);
              }
            }, 65);
          }
          if (selectedIdRef.current && !pulseFrameRef.current) {
            pulseFrameRef.current = requestAnimationFrame(animatePulse);
          }
        }

        function handleVisibilityChange() {
          if (document.hidden) {
            stopAnimations();
          } else {
            startAnimations();
          }
        }
        animationControllerRef.current = { start: startAnimations, stop: stopAnimations };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        cleanupCallbacksRef.current.push(() => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          stopAnimations();
          animationControllerRef.current = null;
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
              `<div style="background:${POPUP_COLORS.bg};border:1px solid ${POPUP_COLORS.border};border-radius:4px;padding:12px 14px;min-width:210px;max-width:260px;">
                <div style="font-size:12px;font-weight:600;color:${POPUP_COLORS.primary};letter-spacing:0.01em;line-height:1.4;">${escapeHtml(props.name)}</div>
                ${props.description ? `<div style="font-size:11px;color:${POPUP_COLORS.secondary};margin-top:5px;line-height:1.5;">${escapeHtml(props.description)}</div>` : ""}
                <div style="display:flex;align-items:center;gap:10px;margin-top:8px;padding-top:7px;border-top:1px solid ${POPUP_COLORS.divider};">
                  <span style="font-family:monospace;font-size:11px;font-weight:500;color:${color};">${escapeHtml(copy.popupScore)} ${props.score}</span>
                  <span style="font-family:monospace;font-size:11px;color:${POPUP_COLORS.secondary};">${Math.round(props.confidence * 100)}% ${escapeHtml(copy.popupConfidence)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:5px;margin-top:6px;">
                  <span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
                  <span style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:${POPUP_COLORS.tertiary};">${escapeHtml(layerDisplay[props.layer] ?? props.layer.replace("_", " "))}</span>
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
            duration: mapTransitionDuration(),
            essential: false
          });
        });

        // ── Interaction: click cluster → zoom ────────────────────────────
        map.on("click", "clusters", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const clusterId = feature.properties?.cluster_id as number;
          const source = map.getSource("entities") as GeoJSONSource;
          source.getClusterExpansionZoom(clusterId).then((zoom) => {
            if (cancelled) return;
            map.flyTo({
              center: (feature.geometry as unknown as { coordinates: [number, number] }).coordinates,
              zoom,
              duration: mapTransitionDuration(),
              essential: false
            });
          }).catch(() => {});
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
            duration: mapTransitionDuration(),
            essential: false
          });
        };

        for (const level of GEO_LEVELS) {
          map.on("click", `geo-${level}-labels`, handleGeoClick);
          map.on("mouseenter", `geo-${level}-labels`, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", `geo-${level}-labels`, () => { map.getCanvas().style.cursor = ""; });
        }

        map.on("moveend", () => {
          setGeoZoomLevel(levelForZoom(map.getZoom()));
        });

        map.on("click", (e: MapMouseEvent) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["entity-symbols", "clusters", ...GEO_LEVELS.map((level) => `geo-${level}-labels`)]
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
                  const label = layerDisplay[key as LayerKey] ?? key;
                  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:5px;">
                    <div style="display:flex;align-items:center;gap:5px;">
                      <span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
                      <span style="font-family:monospace;font-size:11px;color:${POPUP_COLORS.secondary};">${escapeHtml(label)}</span>
                    </div>
                    <span style="font-family:monospace;font-size:11px;font-weight:600;color:${color};">${cnt}</span>
                  </div>`;
                })
                .join("")
            : `<div style="font-family:monospace;font-size:11px;color:${POPUP_COLORS.tertiary};margin-top:5px;">${escapeHtml(copy.popupLoading)}</div>`;

          return `<div style="background:${POPUP_COLORS.bg};border:1px solid ${POPUP_COLORS.border};border-radius:4px;padding:12px 14px;min-width:190px;">
            <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:${POPUP_COLORS.tertiary};margin-bottom:4px;">${escapeHtml(copy.popupCluster)}</div>
            <div style="font-size:16px;font-weight:700;color:${POPUP_COLORS.primary};">${escapeHtml(copy.popupSignals(count))}</div>
            ${layerRows}
            <div style="font-family:monospace;font-size:11px;color:${POPUP_COLORS.tertiary};margin-top:8px;padding-top:6px;border-top:1px solid ${POPUP_COLORS.divider};">${escapeHtml(copy.popupZoom)}</div>
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
            if (cancelled) return;
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
    }).catch(() => {
      if (!cancelled) setMapError(copy.rendererError);
    });

    return () => {
      cancelled = true;
      if (dashIntervalRef.current) clearInterval(dashIntervalRef.current);
      if (pulseFrameRef.current) cancelAnimationFrame(pulseFrameRef.current);
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      dashIntervalRef.current = null;
      pulseFrameRef.current = null;
      tooltipTimerRef.current = null;
      loadTimeoutRef.current = null;
      for (const cleanupCallback of cleanupCallbacksRef.current.splice(0)) cleanupCallback();
      popupRef.current?.remove();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapAttempt]);

  // ── Sync selected entity → connection highlight ───────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const connSrc = map.getSource("connections") as GeoJSONSource | undefined;
    if (!connSrc) return;
    connSrc.setData(buildConnectionCollection(enabledKeys, selectedId, entityData, connectionData));
    if (map.getLayer("entity-selected-ring")) {
      map.setFilter("entity-selected-ring", ["==", ["get", "id"], selectedId ?? "__none__"]);
    }
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
        duration: mapTransitionDuration(),
        essential: false
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
        map.flyTo({ center: [node.lng, node.lat], zoom: zoomForLevel(node.level === "country" ? "state" : node.level === "state" ? "county" : "site"), duration: mapTransitionDuration(), essential: false });
        return;
      }
      if (node.entityId) {
        const entity = filteredEntities.find((entry) => entry.id === node.entityId);
        if (entity) handleSearchSelect(entity);
      }
    },
    [filteredEntities, geoNodes, handleSearchSelect]
  );

  const selectedEntity = useMemo(
    () => (selectedId ? entityData.find((entity) => entity.id === selectedId) ?? null : null),
    [entityData, selectedId]
  );
  const relatedConnections = useMemo(
    () => selectedEntity
      ? connectionData.filter((connection) => connection.fromId === selectedEntity.id || connection.toId === selectedEntity.id)
      : [],
    [connectionData, selectedEntity]
  );

  const clearSelection = useCallback(() => {
    const restoreTarget = inspectorRestoreFocusRef.current;
    inspectorRestoreFocusRef.current = null;
    setSelectedId(null);
    onEntitySelect?.(null);
    popupRef.current?.remove();
    if (restoreTarget?.isConnected) {
      window.requestAnimationFrame(() => restoreTarget.focus());
    }
  }, [onEntitySelect]);

  useEffect(() => {
    if (!selectedEntity) {
      mobileInspectorOpenRef.current = false;
      inspectorRestoreFocusRef.current = null;
      return;
    }
    if (!window.matchMedia("(max-width: 767px)").matches || mobileInspectorOpenRef.current) return;

    mobileInspectorOpenRef.current = true;
    const activeElement = document.activeElement;
    inspectorRestoreFocusRef.current =
      activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null;
    const frame = window.requestAnimationFrame(() => inspectorCloseRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [selectedEntity]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !window.matchMedia("(max-width: 767px)").matches || !selectedIdRef.current) return;
      event.preventDefault();
      clearSelection();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection]);

  const resetWorkspace = useCallback(() => {
    setLayers((current) => current.map((layer) => ({ ...layer, enabled: true })));
    setTimeRange("30d");
    setMinConfidence(0);
    setAlertsVisible(false);
    setGeoPath([]);
    setSearchOpen(false);
    setSearchQuery("");
    setFiltersOpen(false);
    clearSelection();
    mapRef.current?.flyTo({ center: [-98.6, 39.8], zoom: 3, duration: mapTransitionDuration(), essential: false });
  }, [clearSelection]);

  const retryMap = useCallback(() => {
    setMapError(null);
    setMapAttempt((attempt) => attempt + 1);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="relative h-full w-full overflow-hidden bg-[var(--field)]" aria-label={copy.workspace}>
      {/* Map canvas */}
      <div ref={containerRef} className="h-full w-full" />

      {/* One command strip keeps search, scope, and recovery within the working canvas. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20">
        <div
          data-testid="map-command-strip"
          className="pointer-events-auto overflow-hidden border bg-[var(--surface-primary)]"
          style={{ borderColor: "var(--line-soft)" }}
        >
          <div className="flex min-h-11 flex-wrap items-stretch gap-1 p-1.5">
            <div className="flex min-h-11 min-w-[min(100%,220px)] flex-1 items-center border px-2" style={{ borderColor: "var(--line-soft)", background: "var(--field)" }}>
              <Search size={16} aria-hidden="true" style={{ color: "var(--text-secondary)" }} />
              {searchOpen ? (
                <>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={searchHint}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent px-2 text-[13px] outline-none"
                    style={{ color: "var(--text-primary)" }}
                    aria-label={searchHint}
                  />
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className="odim-icon-control min-h-11 min-w-11"
                    aria-label={copy.closeSearch}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(true);
                  }}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left text-[13px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span className="truncate">{searchHint}</span>
                  <kbd className="mono ml-auto hidden border px-1 text-[11px] sm:inline" style={{ borderColor: "var(--line-soft)", color: "var(--text-tertiary)" }}>/</kbd>
                </button>
              )}
            </div>

            <label className="odim-control flex min-h-11 items-center px-2 text-[12px]" style={{ background: "var(--field)" }}>
              <span className="sr-only">{filterLabels.timeRange}</span>
              <select
                name="map-period"
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value as TimeRange)}
                className="min-h-11 bg-transparent pr-1 outline-none"
                style={{ color: "var(--text-primary)" }}
                aria-label={filterLabels.timeRange}
              >
                {(["7d", "30d", "90d", "1y", "all"] as const).map((range) => (
                  <option key={range} value={range}>{filterLabels[range]}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="odim-control flex min-h-11 items-center gap-2 px-3 text-[12px]"
              aria-expanded={filtersOpen}
              aria-controls="map-filter-controls"
              style={{ background: filtersOpen ? "var(--signal-wash)" : "var(--field)" }}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span className="hidden sm:inline">{filterLabels.label}</span>
              <span className="mono text-[11px]" style={{ color: "var(--text-secondary)" }}>{layers.filter((layer) => layer.enabled).length}/{layers.length}</span>
              {filtersOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            </button>

            <button
              type="button"
              onClick={resetWorkspace}
              className="odim-control odim-icon-control min-h-11 min-w-11"
              style={{ background: "var(--field)" }}
              aria-label={copy.resetWorkspace}
              title={copy.resetWorkspace}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>

            <span
              data-testid="map-fixture-status"
              className="mono hidden min-h-11 items-center border px-2 text-[11px] tracking-[0.04em] xl:inline-flex"
              style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}
            >
              {copy.fixtureStatus}
            </span>
          </div>

          {searchOpen ? (
            <div className="border-t" style={{ borderColor: "var(--line-soft)" }}>
              {searchResults.length > 0 ? (
                <div role="listbox" aria-label={copy.entitySearchResults} className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
                  {searchResults.map((entity) => (
                    <button
                      key={entity.id}
                      type="button"
                      onClick={() => handleSearchSelect(entity)}
                      className="flex min-h-11 w-full items-center gap-3 px-3 text-left hover:bg-[var(--surface-hover)]"
                      role="option"
                    >
                      <MapPin size={16} aria-hidden="true" style={{ color: "var(--evidence)" }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]" style={{ color: "var(--text-primary)" }}>{entity.name}</span>
                        <span className="mono block text-[11px]" style={{ color: "var(--text-secondary)" }}>{layerDisplay[entity.layer]} · {copy.score.toLowerCase()} {entity.score}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <p className="px-3 py-3 text-[12px]" style={{ color: "var(--text-secondary)" }}>{copy.noFixtureMatch}</p>
              ) : (
                <p className="px-3 py-3 text-[12px]" style={{ color: "var(--text-secondary)" }}>{copy.searchByName}</p>
              )}
            </div>
          ) : null}

          {filtersOpen ? (
            <div id="map-filter-controls" className="border-t px-3 py-3" style={{ borderColor: "var(--line-soft)" }}>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <fieldset>
                  <legend className="mono mb-2 text-[11px] tracking-[0.04em]" style={{ color: "var(--text-secondary)" }}>{selectLabel}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {layers.map((layer) => (
                      <button
                        key={layer.key}
                        type="button"
                        onClick={() => toggleLayer(layer.key)}
                        className="odim-control min-h-11 px-3 text-[12px]"
                        aria-pressed={layer.enabled}
                        style={{
                          background: layer.enabled ? "var(--signal-wash)" : "var(--field)",
                          color: layer.enabled ? "var(--text-primary)" : "var(--text-secondary)"
                        }}
                      >
                        {layer.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-3 border-l-0 pt-3 lg:border-l lg:pl-3 lg:pt-0" style={{ borderColor: "var(--line-soft)" }}>
                  <label className="block">
                    <span className="mb-1 flex items-center justify-between text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      <span>{filterLabels.confidence}</span>
                      <span className="mono" style={{ color: "var(--text-primary)" }}>{minConfidence}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={minConfidence}
                      onChange={(event) => setMinConfidence(Number(event.target.value))}
                      className="w-full"
                      style={{ accentColor: "var(--signal)" }}
                      aria-label={filterLabels.confidence}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setAlertsVisible((visible) => !visible)}
                    className="odim-control flex min-h-11 items-center justify-between px-3 text-[12px]"
                    aria-pressed={alertsVisible}
                    style={{ background: alertsVisible ? "var(--critical-wash)" : "var(--field)" }}
                  >
                    <span>{alertOverlayLabel}</span>
                    <AlertTriangle size={16} aria-hidden="true" style={{ color: alertsVisible ? "var(--critical)" : "var(--text-secondary)" }} />
                  </button>
                </div>
              </div>

              {geoPath.length > 0 ? (
                <nav aria-label={copy.mapScope} className="mt-3 flex min-h-11 flex-wrap items-center gap-1 border-t pt-3" style={{ borderColor: "var(--line-soft)" }}>
                  <button type="button" onClick={() => { setGeoPath([]); mapRef.current?.flyTo({ center: [-98.6, 39.8], zoom: 3, duration: mapTransitionDuration(), essential: false }); }} className="mono px-1 text-[11px]" style={{ color: "var(--signal)" }}>{copy.global}</button>
                  {geoPath.map((step, index) => (
                    <span key={`${step}-${index}`} className="flex items-center gap-1">
                      <span aria-hidden="true" style={{ color: "var(--text-tertiary)" }}>/</span>
                      <button type="button" onClick={() => setGeoPath(geoPath.slice(0, index + 1))} className="mono px-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>{step}</button>
                    </span>
                  ))}
                </nav>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {dailyDiff ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-[84px] z-20 md:inset-x-auto md:bottom-3 md:left-3 md:w-[340px]">
          <div className="pointer-events-auto">
            <DailyDiffPanel diff={dailyDiff} selectionActive={Boolean(selectedEntity)} locale={isJapanese ? "ja" : "en"} />
          </div>
        </div>
      ) : null}

      {selectedEntity ? (
        <aside
          data-testid="map-inspector"
          aria-label={copy.selectedEntity(selectedEntity.name)}
          className="absolute inset-x-3 bottom-[84px] z-20 max-h-[44dvh] overflow-y-auto border bg-[var(--surface)] animate-slide-up md:inset-x-auto md:bottom-3 md:right-3 md:top-[148px] md:max-h-none md:w-[360px]"
          style={{ borderColor: "var(--line-soft)" }}
        >
          <header className="flex min-h-11 items-start justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line-soft)" }}>
            <div className="min-w-0">
              <p className="mono mb-1 text-[11px] tracking-[0.04em]" style={{ color: "var(--evidence)" }}>
                {layerDisplay[selectedEntity.layer]} · {copy.fixtureEntity}
              </p>
              <h2 className="text-[18px] font-medium leading-6 tracking-[-0.01em]" style={{ color: "var(--text-primary)" }}>{selectedEntity.name}</h2>
            </div>
            <button
              type="button"
              ref={inspectorCloseRef}
              onClick={clearSelection}
              className="odim-control odim-icon-control min-h-11 min-w-11 shrink-0"
              style={{ background: "var(--field)" }}
              aria-label={copy.closeSelectedEntity}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          <div className="px-4 py-3">
            <p className="text-[13px] leading-5" style={{ color: "var(--text-secondary)" }}>
              {selectedEntity.description || copy.noDescription}
            </p>
          </div>

          <dl className="grid grid-cols-3 border-y" style={{ borderColor: "var(--line-soft)" }}>
            <div className="min-w-0 px-4 py-3">
              <dt className="mono text-[11px] tracking-[0.04em]" style={{ color: "var(--text-tertiary)" }}>{copy.score}</dt>
              <dd className="mono mt-1 text-[15px]" style={{ color: "var(--text-primary)" }}>{selectedEntity.score}</dd>
            </div>
            <div className="min-w-0 border-l px-4 py-3" style={{ borderColor: "var(--line-soft)" }}>
              <dt className="mono text-[11px] tracking-[0.04em]" style={{ color: "var(--text-tertiary)" }}>{copy.confidence}</dt>
              <dd className="mono mt-1 text-[15px]" style={{ color: "var(--text-primary)" }}>{Math.round(selectedEntity.confidence * 100)}%</dd>
            </div>
            <div className="min-w-0 border-l px-4 py-3" style={{ borderColor: "var(--line-soft)" }}>
              <dt className="mono text-[11px] tracking-[0.04em]" style={{ color: "var(--text-tertiary)" }}>{copy.scope}</dt>
              <dd className="mono mt-1 truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{geoZoomLevel}</dd>
            </div>
          </dl>

          <div className="border-b px-4 py-3" style={{ borderColor: "var(--line-soft)" }}>
            <p className="mono mb-3 text-[11px] tracking-[0.05em]" style={{ color: "var(--text-secondary)" }}>{copy.evidencePath}</p>
            <EvidenceThread
              activeId="entity"
              label={copy.fixtureEvidencePath}
              steps={[
                { id: "fixture", label: copy.fixtureData, detail: copy.notLive },
                { id: "entity", label: selectedEntity.name, detail: `${Math.round(selectedEntity.confidence * 100)}% ${copy.confidence.toLowerCase()}`, verified: true },
                { id: "links", label: copy.linkedObjects(relatedConnections.length), detail: isJapanese ? "マップ上のつながり" : "map connections" },
                { id: "review", label: copy.review, detail: copy.openEntityWorkspace }
              ]}
            />
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {isNewEntity(selectedEntity) ? copy.newFixtureRecord : copy.fixtureRecord}
            </span>
            <a
              href={`/entity?id=${encodeURIComponent(selectedEntity.id)}`}
              className="odim-control flex min-h-11 items-center gap-2 px-3 text-[12px]"
              style={{ background: "var(--signal-wash)", borderColor: "color-mix(in srgb, var(--signal) 68%, var(--line-strong))" }}
            >
              {copy.inspectEntity}
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
        </aside>
      ) : null}

      {mapError ? (
        <div data-testid="map-load-error" role="alert" className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--field)] px-5">
          <div className="w-full max-w-sm border-l-2 px-4 py-5" style={{ borderColor: "var(--critical)", background: "var(--surface)" }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} aria-hidden="true" style={{ color: "var(--critical)" }} />
              <div>
                <h2 className="text-[16px] font-medium" style={{ color: "var(--text-primary)" }}>{copy.basemapUnavailable}</h2>
                <p className="mt-1 text-[13px] leading-5" style={{ color: "var(--text-secondary)" }}>{mapError}</p>
              </div>
            </div>
            <button type="button" data-testid="map-retry" onClick={retryMap} className="odim-control mt-4 min-h-11 px-3 text-[12px]" style={{ background: "var(--field)" }}>
              {copy.retryMap}
            </button>
          </div>
        </div>
      ) : !loaded ? (
        <div data-testid="map-loading" role="status" className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--field)] px-5">
          <div className="flex items-center gap-3 border-l-2 px-4 py-3" style={{ borderColor: "var(--signal)", background: "var(--surface)" }}>
            <span className="h-2 w-2 bg-[var(--signal)]" aria-hidden="true" />
            <span className="mono text-[11px] tracking-[0.05em]" style={{ color: "var(--text-secondary)" }}>{copy.loadingBasemap}</span>
          </div>
        </div>
      ) : null}

      {/* Substrate tooltip */}
      {tooltipState && (
        <SubstrateTooltip
          layer={tooltipState.layer}
          position={tooltipState.position}
          data={tooltipState.data}
          labels={tooltipLabels}
        />
      )}
    </section>
  );
}

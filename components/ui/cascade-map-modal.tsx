"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type CascadeChild = {
  id: string;
  name: string;
  confidence: number;
  linkType: string;
  capitalWeight: number;
  coverageGapScore: number;
};

type CascadeSubstrate = {
  layer: string;
  id: string;
  name: string;
  children: CascadeChild[];
};

type CascadeData = {
  entity: { id: string; name: string; score: number };
  substrates: CascadeSubstrate[];
};

type Messages = {
  cascadeMapTitle: string;
  cascadeClose: string;
  lowCoverage: string;
  loading?: string;
  errorRetry?: string;
};

// ─── Layer colors (same as reality-map) ──────────────────────────────────────
const LAYER_COLORS: Record<string, string> = {
  energy:        "#d97a2b",
  cash:          "#3a9a3a",
  land:          "#b89245",
  compute:       "#3b82d9",
  water:         "#1a9bb0",
  raw_materials: "#9a5aaa",
  logistics:     "#5a7ea0"
};

// ─── Link type edge colors ────────────────────────────────────────────────────
const LINK_COLORS: Record<string, string> = {
  supply:     "#3b82f6",
  compete:    "#ef4444",
  capital:    "#22c55e",
  regulatory: "#eab308",
  subsidiary: "#a855f7",
  parent_company:   "#06b6d4",
  ultimate_parent:  "#0ea5e9"
};

function linkColor(linkType: string): string {
  return LINK_COLORS[linkType] ?? "#6b7280";
}

// ─── SVG layout helpers ───────────────────────────────────────────────────────
const SVG_W = 1000;
const SVG_PAD_Y = 40;
const COL_X = { l1: 100, l2: 400, l3: 720 };
const L1_R = 38;
const L2_R = 22;
const L3_W = 200;
const L3_H = 40;
const L3_R = 6;

function computeLayout(data: CascadeData) {
  const substrates = data.substrates.slice(0, 6);
  const totalNodes = substrates.reduce((s, sub) => s + Math.max(1, sub.children.slice(0, 3).length), 0);
  const nodeHeight = Math.max(60, Math.min(90, (SVG_W - SVG_PAD_Y * 2) / Math.max(totalNodes, 1)));
  const svgH = Math.max(400, totalNodes * nodeHeight + SVG_PAD_Y * 2);

  let cursorY = SVG_PAD_Y;
  const substrateNodes: Array<{ sub: CascadeSubstrate; y: number; children: Array<{ child: CascadeChild; y: number }> }> = [];

  for (const sub of substrates) {
    const children = sub.children.slice(0, 3);
    const visChildren = children.length === 0 ? [null] : children;
    const groupH = visChildren.length * nodeHeight;
    const subY = cursorY + groupH / 2;

    const childNodes = visChildren.map((child, ci) => ({
      child: child!,
      y: cursorY + (ci + 0.5) * nodeHeight
    }));

    substrateNodes.push({ sub, y: subY, children: childNodes });
    cursorY += groupH;
  }

  const l1Y = svgH / 2;
  return { substrateNodes, l1Y, svgH };
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = Readonly<{
  open: boolean;
  entityId: string | null;
  onClose: () => void;
  messages: Messages;
}>;

export function CascadeMapModal({ open, entityId, onClose, messages }: Props) {
  const router = useRouter();
  const [data, setData] = useState<CascadeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/entity-cascade?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as CascadeData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && entityId) {
      fetchData(entityId);
    } else {
      setData(null);
      setError(null);
    }
  }, [open, entityId, fetchData]);

  // ESC key handler
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !entityId) return null;

  const layout = data ? computeLayout(data) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col w-full max-w-5xl mx-4"
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--line-soft)",
          borderRadius: "var(--radius-lg)",
          maxHeight: "90vh",
          boxShadow: "var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.7))"
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: "1px solid var(--line-faint)" }}
        >
          <div>
            <span
              className="mono text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--rune-dim)" }}
            >
              {messages.cascadeMapTitle}
            </span>
            {data && (
              <div className="mt-0.5 text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {data.entity.name}
                <span className="mono ml-3 text-[11px] font-normal" style={{ color: "var(--rune)" }}>
                  Score {data.entity.score}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mono flex items-center justify-center rounded-[var(--radius-sm)] px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors hover:bg-[var(--surface-secondary)]"
            style={{ color: "var(--text-tertiary)", border: "1px solid var(--line-faint)" }}
          >
            {messages.cascadeClose} ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex h-40 items-center justify-center">
              <div
                className="mono text-[11px] uppercase tracking-[0.14em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {messages.loading ?? "Loading…"}
              </div>
            </div>
          )}

          {error && (
            <div className="flex h-40 flex-col items-center justify-center gap-3">
              <span className="text-[13px]" style={{ color: "var(--critical)" }}>{error}</span>
              <button
                type="button"
                onClick={() => entityId && fetchData(entityId)}
                className="mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded"
                style={{
                  background: "rgba(201,169,97,0.1)",
                  border: "1px solid rgba(201,169,97,0.25)",
                  color: "var(--rune)"
                }}
              >
                {messages.errorRetry ?? "Retry"}
              </button>
            </div>
          )}

          {data && layout && (
            <svg
              viewBox={`0 0 ${SVG_W} ${layout.svgH}`}
              width="100%"
              style={{ display: "block", overflow: "visible" }}
              aria-label={`Cascade map for ${data.entity.name}`}
            >
              {/* ── L1 → L2 edges ── */}
              {layout.substrateNodes.map(({ sub, y }) => {
                const color = LAYER_COLORS[sub.layer] ?? "#6b7280";
                return (
                  <path
                    key={`edge-l1-l2-${sub.id}`}
                    d={bezier(COL_X.l1 + L1_R, layout.l1Y, COL_X.l2 - L2_R, y)}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                  />
                );
              })}

              {/* ── L2 → L3 edges ── */}
              {layout.substrateNodes.flatMap(({ sub, children }) =>
                children.map(({ child, y: childY }) => {
                  if (!child) return null;
                  const parentNode = layout.substrateNodes.find((n) => n.sub.id === sub.id);
                  const strokeW = Math.max(1, (child.capitalWeight / 1e9) * 4);
                  const opacity = 0.3 + child.confidence * 0.7;
                  return (
                    <path
                      key={`edge-l2-l3-${child.id}`}
                      d={bezier(COL_X.l2 + L2_R, parentNode?.y ?? childY, COL_X.l3 - 4, childY)}
                      fill="none"
                      stroke={linkColor(child.linkType)}
                      strokeWidth={Math.min(4, strokeW)}
                      strokeOpacity={opacity}
                    />
                  );
                })
              )}

              {/* ── L1 Node ── */}
              <circle
                cx={COL_X.l1}
                cy={layout.l1Y}
                r={L1_R}
                fill="var(--rune, #c9a961)"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={2}
              />
              <text
                x={COL_X.l1}
                y={layout.l1Y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={22}
                fontWeight={700}
                fill="white"
              >
                {data.entity.name.slice(0, 1).toUpperCase()}
              </text>
              <text
                x={COL_X.l1}
                y={layout.l1Y + L1_R + 14}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fill="var(--text-secondary)"
                fontFamily="monospace"
              >
                L1
              </text>

              {/* ── L2 Nodes (substrates) ── */}
              {layout.substrateNodes.map(({ sub, y }) => {
                const color = LAYER_COLORS[sub.layer] ?? "#6b7280";
                return (
                  <g key={`l2-${sub.id}`}>
                    <circle
                      cx={COL_X.l2}
                      cy={y}
                      r={L2_R}
                      fill={color}
                      fillOpacity={0.85}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth={1.5}
                    />
                    <text
                      x={COL_X.l2}
                      y={y + L2_R + 12}
                      textAnchor="middle"
                      fontSize={9}
                      fill="var(--text-tertiary)"
                      fontFamily="monospace"
                    >
                      {sub.layer.replace("_", " ").toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {/* ── L3 Nodes (children) ── */}
              {layout.substrateNodes.flatMap(({ children }) =>
                children.map(({ child, y }) => {
                  if (!child) return null;
                  const isLowCoverage = child.coverageGapScore < 0.3;
                  const lx = COL_X.l3;
                  const ly = y - L3_H / 2;
                  return (
                    <g
                      key={`l3-${child.id}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        router.push(`/entity?id=${encodeURIComponent(child.id)}`);
                        onClose();
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          router.push(`/entity?id=${encodeURIComponent(child.id)}`);
                          onClose();
                        }
                      }}
                    >
                      <rect
                        x={lx}
                        y={ly}
                        width={L3_W}
                        height={L3_H}
                        rx={L3_R}
                        fill="var(--surface-secondary)"
                        stroke="var(--line-faint)"
                        strokeWidth={1}
                      />
                      {/* Name */}
                      <text
                        x={lx + 10}
                        y={ly + 14}
                        fontSize={11}
                        fontWeight={500}
                        fill="var(--text-primary)"
                      >
                        {child.name.length > 22 ? `${child.name.slice(0, 22)}…` : child.name}
                      </text>
                      {/* Confidence bar */}
                      <rect
                        x={lx + 10}
                        y={ly + 22}
                        width={120}
                        height={3}
                        rx={1.5}
                        fill="var(--line-faint)"
                      />
                      <rect
                        x={lx + 10}
                        y={ly + 22}
                        width={120 * child.confidence}
                        height={3}
                        rx={1.5}
                        fill="var(--rune)"
                      />
                      {/* Confidence % */}
                      <text
                        x={lx + 135}
                        y={ly + 26}
                        fontSize={8}
                        fill="var(--text-tertiary)"
                        fontFamily="monospace"
                      >
                        {Math.round(child.confidence * 100)}%
                      </text>
                      {/* Low coverage badge */}
                      {isLowCoverage && (
                        <g>
                          <rect
                            x={lx + L3_W - 56}
                            y={ly + 6}
                            width={48}
                            height={14}
                            rx={3}
                            fill="rgba(201,169,97,0.18)"
                            stroke="rgba(201,169,97,0.35)"
                            strokeWidth={0.75}
                          />
                          <text
                            x={lx + L3_W - 32}
                            y={ly + 14}
                            textAnchor="middle"
                            fontSize={7}
                            fontFamily="monospace"
                            fill="var(--rune)"
                          >
                            {messages.lowCoverage}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })
              )}

              {/* ── L3 column header ── */}
              <text
                x={COL_X.l3 + L3_W / 2}
                y={SVG_PAD_Y - 16}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-tertiary)"
                fontFamily="monospace"
              >
                L3 ENTITIES
              </text>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

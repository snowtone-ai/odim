"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { LayerKey } from "@/lib/map/types";

export type SubstrateTooltipData = {
  activeSignals: number;
  signalsDelta: number;
  topEntity: { name: string; confidence: number } | null;
  narrativeGap: "HIGH" | "MEDIUM" | "LOW";
  capitalTotal30d: number;
};

type Props = {
  layer: LayerKey;
  position: { x: number; y: number };
  data: SubstrateTooltipData;
  labels: {
    activeSignals: string;
    topEntity: string;
    gap: string;
    capital: string;
  };
};

const LAYER_DISPLAY: Record<LayerKey, string> = {
  energy: "Energy",
  cash: "Capital",
  land: "Land",
  compute: "Compute",
  water: "Water",
  raw_materials: "Materials",
  logistics: "Logistics"
};

const GAP_COLORS: Record<string, string> = {
  HIGH: "var(--critical)",
  MEDIUM: "var(--warning)",
  LOW: "var(--positive)"
};

function formatCapital(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${value.toLocaleString("en-US")}`;
}

export function SubstrateTooltip({ layer, position, data, labels }: Readonly<Props>) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    let x = position.x + 16;
    let y = position.y + 16;
    if (x + rect.width > vw - 8) x = position.x - rect.width - 8;
    if (y + rect.height > vh - 8) y = position.y - rect.height - 8;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [position]);

  const deltaColor = data.signalsDelta >= 0 ? "var(--positive)" : "var(--critical)";
  const gapColor = GAP_COLORS[data.narrativeGap] ?? "var(--text-primary)";

  const content = (
    <div
      ref={tooltipRef}
      role="tooltip"
      className="substrate-tooltip"
      style={{
        position: "fixed",
        left: position.x + 16,
        top: position.y + 16,
        zIndex: 9999,
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderLeft: "2px solid var(--evidence)",
        borderRadius: 4,
        padding: "12px 14px",
        minWidth: 230,
        boxShadow: "var(--shadow-md)",
        pointerEvents: "none",
        animation: "odim-surface-enter var(--motion-state) var(--ease-primary) both"
      }}
    >
      {/* Layer header */}
      <div
        style={{
          fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.04em",
          color: "var(--text-secondary)",
          marginBottom: 8,
          fontWeight: 500
        }}
      >
        {LAYER_DISPLAY[layer]}
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
        {/* Active Signals */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {labels.activeSignals}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>
            {data.activeSignals}
            {data.signalsDelta !== 0 && (
              <span style={{ fontSize: 11, color: deltaColor, marginLeft: 4 }}>
                {data.signalsDelta > 0 ? "+" : ""}
                {data.signalsDelta}
              </span>
            )}
          </span>
        </div>

        {/* Top Entity */}
        {data.topEntity && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {labels.topEntity}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-primary)",
                  maxWidth: 110,
                  textAlign: "right",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {data.topEntity.name.split("/")[0].trim()}
              </span>
            </div>
            <div
              style={{
                height: 3,
                background: "var(--line-faint)",
                borderRadius: 0,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(data.topEntity.confidence * 100)}%`,
                  background: "var(--signal)",
                  borderRadius: 0
                }}
              />
            </div>
          </div>
        )}

        {/* Narrative Gap */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {labels.gap}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: gapColor }}>
            {data.narrativeGap}
          </span>
        </div>

        {/* Capital */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {labels.capital}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
            {formatCapital(data.capitalTotal30d)}
          </span>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

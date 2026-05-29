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
  MEDIUM: "#f59e0b",
  LOW: "#22c55e"
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

  const deltaColor = data.signalsDelta >= 0 ? "#22c55e" : "var(--critical)";
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
        background: "var(--surface-secondary)",
        border: "1px solid var(--line-faint)",
        borderRadius: 8,
        padding: "12px",
        minWidth: 220,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        pointerEvents: "none"
      }}
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .substrate-tooltip {
            animation: substrate-tooltip-fadein 150ms ease-out;
          }
        }
        @keyframes substrate-tooltip-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Layer header */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--text-tertiary)",
          marginBottom: 8
        }}
      >
        {LAYER_DISPLAY[layer]}
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--line-faint)", paddingTop: 8 }}>
        {/* Active Signals */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {labels.activeSignals}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>
            {data.activeSignals}
            {data.signalsDelta !== 0 && (
              <span style={{ fontSize: 10, color: deltaColor, marginLeft: 4 }}>
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
                borderRadius: 2,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(data.topEntity.confidence * 100)}%`,
                  background: "var(--rune)",
                  borderRadius: 2
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

"use client";

export function AnomalyBadge({
  severity,
  zScore
}: Readonly<{
  severity: "anomaly" | "critical";
  zScore: number;
}>) {
  const isCritical = severity === "critical";
  const color = isCritical ? "var(--critical)" : "var(--warning)";
  const wash = isCritical
    ? "var(--critical-wash)"
    : "color-mix(in srgb, var(--warning) 12%, transparent)";
  const border = isCritical
    ? "color-mix(in srgb, var(--critical) 25%, transparent)"
    : "color-mix(in srgb, var(--warning) 25%, transparent)";
  return (
    <span
      className="mono inline-flex items-center rounded px-1.5 py-0.5 text-[11px] uppercase tracking-[0.1em]"
      style={{
        color,
        background: wash,
        border: `1px solid ${border}`
      }}
    >
      z {zScore > 0 ? "+" : ""}
      {zScore}
    </span>
  );
}

"use client";

export function AnomalyBadge({
  severity,
  zScore
}: Readonly<{
  severity: "anomaly" | "critical";
  zScore: number;
}>) {
  const color = severity === "critical" ? "var(--critical)" : "#eab308";
  return (
    <span
      className="mono inline-flex items-center rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]"
      style={{
        color,
        background: severity === "critical" ? "rgba(220,38,38,0.1)" : "rgba(234,179,8,0.1)",
        border: `1px solid ${severity === "critical" ? "rgba(220,38,38,0.25)" : "rgba(234,179,8,0.25)"}`
      }}
    >
      z {zScore > 0 ? "+" : ""}
      {zScore}
    </span>
  );
}

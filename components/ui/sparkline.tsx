"use client";

type SparklineProps = Readonly<{
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}>;

/**
 * Pure SVG sparkline — no axes, with a restrained area below the polyline.
 * Trend detection: compares last value to first; status colors remain semantic.
 */
export function Sparkline({
  data,
  color,
  width = 80,
  height = 20
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--line-faint)"
          strokeWidth={1}
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const polylineStr = points.map(({ x, y }) => `${x},${y}`).join(" ");

  const first = data[0] ?? 0;
  const last = data[data.length - 1] ?? 0;
  const diff = last - first;
  const autoColor =
    diff > 0.5
      ? "var(--positive)"
      : diff < -0.5
      ? "var(--critical)"
      : "var(--text-tertiary)";

  const lineColor = color ?? autoColor;

  // Area path: polyline then close to bottom
  const areaPath =
    `M ${points[0]!.x},${points[0]!.y} ` +
    points
      .slice(1)
      .map(({ x, y }) => `L ${x},${y}`)
      .join(" ") +
    ` L ${points[points.length - 1]!.x},${height - pad}` +
    ` L ${points[0]!.x},${height - pad} Z`;

  return (
    <svg
      width={width}
      height={height}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <path
        d={areaPath}
        fill={lineColor}
        fillOpacity={0.08}
      />
      <polyline
        points={polylineStr}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

"use client";

type SparklineProps = Readonly<{
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}>;

/**
 * Pure SVG sparkline — no axes, filled area below polyline.
 * Trend detection: compares last value to first; green=up, red=down, neutral=flat.
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
      ? "var(--positive, #22c55e)"
      : diff < -0.5
      ? "var(--critical, #dc2626)"
      : "var(--text-tertiary, #6b7280)";

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
      <defs>
        <linearGradient
          id={`spark-fill-${lineColor.replace(/[^a-zA-Z0-9]/g, "")}`}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#spark-fill-${lineColor.replace(/[^a-zA-Z0-9]/g, "")})`}
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

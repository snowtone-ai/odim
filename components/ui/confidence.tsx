export function Confidence({
  value,
  label = "confidence"
}: Readonly<{ value: number; label?: string }>) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mono mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        <span>{label}</span>
        <span className="text-[var(--evidence)]">{percent}%</span>
      </div>
      <div
        className="h-[3px] overflow-hidden rounded-full bg-[var(--surface-raised)]"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-[var(--evidence)] transition-[width] duration-[280ms] motion-reduce:transition-none"
          style={{
            width: `${percent}%`,
            transformOrigin: "left"
          }}
        />
      </div>
    </div>
  );
}

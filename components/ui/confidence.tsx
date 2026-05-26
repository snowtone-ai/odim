export function Confidence({
  value,
  label = "confidence"
}: Readonly<{ value: number; label?: string }>) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mono mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        <span>{label}</span>
        <span className="text-[var(--rune)]">{percent}%</span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-[var(--ink-700)]">
        <div
          className="h-full rounded-full bg-[var(--rune)]"
          style={{
            width: `${percent}%`,
            boxShadow: "0 0 8px rgba(201,169,97,0.3)",
            transformOrigin: "left",
            animation: "bar-fill 800ms var(--ease-out-expo) both"
          }}
        />
      </div>
    </div>
  );
}

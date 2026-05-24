export function Confidence({
  value,
  label = "confidence"
}: Readonly<{ value: number; label?: string }>) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        <span>{label}</span>
        <span className="text-[var(--rune)]">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--ink-700)]">
        <div className="h-full bg-[var(--rune)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function Panel({
  title,
  children
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--line-faint)] bg-[var(--ink-800)]">
      <div className="mono border-b border-[var(--line-faint)] px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

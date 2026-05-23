export function Screen({
  title,
  eyebrow,
  children
}: Readonly<{ title: string; eyebrow: string; children: React.ReactNode }>) {
  return (
    <section className="px-8 py-7">
      <header className="mb-7 flex items-end justify-between border-b border-[var(--line-faint)] pb-5">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--rune)]">{eyebrow}</div>
          <h1 className="mt-2 font-[var(--font-spectral)] text-[28px] leading-tight">{title}</h1>
        </div>
        <div className="mono rounded-[var(--radius-sm)] border border-[var(--line-soft)] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Live / source-backed
        </div>
      </header>
      {children}
    </section>
  );
}

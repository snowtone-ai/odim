export function Panel({
  title,
  children,
  noPad,
  accent
}: Readonly<{ title: string; children: React.ReactNode; noPad?: boolean; accent?: boolean }>) {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-lg)]"
      style={{
        background: "var(--ink-800)",
        border: accent ? "1px solid var(--line-strong)" : "1px solid var(--glass-border)",
        boxShadow: accent
          ? "var(--shadow-inset), var(--shadow-md), var(--shadow-glow)"
          : "var(--shadow-inset), var(--shadow-sm)",
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.016) 0%, transparent 64px)"
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center px-5 py-3"
        style={{
          borderBottom: "1px solid var(--line-soft)",
          backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.008) 0%, transparent 50%)"
        }}
      >
        <span
          className="mono text-[11px] font-medium uppercase tracking-[0.12em]"
          style={{ color: "var(--text-secondary)" }}
        >
          {title}
        </span>
      </div>
      <div className={noPad ? "" : "p-5"}>{children}</div>
    </div>
  );
}

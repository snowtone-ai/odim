type PanelProps = Readonly<{
  title: string;
  children: React.ReactNode;
  noPad?: boolean;
  accent?: boolean;
}>;

/**
 * Transitional section primitive for routes still migrating from card layouts.
 * It deliberately uses rails and strata instead of rounded, elevated containers.
 */
export function Panel({ title, children, noPad, accent }: PanelProps) {
  return (
    <section
      aria-label={title}
      className="border-y bg-[var(--surface)]"
      style={{
        borderColor: "var(--line-soft)",
        borderLeft: accent ? "2px solid var(--signal)" : undefined
      }}
    >
      <div
        className="flex min-h-11 items-center px-4 py-2 sm:px-5"
        style={{ borderBottom: "1px solid var(--line-soft)" }}
      >
        <h2 className="mono text-[12px] font-medium tracking-[0.03em]" style={{ color: "var(--text-secondary)" }}>
          {title}
        </h2>
      </div>
      <div className={noPad ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

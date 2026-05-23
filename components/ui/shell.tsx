import Link from "next/link";

const nav = [
  ["Reality Map", "/map"],
  ["Capital Flow", "/capital-flow"],
  ["Entity Intelligence", "/entity"],
  ["Signal Alerts", "/alerts"],
  ["Huginn Console", "/huginn"],
  ["Watchlist & Briefs", "/watchlist"],
  ["Audit Trail", "/audit"],
  ["Settings", "/settings"]
] as const;

export function Shell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(201,169,97,0.08),transparent_28%),var(--ink-900)]">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-[var(--line-faint)] bg-[var(--ink-850)] px-5 py-6">
        <div className="font-[var(--font-spectral)] text-2xl tracking-[0.08em]">ØDIM</div>
        <div className="mono mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          Reality Intelligence OS
        </div>
        <nav className="mt-10 grid gap-1">
          {nav.map(([label, href]) => (
            <Link
              className="rounded-[var(--radius-md)] border border-transparent px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--line-soft)] hover:text-[var(--text-primary)]"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="ml-64 min-h-screen">{children}</main>
    </div>
  );
}

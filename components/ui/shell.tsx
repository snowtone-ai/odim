import Link from "next/link";
import { getMessages } from "@/lib/i18n/messages";

export function Shell({ children }: Readonly<{ children: React.ReactNode }>) {
  const messages = getMessages();
  const nav = [
    [messages.shell.nav.map, "/map"],
    [messages.shell.nav.capitalFlow, "/capital-flow"],
    [messages.shell.nav.entity, "/entity"],
    [messages.shell.nav.alerts, "/alerts"],
    [messages.shell.nav.huginn, "/huginn"],
    [messages.shell.nav.watchlist, "/watchlist"],
    [messages.shell.nav.audit, "/audit"],
    [messages.shell.nav.settings, "/settings"]
  ] as const;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,var(--rune-wash),transparent_28%),var(--ink-900)]">
      <aside className="border-b border-[var(--line-faint)] bg-[var(--ink-850)] px-4 py-4 md:fixed md:inset-y-0 md:left-0 md:w-64 md:border-b-0 md:border-r md:px-5 md:py-6">
        <div className="font-[var(--font-spectral)] text-2xl tracking-[0.08em]">ØDIM</div>
        <div className="mono mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {messages.shell.productCategory}
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 md:mt-10 md:grid md:overflow-visible md:pb-0">
          {nav.map(([label, href]) => (
            <Link
              className="whitespace-nowrap rounded-[var(--radius-md)] border border-transparent px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--line-soft)] hover:text-[var(--text-primary)]"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-h-screen md:ml-64">{children}</main>
    </div>
  );
}

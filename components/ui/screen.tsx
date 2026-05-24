import { getMessages } from "@/lib/i18n/messages";

export function Screen({
  title,
  eyebrow,
  children
}: Readonly<{ title: string; eyebrow: string; children: React.ReactNode }>) {
  const messages = getMessages();

  return (
    <section className="px-4 py-5 sm:px-6 md:px-8 md:py-7">
      <header className="mb-5 flex flex-col gap-4 border-b border-[var(--line-faint)] pb-5 sm:flex-row sm:items-end sm:justify-between md:mb-7">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--rune)]">{eyebrow}</div>
          <h1 className="mt-2 font-[var(--font-spectral)] text-[28px] leading-tight">{title}</h1>
        </div>
        <div className="mono rounded-[var(--radius-sm)] border border-[var(--line-soft)] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          {messages.common.live}
        </div>
      </header>
      {children}
    </section>
  );
}

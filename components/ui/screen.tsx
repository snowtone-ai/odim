import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export async function Screen({
  title,
  eyebrow,
  children
}: Readonly<{ title: string; eyebrow: string; children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = getMessages(locale);

  return (
    <section className="animate-page-in px-5 py-5 sm:px-6 md:px-8 md:py-6">
      <header
        className="mb-5 flex flex-col gap-3 pb-5 sm:flex-row sm:items-end sm:justify-between md:mb-7"
        style={{ borderBottom: "1px solid var(--line-faint)" }}
      >
        <div>
          {/* Eyebrow: 11px, text-tertiary — readable but secondary */}
          <div
            className="mono text-[11px] uppercase tracking-[0.16em]"
            style={{ color: "var(--rune-dim)" }}
          >
            {eyebrow}
          </div>
          {/* Title: 24px Spectral, primary text — high contrast */}
          <h1
            className="mt-1.5 font-[var(--font-spectral)] text-[24px] leading-tight tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h1>
        </div>
        {/* Live badge */}
        <div
          className="mono flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]"
          style={{
            color: "var(--text-tertiary)",
            background: "var(--ink-800)",
            border: "1px solid var(--line-faint)",
            boxShadow: "var(--shadow-inset)"
          }}
        >
          <span
            className="inline-block h-[5px] w-[5px] rounded-full bg-[var(--positive)]"
            style={{ boxShadow: "0 0 6px rgba(95,168,120,0.45)" }}
          />
          {messages.common.live}
        </div>
      </header>
      <div className="stagger">
        {children}
      </div>
    </section>
  );
}

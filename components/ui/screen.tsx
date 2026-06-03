export function Screen({
  title,
  children
}: Readonly<{ title?: string; children: React.ReactNode }>) {
  return (
    <section className="animate-page-in px-5 py-5 sm:px-6 md:px-8 md:py-6">
      {title ? (
        <div className="mb-5 flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
            {title}
          </h1>
          <div className="h-px flex-1" style={{ background: "var(--line-faint)" }} />
        </div>
      ) : null}
      <div className="stagger">
        {children}
      </div>
    </section>
  );
}

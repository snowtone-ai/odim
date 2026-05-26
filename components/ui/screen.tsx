export function Screen({
  title,
  children
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="animate-page-in px-5 py-5 sm:px-6 md:px-8 md:py-6">
      <header
        className="mb-5 pb-5 md:mb-7"
        style={{ borderBottom: "1px solid var(--line-faint)" }}
      >
        <h1
          className="font-[var(--font-spectral)] text-[24px] leading-tight tracking-wide"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
      </header>
      <div className="stagger">
        {children}
      </div>
    </section>
  );
}

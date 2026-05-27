export function Screen({
  title,
  children
}: Readonly<{ title?: string; children: React.ReactNode }>) {
  return (
    <section className="animate-page-in px-5 py-5 sm:px-6 md:px-8 md:py-6">
      {title ? (
        <h1 className="mb-5 text-2xl font-semibold tracking-normal text-[var(--text-primary)]">
          {title}
        </h1>
      ) : null}
      <div className="stagger">
        {children}
      </div>
    </section>
  );
}

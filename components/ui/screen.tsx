type ScreenProps = Readonly<{
  title?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}>;

export function Screen({ title, eyebrow, actions, children, className }: ScreenProps) {
  const showContext = Boolean(title || eyebrow || actions);

  return (
    <section className={["odim-route min-h-full", className].filter(Boolean).join(" ")}>
      {showContext ? (
        <header
          className="flex min-h-14 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b px-5 py-3 sm:px-6 md:px-8"
          style={{ borderColor: "var(--line-soft)", background: "var(--field)" }}
        >
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mono mb-1 text-[11px] tracking-[0.04em]" style={{ color: "var(--text-tertiary)" }}>
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h1 className="text-[24px] font-medium leading-none tracking-[-0.025em] text-[var(--text-primary)]">
                {title}
              </h1>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="min-h-0">{children}</div>
    </section>
  );
}

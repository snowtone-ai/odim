export default function DashboardLoading() {
  return (
    <main
      className="min-h-[calc(100vh-56px)] px-4 py-5 sm:px-6 md:px-8"
      aria-busy="true"
      aria-label="Loading workspace"
      data-testid="dashboard-loading"
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <div className="flex items-end justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--line-soft, rgba(255,255,255,.12))" }}>
          <div className="grid gap-2">
            <div className="h-3 w-24 animate-pulse" style={{ background: "color-mix(in srgb, var(--text-secondary, #8d97ab) 24%, transparent)" }} />
            <div className="h-7 w-56 animate-pulse" style={{ background: "color-mix(in srgb, var(--text, #e8eff2) 18%, transparent)" }} />
          </div>
          <div className="hidden h-8 w-32 animate-pulse sm:block" style={{ background: "color-mix(in srgb, var(--text-secondary, #8d97ab) 16%, transparent)" }} />
        </div>

        <div className="grid min-h-[420px] grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="grid content-start gap-4 border p-4" style={{ borderColor: "var(--line-soft, rgba(255,255,255,.12))" }}>
            <div className="h-3 w-32 animate-pulse" style={{ background: "color-mix(in srgb, var(--text-secondary, #8d97ab) 20%, transparent)" }} />
            <div className="h-48 animate-pulse" style={{ background: "color-mix(in srgb, var(--evidence, #5cc6d2) 8%, transparent)" }} />
            <div className="grid gap-3 sm:grid-cols-3">
              {["one", "two", "three"].map((key) => (
                <div key={key} className="h-14 animate-pulse border-b" style={{ borderColor: "var(--line-faint, rgba(255,255,255,.06))", background: "color-mix(in srgb, var(--text-secondary, #8d97ab) 12%, transparent)" }} />
              ))}
            </div>
          </section>
          <aside className="grid content-start gap-3 border p-4" style={{ borderColor: "var(--line-soft, rgba(255,255,255,.12))" }}>
            <div className="h-3 w-28 animate-pulse" style={{ background: "color-mix(in srgb, var(--text-secondary, #8d97ab) 20%, transparent)" }} />
            {["a", "b", "c", "d"].map((key) => (
              <div key={key} className="h-11 animate-pulse border-b" style={{ borderColor: "var(--line-faint, rgba(255,255,255,.06))", background: "color-mix(in srgb, var(--text-secondary, #8d97ab) 10%, transparent)" }} />
            ))}
          </aside>
        </div>
      </div>
    </main>
  );
}

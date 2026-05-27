export default function DashboardLoading() {
  return (
    <main className="min-h-screen px-4 py-4 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="h-10 w-64 animate-pulse rounded-md bg-[var(--ink-800)]" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
          <div className="space-y-3 rounded-lg border border-[var(--line-soft)] bg-[var(--ink-900)] p-4">
            <div className="h-5 w-32 animate-pulse rounded bg-[var(--ink-800)]" />
            <div className="h-20 animate-pulse rounded bg-[var(--ink-800)]" />
            <div className="h-20 animate-pulse rounded bg-[var(--ink-800)]" />
          </div>
          <div className="min-h-[420px] rounded-lg border border-[var(--line-soft)] bg-[var(--ink-900)] p-4">
            <div className="h-full min-h-[380px] animate-pulse rounded bg-[var(--ink-800)]" />
          </div>
        </div>
      </div>
    </main>
  );
}

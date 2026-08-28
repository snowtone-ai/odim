"use client";

import { useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n/messages";

export default function DashboardError({
  error,
  reset
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const [labels, setLabels] = useState(() => getMessages().common.errorBoundary);

  useEffect(() => {
    setLabels(getMessages(document.documentElement.lang).common.errorBoundary);
  }, []);

  useEffect(() => {
    console.error("dashboard render error", error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100vh-56px)] items-start px-6 py-12 md:px-10" data-testid="dashboard-error">
      <section
        className="w-full max-w-xl border-l-2 px-5 py-2"
        role="alert"
        style={{ borderColor: "var(--critical, #e2745b)" }}
      >
        <div className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--critical, #e2745b)" }}>
          {labels.stateError}
        </div>
        <h1 className="mt-3 text-xl font-semibold" style={{ color: "var(--text, var(--text-primary, #e8eff2))" }}>
          {labels.title}
        </h1>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary, #8d97ab)" }}>
          {labels.message}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 border px-4 py-2 text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--signal,#4c90f0)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal,#4c90f0)]"
          style={{
            background: "color-mix(in srgb, var(--signal, #4c90f0) 14%, transparent)",
            borderColor: "var(--signal, #4c90f0)",
            color: "var(--text, var(--text-primary, #e8eff2))"
          }}
        >
          {labels.retry}
        </button>
      </section>
    </main>
  );
}

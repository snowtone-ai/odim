"use client";

import { useEffect } from "react";
import { getMessages } from "@/lib/i18n/messages";

export default function DashboardError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const labels = getMessages().common.errorBoundary;

  useEffect(() => {
    console.error("dashboard render error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-xl rounded-lg border border-[var(--line-soft)] bg-[var(--ink-900)] p-6 shadow-[var(--shadow-sm)]">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{labels.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{labels.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md bg-[var(--rune)] px-4 py-2 text-sm font-semibold text-[var(--ink-950)]"
        >
          {labels.retry}
        </button>
      </section>
    </main>
  );
}

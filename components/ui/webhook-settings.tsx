"use client";

import { useState } from "react";

type Messages = {
  title: string;
  configured: string;
  notConfigured: string;
  testButton: string;
  testSuccess: string;
  testFailed: string;
  minPriority: string;
};

export function WebhookSettings({
  isConfigured,
  messages
}: Readonly<{
  isConfigured: boolean;
  messages: Messages;
}>) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "failed" | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/webhook-test", { method: "POST" });
      setTestResult(res.ok ? "success" : "failed");
    } catch {
      setTestResult("failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <div className="flex min-h-11 items-center justify-between gap-3 border-y px-3" style={{ borderColor: "var(--line-soft)" }}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-block h-2 w-2 shrink-0" aria-hidden="true" style={{ background: isConfigured ? "var(--positive)" : "var(--text-tertiary)" }} />
          <span className="truncate text-[13px]" style={{ color: "var(--text-primary)" }}>{isConfigured ? messages.configured : messages.notConfigured}</span>
        </div>
        <span className="mono shrink-0 text-[11px] uppercase tracking-[0.1em]" style={{ color: isConfigured ? "var(--positive)" : "var(--text-tertiary)" }}>{messages.title}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {isConfigured ? (
          <button type="button" onClick={handleTest} disabled={testing} className="mono min-h-11 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--signal-wash)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:opacity-45 motion-reduce:transition-none" style={{ background: "var(--signal-wash)", borderColor: "var(--signal)", color: "var(--signal)" }}>
            {testing ? "…" : messages.testButton}
          </button>
        ) : null}
        {testResult === "success" ? <span className="mono text-[12px] uppercase tracking-[0.1em]" aria-live="polite" style={{ color: "var(--positive)" }}>{messages.testSuccess}</span> : null}
        {testResult === "failed" ? <span className="mono text-[12px] uppercase tracking-[0.1em]" aria-live="assertive" style={{ color: "var(--critical)" }}>{messages.testFailed}</span> : null}
      </div>
      <div className="mono mt-3 text-[11px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>{messages.minPriority}: CRITICAL</div>
    </div>
  );
}

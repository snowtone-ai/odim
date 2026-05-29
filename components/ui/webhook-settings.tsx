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
      <div className="flex items-center gap-3 mb-4">
        <span
          className="inline-block rounded-full"
          style={{
            width: 8,
            height: 8,
            background: isConfigured ? "var(--positive, #22c55e)" : "var(--text-tertiary)",
            boxShadow: isConfigured ? "0 0 6px rgba(34,197,94,0.5)" : "none"
          }}
        />
        <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>
          {isConfigured ? messages.configured : messages.notConfigured}
        </span>
      </div>

      {isConfigured && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded transition-colors hover:brightness-110"
            style={{
              background: testing ? "var(--rune-wash)" : "rgba(201,169,97,0.1)",
              border: "1px solid rgba(201,169,97,0.25)",
              color: "var(--rune)"
            }}
          >
            {testing ? "…" : messages.testButton}
          </button>

          {testResult === "success" && (
            <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--positive, #22c55e)" }}>
              {messages.testSuccess}
            </span>
          )}
          {testResult === "failed" && (
            <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--critical)" }}>
              {messages.testFailed}
            </span>
          )}
        </div>
      )}

      <div className="mono mt-3 text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>
        {messages.minPriority}: CRITICAL
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import type { ClientHuginnResponse } from "@/app/actions/huginn";

type Labels = {
  hint: string;
  submit: string;
  thinking: string;
  prompt: string;
};

type Props = {
  defaultOrgId: string;
  defaultQuestion: string;
  initialResponse: ClientHuginnResponse;
  labels: Labels;
  /** Server Action — never calls /api/huginn directly from the browser */
  action: (question: string, orgId: string) => Promise<ClientHuginnResponse>;
  onResponse: (response: ClientHuginnResponse, submittedQuestion: string) => void;
};

export function HuginnInput({ defaultOrgId, defaultQuestion, initialResponse, labels, action, onResponse }: Readonly<Props>) {
  const [question, setQuestion] = useState(defaultQuestion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Emit initial response on mount
  useEffect(() => {
    onResponse(initialResponse, defaultQuestion);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await action(trimmed, defaultOrgId);
      onResponse(data, trimmed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => { setQuestion(e.target.value); setError(null); }}
          placeholder={labels.hint}
          disabled={loading}
          className="flex-1 rounded-[var(--radius-md)] px-4 py-2.5 text-[13px] outline-none transition-all duration-[var(--dur-fast)]"
          style={{
            background: "var(--ink-800)",
            border: error ? "1px solid var(--critical)" : "1px solid var(--line-soft)",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-inset)"
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="mono shrink-0 rounded-[var(--radius-md)] px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] transition-all duration-[var(--dur-fast)] disabled:opacity-50"
          style={{
            background: loading ? "var(--ink-700)" : "var(--rune-wash)",
            border: "1px solid rgba(201,169,97,0.20)",
            color: "var(--rune)"
          }}
        >
          {loading ? labels.thinking : labels.submit}
        </button>
      </form>
      {error && (
        <div
          className="mono rounded-[var(--radius-sm)] px-3 py-1.5 text-[11px]"
          style={{
            background: "rgba(220,60,60,0.08)",
            border: "1px solid rgba(220,60,60,0.18)",
            color: "var(--critical)"
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

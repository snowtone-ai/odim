"use client";

import { useState, useRef, useEffect } from "react";

type HuginnResponse = {
  answer: string;
  confidence: number;
  sources: string[];
  reasoningTrace: Array<{ step: string; summary: string; sources?: string[] }>;
  munin: { counts: Record<string, number> };
  retrieval_layers_used: string[];
  narrativeContrast: Array<{ title: string }>;
  eval_log_id: string;
  orgId: string;
};

type Labels = {
  hint: string;
  submit: string;
  thinking: string;
  prompt: string;
};

type Props = {
  defaultOrgId: string;
  defaultQuestion: string;
  initialResponse: HuginnResponse;
  labels: Labels;
  onResponse: (response: HuginnResponse) => void;
};

export function HuginnInput({ defaultOrgId, defaultQuestion, initialResponse, labels, onResponse }: Readonly<Props>) {
  const [question, setQuestion] = useState(defaultQuestion);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Emit initial response on mount
  useEffect(() => {
    onResponse(initialResponse);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/huginn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), orgId: defaultOrgId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HuginnResponse;
      onResponse(data);
    } catch {
      // On error, keep showing last response
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={labels.hint}
        disabled={loading}
        className="flex-1 rounded-[var(--radius-md)] px-4 py-2.5 text-[13px] outline-none transition-all duration-[var(--dur-fast)]"
        style={{
          background: "var(--ink-800)",
          border: "1px solid var(--line-soft)",
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
  );
}

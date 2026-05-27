"use client";

import { useState, useRef, useCallback } from "react";
import type { ClientHuginnResponse } from "@/app/actions/huginn";

type Labels = {
  hint: string;
  submit: string;
  thinking: string;
  prompt: string;
};

type Props = {
  defaultOrgId: string;
  labels: Labels;
  action: (question: string, orgId: string) => Promise<ClientHuginnResponse>;
  onSubmit: (question: string) => void;
  loading: boolean;
};

export function HuginnInput({ labels, onSubmit, loading }: Readonly<Props>) {
  const [question, setQuestion] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
    setQuestion("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div
        className="flex items-end gap-2 rounded-2xl px-4 py-3 transition-all duration-[var(--dur-fast)]"
        style={{
          background: "var(--ink-800)",
          border: "1px solid var(--line-soft)",
          boxShadow: "var(--shadow-sm)"
        }}
      >
        <textarea
          ref={textareaRef}
          value={question}
          onChange={(e) => { setQuestion(e.target.value); adjustHeight(); }}
          onKeyDown={handleKeyDown}
          placeholder={labels.hint}
          disabled={loading}
          rows={1}
          className="flex-1 resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-[var(--text-quaternary)]"
          style={{
            color: "var(--text-primary)",
            maxHeight: "160px"
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-[var(--dur-fast)] disabled:opacity-30"
          style={{
            background: loading ? "var(--ink-700)" : "var(--rune)",
            color: loading ? "var(--text-tertiary)" : "var(--ink-950)"
          }}
          title={loading ? labels.thinking : labels.submit}
        >
          {loading ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}

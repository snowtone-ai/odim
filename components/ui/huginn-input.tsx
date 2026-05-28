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

type AttachedFile = {
  name: string;
  content: string;
};

const ACCEPTED = ".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.yaml,.yml,.toml,.xml,.html,.css";
const MAX_BYTES = 150 * 1024; // 150 KB per file

export function HuginnInput({ labels, onSubmit, loading }: Readonly<Props>) {
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = question.trim();
    if ((!trimmed && files.length === 0) || loading) return;

    const fileCtx = files.length > 0
      ? files.map((f) => `[Attached: ${f.name}]\n${f.content}`).join("\n\n") + (trimmed ? "\n\n" : "")
      : "";

    onSubmit(fileCtx + trimmed);
    setQuestion("");
    setFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const results = await Promise.all(
      selected.map(
        (file) =>
          new Promise<AttachedFile | null>((resolve) => {
            if (file.size > MAX_BYTES) { resolve(null); return; }
            const reader = new FileReader();
            reader.onload = (ev) =>
              resolve({ name: file.name, content: (ev.target?.result as string) ?? "" });
            reader.onerror = () => resolve(null);
            reader.readAsText(file);
          })
      )
    );
    setFiles((prev) => [...prev, ...(results.filter(Boolean) as AttachedFile[])]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  const canSubmit = !loading && (!!question.trim() || files.length > 0);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {/* File chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
              style={{ background: "var(--ink-700)", border: "1px solid var(--line-faint)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-[11px] max-w-[140px] truncate" style={{ color: "var(--text-secondary)" }}>
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-0.5 flex items-center justify-center transition-opacity opacity-50 hover:opacity-100"
                aria-label={`Remove ${file.name}`}
                style={{ color: "var(--text-tertiary)" }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input box */}
      <div
        className="flex items-end gap-2 rounded-2xl px-3 py-3 transition-all duration-[var(--dur-fast)]"
        style={{
          background: "var(--ink-800)",
          border: "1px solid var(--line-soft)",
          boxShadow: "var(--shadow-sm)"
        }}
      >
        {/* Attach button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.06]"
          style={{ color: "var(--text-quaternary)" }}
          title="Attach file"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={question}
          onChange={(e) => { setQuestion(e.target.value); adjustHeight(); }}
          onKeyDown={handleKeyDown}
          placeholder={labels.hint}
          disabled={loading}
          rows={1}
          className="flex-1 resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-[var(--text-quaternary)]"
          style={{ color: "var(--text-primary)", maxHeight: "160px" }}
        />

        <button
          type="submit"
          disabled={!canSubmit}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED}
        multiple
        onChange={handleFileSelect}
      />
    </form>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { FileText, Paperclip, Send, X } from "lucide-react";
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
  action: (question: string, orgId: string, webSearch?: boolean) => Promise<ClientHuginnResponse>;
  onSubmit: (question: string) => void;
  onDraftChange?: (value: string) => void;
  loading: boolean;
  prefillValue?: string;
};

type AttachedFile = {
  name: string;
  content: string;
};

const ACCEPTED = ".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.yaml,.yml,.toml,.xml,.html,.css";
const MAX_BYTES = 150 * 1024;

export function HuginnInput({
  labels,
  onSubmit,
  onDraftChange,
  loading,
  prefillValue
}: Readonly<Props>) {
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousPrefillRef = useRef<string | undefined>(undefined);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
  }, []);

  useEffect(() => {
    if (!prefillValue || prefillValue === previousPrefillRef.current) return;
    previousPrefillRef.current = prefillValue;
    setQuestion(prefillValue);
    onDraftChange?.(prefillValue);
    const frame = window.requestAnimationFrame(() => {
      adjustHeight();
      textareaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [adjustHeight, onDraftChange, prefillValue]);

  function updateQuestion(value: string) {
    setQuestion(value);
    onDraftChange?.(value);
  }

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const trimmedQuestion = question.trim();
    if ((!trimmedQuestion && files.length === 0) || loading) return;

    const fileContext = files.length
      ? files.map((file) => "[Attached: " + file.name + "]\n" + file.content).join("\n\n") + (trimmedQuestion ? "\n\n" : "")
      : "";

    onSubmit(fileContext + trimmedQuestion);
    updateQuestion("");
    setFiles([]);
    setFileError("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    handleSubmit();
  }

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const rejected = selected.filter((file) => file.size > MAX_BYTES);
    const eligible = selected.filter((file) => file.size <= MAX_BYTES);
    const results = await Promise.all(
      eligible.map(
        (file) =>
          new Promise<AttachedFile | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = (loadEvent) =>
              resolve({ name: file.name, content: (loadEvent.target?.result as string) ?? "" });
            reader.onerror = () => resolve(null);
            reader.readAsText(file);
          })
      )
    );
    const accepted = results.filter(Boolean) as AttachedFile[];
    setFiles((previous) => [...previous, ...accepted]);
    if (rejected.length) {
      setFileError(rejected.map((file) => file.name).join(", ") + " exceeds the 150 KB attachment limit.");
    } else if (eligible.length !== accepted.length) {
      setFileError("One or more files could not be read.");
    } else {
      setFileError("");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  }

  const canSubmit = !loading && (Boolean(question.trim()) || files.length > 0);

  return (
    <form className="grid gap-2" data-testid="huginn-composer" onSubmit={handleSubmit}>
      {files.length ? (
        <ul className="grid border-t" style={{ borderColor: "var(--line-soft)" }}>
          {files.map((file, index) => (
            <li className="flex min-h-11 items-center gap-2 border-b px-2" key={file.name + "-" + index} style={{ borderColor: "var(--line-soft)" }}>
              <FileText aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" size={14} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-secondary)]">{file.name}</span>
              <button
                aria-label={"Remove " + file.name}
                className="odim-icon-control h-11 w-11 shrink-0"
                onClick={() => removeFile(index)}
                title={"Remove " + file.name}
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {fileError ? (
        <p aria-live="polite" className="text-[12px] leading-5 text-[var(--critical)]" role="status">
          {fileError}
        </p>
      ) : null}

      <div
        className="flex items-end gap-2 border bg-[var(--surface)] px-2 py-2 transition-[border-color] duration-[var(--motion-state)] focus-within:border-[var(--signal)] motion-reduce:transition-none"
        style={{ borderColor: "var(--line-soft)" }}
      >
        <button
          aria-label="Attach file"
          className="odim-icon-control h-11 w-11 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          type="button"
        >
          <Paperclip aria-hidden="true" size={16} />
        </button>

        <textarea
          aria-label={labels.prompt}
          className="min-h-11 flex-1 resize-none bg-transparent py-2 text-[14px] leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          onChange={(event) => {
            updateQuestion(event.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder={labels.hint}
          ref={textareaRef}
          rows={1}
          style={{ maxHeight: "160px" }}
          value={question}
        />

        <button
          aria-label={loading ? labels.thinking : labels.submit}
          className="odim-control h-11 min-h-11 w-11 shrink-0 px-0 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canSubmit}
          title={loading ? labels.thinking : labels.submit}
          type="submit"
        >
          <Send aria-hidden="true" size={16} />
          <span className="sr-only">{loading ? labels.thinking : labels.submit}</span>
        </button>
      </div>

      <input
        accept={ACCEPTED}
        className="hidden"
        multiple
        onChange={handleFileSelect}
        ref={fileInputRef}
        type="file"
      />
    </form>
  );
}

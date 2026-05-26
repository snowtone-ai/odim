"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export function EvalButton({
  evalLogId,
  orgId,
  labels
}: Readonly<{
  evalLogId: string;
  orgId: string;
  labels: { rating: string; note: string; submit: string; sent: string; error: string };
}>) {
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!rating) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/huginn/eval", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eval_log_id: evalLogId, orgId, user_rating: rating, user_note: note })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? labels.error);
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-1.5" aria-label={labels.rating}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            aria-label={`${labels.rating} ${value}`}
            className={`grid size-8 place-items-center rounded-[var(--radius-sm)] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] ${
              value <= rating
                ? "text-[var(--rune)] shadow-[0_0_6px_rgba(201,169,97,0.12)]"
                : "text-[var(--text-quaternary)] hover:text-[var(--rune-dim)]"
            }`}
            style={{
              background: value <= rating ? "var(--rune-wash)" : "var(--ink-750)",
              border: value <= rating ? "1px solid rgba(201,169,97,0.15)" : "1px solid var(--line-faint)",
              boxShadow: value <= rating ? "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 6px rgba(201,169,97,0.12)" : "inset 0 1px 0 rgba(255,255,255,0.03)"
            }}
            key={value}
            onClick={() => setRating(value)}
            type="button"
          >
            <Star fill={value <= rating ? "currentColor" : "none"} size={14} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <textarea
        className="min-h-20 rounded-[var(--radius-md)] bg-[var(--ink-850)] p-3 text-sm text-[var(--text-primary)] outline-none transition-all duration-[var(--dur-fast)] placeholder:text-[var(--text-quaternary)] focus:shadow-[0_0_0_1px_var(--rune-dim)]"
        style={{
          border: "1px solid var(--line-faint)",
          boxShadow: "inset 0 1px 0 rgba(0,0,0,0.2)"
        }}
        onChange={(event) => setNote(event.target.value)}
        placeholder={labels.note}
        value={note}
      />
      <button
        className="rounded-[var(--radius-md)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-primary)] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] disabled:opacity-40"
        style={{
          background: "linear-gradient(180deg, var(--ink-700) 0%, var(--ink-750) 100%)",
          border: "1px solid var(--line-soft)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), var(--shadow-sm)"
        }}
        disabled={pending || sent}
        onClick={submit}
        type="button"
      >
        {sent ? labels.sent : labels.submit}
      </button>
      {error ? <div className="text-xs text-[var(--negative)]">{error}</div> : null}
    </div>
  );
}

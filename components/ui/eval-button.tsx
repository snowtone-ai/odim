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
      <div className="flex items-center gap-2" aria-label={labels.rating}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            aria-label={`${labels.rating} ${value}`}
            className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-[var(--line-faint)] text-[var(--rune)]"
            key={value}
            onClick={() => setRating(value)}
            type="button"
          >
            <Star fill={value <= rating ? "currentColor" : "none"} size={15} />
          </button>
        ))}
      </div>
      <textarea
        className="min-h-20 rounded-[var(--radius-sm)] border border-[var(--line-faint)] bg-[var(--ink-900)] p-3 text-sm outline-none"
        onChange={(event) => setNote(event.target.value)}
        placeholder={labels.note}
        value={note}
      />
      <button
        className="rounded-[var(--radius-sm)] border border-[var(--line-faint)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50"
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

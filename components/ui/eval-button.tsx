"use client";

import { useState } from "react";
import { Star } from "lucide-react";

type Labels = {
  rating: string;
  note: string;
  submit: string;
  sent: string;
  error: string;
};

export function EvalButton({
  evalLogId,
  orgId,
  labels
}: Readonly<{
  evalLogId: string;
  orgId: string;
  labels: Labels;
}>) {
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!rating || pending || sent) return;
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
    <fieldset className="grid gap-3" disabled={pending || sent}>
      <legend className="sr-only">{labels.rating}</legend>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={labels.rating}>
        {[1, 2, 3, 4, 5].map((value) => {
          const selected = value <= rating;
          return (
            <button
              aria-checked={value === rating}
              aria-label={labels.rating + " " + value}
              className="odim-icon-control h-11 w-11 transition-[background-color,color,border-color] duration-[var(--motion-micro)] motion-reduce:transition-none"
              key={value}
              onClick={() => setRating(value)}
              role="radio"
              style={{
                background: selected ? "var(--surface-primary)" : "var(--field)",
                borderColor: selected ? "var(--signal)" : "var(--line-soft)",
                color: selected ? "var(--signal)" : "var(--text-tertiary)"
              }}
              type="button"
            >
              <Star aria-hidden="true" fill={selected ? "currentColor" : "none"} size={16} strokeWidth={1.5} />
            </button>
          );
        })}
      </div>
      <textarea
        aria-label={labels.note}
        className="min-h-20 border bg-[var(--field)] p-3 text-[13px] leading-6 text-[var(--text-primary)] outline-none transition-[border-color] duration-[var(--motion-state)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--signal)] motion-reduce:transition-none"
        onChange={(event) => setNote(event.target.value)}
        placeholder={labels.note}
        style={{ borderColor: "var(--line-soft)" }}
        value={note}
      />
      <button
        className="odim-control min-h-11 justify-center px-4 text-[13px] disabled:opacity-40"
        disabled={!rating || pending || sent}
        onClick={submit}
        type="button"
      >
        {sent ? labels.sent : pending ? labels.submit + "…" : labels.submit}
      </button>
      <p aria-live="polite" className="min-h-5 text-[12px] leading-5" role={error ? "alert" : "status"} style={{ color: error ? "var(--critical)" : "var(--evidence)" }}>
        {error || (sent ? labels.sent : "")}
      </p>
    </fieldset>
  );
}

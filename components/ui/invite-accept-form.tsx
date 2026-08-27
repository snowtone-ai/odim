"use client";

import { useState } from "react";

export type InviteAcceptLabels = {
  displayName: string;
  displayNamePlaceholder: string;
  submit: string;
  failed: string;
  successTitle: string;
  successBody: string;
  openConsole: string;
  missingToken: string;
};

const fieldStyle = {
  background: "var(--field)",
  border: "1px solid color-mix(in srgb, var(--text) 22%, transparent)",
  color: "var(--text)"
};

export function InviteAcceptForm({ token, labels }: Readonly<{ token: string; labels: InviteAcceptLabels }>) {
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  if (!token) {
    return (
      <p className="border-l pl-4 text-[14px] leading-6" style={{ borderColor: "var(--critical)", color: "var(--critical)" }} role="alert">
        {labels.missingToken}
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/org-invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, displayName: displayName || undefined })
      });
      const body = (await res.json().catch(() => ({}))) as { orgId?: string; error?: string };
      if (!res.ok || !body.orgId) throw new Error(body.error || "accept failed");
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "accept failed");
    } finally {
      setPending(false);
    }
  }

  if (accepted) {
    return (
      <div className="border-l pl-4" style={{ borderColor: "var(--evidence)" }} aria-live="polite">
        <p className="mono text-[11px] tracking-[0.14em]" style={{ color: "var(--evidence)" }}>
          ACCESS GRANTED
        </p>
        <h2 className="mt-4 text-base font-medium" style={{ color: "var(--text)" }}>{labels.successTitle}</h2>
        <p className="mt-2 text-[14px] leading-6" style={{ color: "color-mix(in srgb, var(--text) 68%, transparent)" }}>{labels.successBody}</p>
        <a
          href="/map"
          className="mt-6 inline-flex min-h-11 items-center border px-4 py-2 text-[13px] font-medium transition-[background-color,border-color,transform] duration-[var(--motion-micro)] hover:border-[var(--signal)] hover:bg-[color-mix(in_srgb,var(--signal)_88%,var(--text))] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
          style={{ borderColor: "var(--signal)", background: "var(--signal)", color: "var(--field)" }}
        >
          {labels.openConsole}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" aria-busy={pending}>
      <label className="grid gap-2 text-[12px]" style={{ color: "color-mix(in srgb, var(--text) 70%, transparent)" }}>
        {labels.displayName}
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={labels.displayNamePlaceholder}
          maxLength={80}
          className="min-h-11 rounded-[4px] px-3 py-2.5 text-[13px] outline-none transition-[border-color,background-color] duration-[var(--motion-micro)] placeholder:text-[color:color-mix(in_srgb,var(--text)_40%,transparent)] focus:border-[var(--signal)] focus:bg-[color-mix(in_srgb,var(--signal)_5%,var(--field))]"
          style={fieldStyle}
        />
      </label>
      <div className="mt-1 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center border px-4 py-2 text-[13px] font-medium transition-[background-color,border-color,transform,opacity] duration-[var(--motion-micro)] hover:border-[var(--signal)] hover:bg-[color-mix(in_srgb,var(--signal)_88%,var(--text))] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
          style={{ borderColor: "var(--signal)", background: "var(--signal)", color: "var(--field)" }}
        >
          {pending ? "…" : labels.submit}
        </button>
        {error ? (
          <span className="text-[12px] leading-5" style={{ color: "var(--critical)" }} role="alert" aria-live="polite">
            {labels.failed}: {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

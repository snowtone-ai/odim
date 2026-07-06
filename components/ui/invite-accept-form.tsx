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

export function InviteAcceptForm({ token, labels }: Readonly<{ token: string; labels: InviteAcceptLabels }>) {
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  if (!token) {
    return (
      <p className="text-sm" style={{ color: "var(--critical)" }}>{labels.missingToken}</p>
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
      <div>
        <h2 className="text-base" style={{ color: "var(--text-primary)" }}>{labels.successTitle}</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{labels.successBody}</p>
        <a
          href="/map"
          className="mt-5 inline-block rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium"
          style={{ background: "var(--rune)", color: "var(--ink-950)" }}
        >
          {labels.openConsole}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
        {labels.displayName}
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={labels.displayNamePlaceholder}
          maxLength={80}
          className="rounded px-3 py-2 text-[13px]"
          style={{ background: "var(--ink-900, rgba(0,0,0,0.25))", border: "1px solid var(--line-soft)", color: "var(--text-primary)" }}
        />
      </label>
      <div className="mt-1 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--rune)", color: "var(--ink-950)" }}
        >
          {pending ? "…" : labels.submit}
        </button>
        {error ? (
          <span className="text-[12px]" style={{ color: "var(--critical)" }}>
            {labels.failed}: {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

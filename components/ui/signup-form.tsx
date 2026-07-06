"use client";

import { useState } from "react";

export type SignupFormLabels = {
  orgName: string;
  orgNamePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  displayName: string;
  displayNamePlaceholder: string;
  submit: string;
  failed: string;
  successTitle: string;
  successBody: string;
  nextSettings: string;
  nextMap: string;
};

type SignupSuccess = {
  orgId: string;
  orgName: string;
  trialEndsAt?: string;
};

export function SignupForm({ labels }: Readonly<{ labels: SignupFormLabels }>) {
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SignupSuccess | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, email, displayName: displayName || undefined })
      });
      const body = (await res.json().catch(() => ({}))) as SignupSuccess & { error?: string };
      if (!res.ok || !body.orgId) throw new Error(body.error || "signup failed");
      setSuccess({ orgId: body.orgId, orgName: body.orgName, trialEndsAt: body.trialEndsAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "signup failed");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div>
        <h2 className="text-base" style={{ color: "var(--text-primary)" }}>{labels.successTitle}</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          {labels.successBody}
          {success.trialEndsAt ? ` (trial → ${success.trialEndsAt.slice(0, 10)})` : ""}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="/settings"
            className="rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium"
            style={{ background: "var(--rune)", color: "var(--ink-950)" }}
          >
            {labels.nextSettings}
          </a>
          <a
            href="/map"
            className="rounded-[var(--radius-md)] px-4 py-2 text-sm"
            style={{ border: "1px solid var(--line-soft)", color: "var(--text-secondary)" }}
          >
            {labels.nextMap}
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
        {labels.orgName}
        <input
          value={orgName}
          onChange={(event) => setOrgName(event.target.value)}
          placeholder={labels.orgNamePlaceholder}
          required
          minLength={2}
          maxLength={80}
          className="rounded px-3 py-2 text-[13px]"
          style={{ background: "var(--ink-900, rgba(0,0,0,0.25))", border: "1px solid var(--line-soft)", color: "var(--text-primary)" }}
        />
      </label>
      <label className="grid gap-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
        {labels.email}
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={labels.emailPlaceholder}
          type="email"
          required
          className="rounded px-3 py-2 text-[13px]"
          style={{ background: "var(--ink-900, rgba(0,0,0,0.25))", border: "1px solid var(--line-soft)", color: "var(--text-primary)" }}
        />
      </label>
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

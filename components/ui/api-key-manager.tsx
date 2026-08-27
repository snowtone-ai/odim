"use client";

import { useState } from "react";

export type ApiKeyManagerLabels = {
  heading: string;
  name: string;
  namePlaceholder: string;
  scopes: string;
  issue: string;
  revoke: string;
  tokenNotice: string;
  copy: string;
  copied: string;
  failed: string;
  empty: string;
};

export type ManagedApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
};

const fieldStyle = {
  background: "var(--field)",
  border: "1px solid var(--line-soft)",
  color: "var(--text-primary)"
} as const;

export function ApiKeyManager({
  orgId,
  initialKeys,
  allowedScopes,
  defaultScopes,
  labels
}: Readonly<{
  orgId: string;
  initialKeys: ManagedApiKey[];
  allowedScopes: string[];
  defaultScopes: string[];
  labels: ApiKeyManagerLabels;
}>) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(defaultScopes);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScope(scope: string) {
    setScopes((current) => (current.includes(scope) ? current.filter((entry) => entry !== scope) : [...current, scope]));
  }

  async function issueKey() {
    if (!name.trim() || scopes.length === 0 || pending) return;
    setPending(true);
    setError(null);
    setIssuedToken(null);
    setCopied(false);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-odim-org-id": orgId },
        body: JSON.stringify({ name: name.trim(), scopes })
      });
      const body = (await res.json().catch(() => ({}))) as { token?: string; apiKey?: ManagedApiKey; error?: string };
      if (!res.ok || !body.token || !body.apiKey) throw new Error(body.error || "issue failed");
      setIssuedToken(body.token);
      setKeys((current) => [body.apiKey as ManagedApiKey, ...current]);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "issue failed");
    } finally {
      setPending(false);
    }
  }

  async function revokeKey(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-odim-org-id": orgId },
        body: JSON.stringify({ id })
      });
      const body = (await res.json().catch(() => ({}))) as { revoked?: boolean; error?: string };
      if (!res.ok || !body.revoked) throw new Error(body.error || "revoke failed");
      setKeys((current) => current.filter((key) => key.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "revoke failed");
    }
  }

  async function copyToken() {
    if (!issuedToken) return;
    try {
      await navigator.clipboard.writeText(issuedToken);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-w-0">
      <div className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>{labels.heading}</div>
      <p className="mt-2 max-w-xl text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>Keys are scoped to this organization and the secret is shown once.</p>

      {issuedToken ? (
        <div className="mt-4 border-y border-l-2 px-3 py-3" aria-live="polite" style={{ background: "var(--evidence-wash)", borderColor: "var(--evidence)" }}>
          <div className="mono text-[11px] uppercase tracking-[0.11em]" style={{ color: "var(--evidence)" }}>{labels.tokenNotice}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="mono min-w-0 flex-1 break-all text-[12px]" style={{ color: "var(--text-primary)" }}>{issuedToken}</code>
            <button type="button" onClick={copyToken} className="mono min-h-11 shrink-0 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>
              {copied ? labels.copied : labels.copy}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 border-y" style={{ borderColor: "var(--line-soft)" }}>
        <div className="grid gap-3 border-b py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" style={{ borderColor: "var(--line-faint)" }}>
          <label className="grid gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            <span className="mono uppercase tracking-[0.1em]">{labels.name}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={labels.namePlaceholder} aria-label={labels.name} className="min-h-11 w-full border px-3 text-[13px] outline-none focus-visible:border-[var(--signal)]" style={fieldStyle} />
          </label>
          <button type="button" onClick={issueKey} disabled={pending || !name.trim() || scopes.length === 0} className="mono min-h-11 border px-4 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--signal-wash)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none" style={{ background: "var(--signal-wash)", borderColor: "var(--signal)", color: "var(--signal)" }}>
            {pending ? "…" : labels.issue}
          </button>
        </div>
        <div className="py-3">
          <div className="mono text-[11px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>{labels.scopes}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowedScopes.map((scope) => {
              const selected = scopes.includes(scope);
              return (
                <button key={scope} type="button" onClick={() => toggleScope(scope)} aria-pressed={selected} className="mono min-h-11 border px-3 text-[12px] tracking-[0.06em] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ background: selected ? "var(--signal-wash)" : "transparent", borderColor: selected ? "var(--signal)" : "var(--line-soft)", color: selected ? "var(--signal)" : "var(--text-tertiary)" }}>
                  {scope}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error ? <p className="mt-3 mono text-[12px] uppercase tracking-[0.1em]" aria-live="assertive" style={{ color: "var(--critical)" }}>{labels.failed}: {error}</p> : null}

      <div className="mt-5 border-y" style={{ borderColor: "var(--line-soft)" }}>
        {keys.length === 0 ? <div className="px-3 py-5 mono text-[12px]" style={{ color: "var(--text-secondary)" }}>{labels.empty}</div> : null}
        {keys.map((key) => (
          <div className="grid gap-2 border-b px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" style={{ borderColor: "var(--line-faint)" }} key={key.id}>
            <div className="min-w-0">
              <div className="truncate text-[13px]" style={{ color: "var(--text-primary)" }}>{key.name}</div>
              <div className="mono mt-1 truncate text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>{key.prefix}… · {key.scopes.join(" · ")}</div>
            </div>
            <button type="button" onClick={() => revokeKey(key.id)} className="mono min-h-11 justify-self-start px-2 text-[12px] uppercase tracking-[0.1em] text-[var(--critical)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--signal)] sm:justify-self-end">
              {labels.revoke}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

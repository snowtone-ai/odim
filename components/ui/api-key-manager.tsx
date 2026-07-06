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
    <div>
      <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
        {labels.heading}
      </div>

      {issuedToken ? (
        <div
          className="mt-3 rounded p-3"
          style={{ background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.3)" }}
        >
          <div className="mono text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--rune)" }}>
            {labels.tokenNotice}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="mono break-all text-[12px]" style={{ color: "var(--text-primary)" }}>{issuedToken}</code>
            <button
              type="button"
              onClick={copyToken}
              className="mono shrink-0 text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded"
              style={{ border: "1px solid var(--line-soft)", color: "var(--text-secondary)" }}
            >
              {copied ? labels.copied : labels.copy}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={labels.namePlaceholder}
          aria-label={labels.name}
          className="rounded px-3 py-2 text-[13px]"
          style={{ background: "var(--ink-900, rgba(0,0,0,0.25))", border: "1px solid var(--line-soft)", color: "var(--text-primary)" }}
        />
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>
            {labels.scopes}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowedScopes.map((scope) => {
              const active = scopes.includes(scope);
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  aria-pressed={active}
                  className="mono text-[10px] tracking-[0.06em] px-2 py-1 rounded transition-colors"
                  style={{
                    border: `1px solid ${active ? "rgba(201,169,97,0.4)" : "var(--line-soft)"}`,
                    background: active ? "rgba(201,169,97,0.12)" : "transparent",
                    color: active ? "var(--rune)" : "var(--text-tertiary)"
                  }}
                >
                  {scope}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={issueKey}
            disabled={pending || !name.trim() || scopes.length === 0}
            className="mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded transition-colors hover:brightness-110 disabled:opacity-50"
            style={{ background: "rgba(201,169,97,0.1)", border: "1px solid rgba(201,169,97,0.25)", color: "var(--rune)" }}
          >
            {pending ? "…" : labels.issue}
          </button>
          {error ? (
            <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--critical)" }}>
              {labels.failed}: {error}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-2.5">
        {keys.length === 0 ? (
          <div className="mono text-[11px]" style={{ color: "var(--text-secondary)" }}>{labels.empty}</div>
        ) : null}
        {keys.map((key) => (
          <div className="pb-3" style={{ borderBottom: "1px solid var(--line-faint)" }} key={key.id}>
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span style={{ color: "var(--text-primary)" }} className="truncate">{key.name}</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="mono" style={{ color: "var(--rune)" }}>{key.prefix}…</span>
                <button
                  type="button"
                  onClick={() => revokeKey(key.id)}
                  className="mono text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: "var(--critical)" }}
                >
                  {labels.revoke}
                </button>
              </span>
            </div>
            <div className="mono mt-1 text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>
              {key.scopes.join(" · ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

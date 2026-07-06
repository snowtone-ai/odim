"use client";

import { useState } from "react";

export type OrgMembersPanelLabels = {
  orgLine: string;
  invite: string;
  emailPlaceholder: string;
  roleAnalyst: string;
  roleAdmin: string;
  pending: string;
  revoke: string;
  linkNotice: string;
  copy: string;
  copied: string;
  failed: string;
  noPending: string;
  expires: string;
};

export type PanelMember = {
  id: string;
  displayName: string;
  role: string;
};

export type PanelInvite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

export function OrgMembersPanel({
  orgId,
  members,
  initialInvites,
  labels
}: Readonly<{
  orgId: string;
  members: PanelMember[];
  initialInvites: PanelInvite[];
  labels: OrgMembersPanelLabels;
}>) {
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"analyst" | "admin">("analyst");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createInvite() {
    if (!email.trim() || pending) return;
    setPending(true);
    setError(null);
    setInviteLink(null);
    setCopied(false);
    try {
      const res = await fetch("/api/org-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-odim-org-id": orgId },
        body: JSON.stringify({ email: email.trim(), role })
      });
      const body = (await res.json().catch(() => ({}))) as { token?: string; invite?: PanelInvite; error?: string };
      if (!res.ok || !body.token || !body.invite) throw new Error(body.error || "invite failed");
      setInviteLink(`${window.location.origin}/invite?token=${encodeURIComponent(body.token)}`);
      setInvites((current) => [body.invite as PanelInvite, ...current]);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "invite failed");
    } finally {
      setPending(false);
    }
  }

  async function revokeInvite(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/org-invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-odim-org-id": orgId },
        body: JSON.stringify({ id })
      });
      const body = (await res.json().catch(() => ({}))) as { revoked?: boolean; error?: string };
      if (!res.ok || !body.revoked) throw new Error(body.error || "revoke failed");
      setInvites((current) => current.filter((invite) => invite.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "revoke failed");
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
        {labels.orgLine}
      </div>

      <div className="mt-4 grid gap-2.5">
        {members.map((member) => (
          <div
            className="flex items-center justify-between pb-3"
            style={{ borderBottom: "1px solid var(--line-faint)" }}
            key={member.id}
          >
            <span className="truncate text-[13px]" style={{ color: "var(--text-primary)" }}>{member.displayName}</span>
            <span className="mono shrink-0 text-[11px]" style={{ color: "var(--text-secondary)" }}>{member.role}</span>
          </div>
        ))}
      </div>

      {inviteLink ? (
        <div
          className="mt-4 rounded p-3"
          style={{ background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.3)" }}
        >
          <div className="mono text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--rune)" }}>
            {labels.linkNotice}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="mono break-all text-[12px]" style={{ color: "var(--text-primary)" }}>{inviteLink}</code>
            <button
              type="button"
              onClick={copyLink}
              className="mono shrink-0 text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded"
              style={{ border: "1px solid var(--line-soft)", color: "var(--text-secondary)" }}
            >
              {copied ? labels.copied : labels.copy}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={labels.emailPlaceholder}
          aria-label={labels.emailPlaceholder}
          type="email"
          className="min-w-[200px] flex-1 rounded px-3 py-2 text-[13px]"
          style={{ background: "var(--ink-900, rgba(0,0,0,0.25))", border: "1px solid var(--line-soft)", color: "var(--text-primary)" }}
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value === "admin" ? "admin" : "analyst")}
          aria-label="role"
          className="mono rounded px-2 py-2 text-[11px]"
          style={{ background: "var(--ink-900, rgba(0,0,0,0.25))", border: "1px solid var(--line-soft)", color: "var(--text-secondary)" }}
        >
          <option value="analyst">{labels.roleAnalyst}</option>
          <option value="admin">{labels.roleAdmin}</option>
        </select>
        <button
          type="button"
          onClick={createInvite}
          disabled={pending || !email.trim()}
          className="mono text-[10px] uppercase tracking-[0.1em] px-3 py-2 rounded transition-colors hover:brightness-110 disabled:opacity-50"
          style={{ background: "rgba(201,169,97,0.1)", border: "1px solid rgba(201,169,97,0.25)", color: "var(--rune)" }}
        >
          {pending ? "…" : labels.invite}
        </button>
      </div>
      {error ? (
        <div className="mono mt-2 text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--critical)" }}>
          {labels.failed}: {error}
        </div>
      ) : null}

      <div className="mono mt-5 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rune-dim)" }}>
        {labels.pending}
      </div>
      <div className="mt-2 grid gap-2">
        {invites.length === 0 ? (
          <div className="mono text-[11px]" style={{ color: "var(--text-secondary)" }}>{labels.noPending}</div>
        ) : null}
        {invites.map((invite) => (
          <div
            className="flex items-center justify-between gap-3 pb-2 text-[12px]"
            style={{ borderBottom: "1px solid var(--line-faint)" }}
            key={invite.id}
          >
            <span className="truncate" style={{ color: "var(--text-primary)" }}>{invite.email}</span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="mono text-[10px] uppercase" style={{ color: "var(--text-tertiary)" }}>
                {invite.role} · {labels.expires} {invite.expiresAt.slice(0, 10)}
              </span>
              <button
                type="button"
                onClick={() => revokeInvite(invite.id)}
                className="mono text-[10px] uppercase tracking-[0.1em]"
                style={{ color: "var(--critical)" }}
              >
                {labels.revoke}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

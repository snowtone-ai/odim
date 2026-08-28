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
  noMembers: string;
  role: string;
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

const fieldStyle = {
  background: "var(--field)",
  border: "1px solid var(--line-soft)",
  color: "var(--text-primary)"
} as const;

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
      setInviteLink(window.location.origin + "/invite?token=" + encodeURIComponent(body.token));
      setInvites((current) => [body.invite as PanelInvite, ...current]);
      setEmail("");
    } catch {
      setError(labels.failed);
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
    } catch {
      setError(labels.failed);
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
    <div className="min-w-0">
      <div className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>{labels.orgLine}</div>

      <div className="mt-4 border-y" style={{ borderColor: "var(--line-soft)" }}>
        {members.length ? members.map((member) => (
          <div className="flex min-h-12 items-center justify-between gap-3 border-b px-3 last:border-b-0" style={{ borderColor: "var(--line-faint)" }} key={member.id}>
            <span className="truncate text-[13px]" style={{ color: "var(--text-primary)" }}>{member.displayName}</span>
            <span className="mono shrink-0 text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-secondary)" }}>{member.role === "admin" ? labels.roleAdmin : labels.roleAnalyst}</span>
          </div>
        )) : <div className="px-3 py-5 text-[13px]" aria-live="polite" style={{ color: "var(--text-secondary)" }}>{labels.noMembers}</div>}
      </div>

      {inviteLink ? (
        <div className="mt-4 border-y border-l-2 px-3 py-3" aria-live="polite" style={{ background: "var(--evidence-wash)", borderColor: "var(--evidence)" }}>
          <div className="mono text-[11px] uppercase tracking-[0.11em]" style={{ color: "var(--evidence)" }}>{labels.linkNotice}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="mono min-w-0 flex-1 break-all text-[12px]" style={{ color: "var(--text-primary)" }}>{inviteLink}</code>
            <button type="button" onClick={copyLink} className="mono min-h-11 shrink-0 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>{copied ? labels.copied : labels.copy}</button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 border-y py-3" style={{ borderColor: "var(--line-soft)" }}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="sr-only" htmlFor="member-invite-email">{labels.emailPlaceholder}</label>
          <input id="member-invite-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={labels.emailPlaceholder} aria-label={labels.emailPlaceholder} type="email" className="min-h-11 min-w-0 border px-3 text-[13px] outline-none focus-visible:border-[var(--signal)]" style={fieldStyle} />
          <label className="sr-only" htmlFor="member-invite-role">{labels.role}</label>
          <select id="member-invite-role" value={role} onChange={(event) => setRole(event.target.value === "admin" ? "admin" : "analyst")} className="mono min-h-11 border px-3 text-[12px] outline-none focus-visible:border-[var(--signal)]" style={{ ...fieldStyle, color: "var(--text-secondary)" }}>
            <option value="analyst">{labels.roleAnalyst}</option>
            <option value="admin">{labels.roleAdmin}</option>
          </select>
          <button type="button" onClick={createInvite} disabled={pending || !email.trim()} className="mono min-h-11 border px-4 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--signal-wash)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:opacity-45 motion-reduce:transition-none" style={{ background: "var(--signal-wash)", borderColor: "var(--signal)", color: "var(--signal)" }}>{pending ? "…" : labels.invite}</button>
        </div>
      </div>
      {error ? <div className="mt-3 mono text-[12px] uppercase tracking-[0.1em]" aria-live="assertive" style={{ color: "var(--critical)" }}>{error}</div> : null}

      <div className="mt-5 mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>{labels.pending}</div>
      <div className="mt-2 border-y" style={{ borderColor: "var(--line-soft)" }}>
        {invites.length === 0 ? <div className="px-3 py-5 mono text-[12px]" aria-live="polite" style={{ color: "var(--text-secondary)" }}>{labels.noPending}</div> : null}
        {invites.map((invite) => (
          <div className="grid gap-2 border-b px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center" style={{ borderColor: "var(--line-faint)" }} key={invite.id}>
            <span className="truncate text-[12px]" style={{ color: "var(--text-primary)" }}>{invite.email}</span>
            <span className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>{invite.role === "admin" ? labels.roleAdmin : labels.roleAnalyst} · {labels.expires} {invite.expiresAt.slice(0, 10)}</span>
            <button type="button" onClick={() => revokeInvite(invite.id)} className="min-h-11 justify-self-start px-2 text-[12px] uppercase tracking-[0.1em] text-[var(--critical)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--signal)] sm:justify-self-end">{labels.revoke}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { deterministicUuid } from "../pipeline/idempotency.ts";

export type OrgInviteRole = "analyst" | "admin";

export type OrgInviteRecord = {
  id: string;
  orgId: string;
  email: string;
  role: OrgInviteRole;
  tokenHash: string;
  invitedBy?: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
};

export type OrgInviteIssueResult = {
  token: string;
  record: OrgInviteRecord;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isOrgInviteRole(value: unknown): value is OrgInviteRole {
  return value === "analyst" || value === "admin";
}

export function normalizeInviteEmail(email: unknown): string | undefined {
  if (typeof email !== "string") return undefined;
  const value = email.trim().toLowerCase();
  return value.length > 0 && value.length <= 254 && emailPattern.test(value) ? value : undefined;
}

export function inviteTtlHours(env: NodeJS.ProcessEnv = process.env) {
  const value = Number(env.ORG_INVITE_TTL_HOURS);
  if (!Number.isFinite(value) || value <= 0) return 168;
  return Math.min(value, 720);
}

export function hashOrgInviteToken(token: string) {
  const pepper = process.env.API_KEY_PEPPER ?? "";
  if (!pepper) throw new Error("API_KEY_PEPPER is required to issue or verify org invites");
  return createHmac("sha256", pepper).update(token).digest("hex");
}

export function issueOrgInvite(input: {
  orgId: string;
  email: string;
  role: OrgInviteRole;
  invitedBy?: string;
  now?: Date;
  ttlHours?: number;
  tokenBytes?: Buffer;
}): OrgInviteIssueResult {
  if (!input.orgId) throw new Error("orgId is required to issue an org invite");
  const email = normalizeInviteEmail(input.email);
  if (!email) throw new Error("a valid email is required to issue an org invite");
  if (!isOrgInviteRole(input.role)) throw new Error("invite role must be analyst or admin");

  const now = input.now ?? new Date();
  const ttl = input.ttlHours ?? inviteTtlHours();
  const secret = (input.tokenBytes ?? randomBytes(24)).toString("base64url");
  const token = `odim_invite_${secret}`;
  const createdAt = now.toISOString();
  const record: OrgInviteRecord = {
    id: deterministicUuid("org_invite", { orgId: input.orgId, email, createdAt, secretTail: secret.slice(-8) }),
    orgId: input.orgId,
    email,
    role: input.role,
    tokenHash: hashOrgInviteToken(token),
    invitedBy: input.invitedBy,
    createdAt,
    expiresAt: new Date(now.getTime() + ttl * 3_600_000).toISOString()
  };
  return { token, record };
}

export type OrgInviteVerifyResult = { ok: true } | { ok: false; reason: "revoked" | "accepted" | "expired" | "mismatch" };

export function verifyOrgInvite(
  token: string,
  record: Pick<OrgInviteRecord, "tokenHash" | "expiresAt" | "acceptedAt" | "revokedAt">,
  now = new Date()
): OrgInviteVerifyResult {
  if (record.revokedAt) return { ok: false, reason: "revoked" };
  if (record.acceptedAt) return { ok: false, reason: "accepted" };
  if (new Date(record.expiresAt).getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  const expected = Buffer.from(record.tokenHash, "hex");
  const actual = Buffer.from(hashOrgInviteToken(token), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}

export type RedactedOrgInvite = {
  id: string;
  orgId: string;
  email: string;
  role: OrgInviteRole;
  invitedBy?: string;
  createdAt: string;
  expiresAt: string;
};

export function redactOrgInvite(record: OrgInviteRecord): RedactedOrgInvite {
  return {
    id: record.id,
    orgId: record.orgId,
    email: record.email,
    role: record.role,
    invitedBy: record.invitedBy,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt
  };
}

export function toOrgInviteRow(record: OrgInviteRecord) {
  return {
    id: record.id,
    org_id: record.orgId,
    email: record.email,
    role: record.role,
    token_hash: record.tokenHash,
    invited_by: record.invitedBy ?? null,
    created_at: record.createdAt,
    expires_at: record.expiresAt,
    accepted_at: record.acceptedAt ?? null,
    revoked_at: record.revokedAt ?? null
  };
}

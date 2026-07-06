import { randomUUID } from "node:crypto";
import { type OrgContext } from "../api/org.ts";
import { getPlan } from "../billing/plans.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import {
  hashOrgInviteToken,
  issueOrgInvite,
  redactOrgInvite,
  toOrgInviteRow,
  verifyOrgInvite,
  type OrgInviteRecord,
  type OrgInviteRole,
  type RedactedOrgInvite
} from "../onboarding/invites.ts";
import { billingEnforced, getOrgBilling, upsertOrgBilling } from "./billing.ts";
import { createServerSupabaseReadClient, createServiceSupabaseClient, hasSupabaseReadEnv, hasSupabaseWriteEnv } from "../supabase/client.ts";

export const TRIAL_PERIOD_DAYS = 14;

export type OnboardedOrg = {
  id: string;
  name: string;
  tier: string;
  createdAt: string;
};

export type OnboardedMember = {
  id: string;
  orgId: string;
  email: string;
  displayName: string;
  role: OrgInviteRole;
};

const demoOrgId = "demo-org";

type LocalOnboardingStore = {
  orgs: Map<string, OnboardedOrg>;
  users: OnboardedMember[];
  invites: OrgInviteRecord[];
};

const localStore: LocalOnboardingStore = {
  orgs: new Map(),
  users: [],
  invites: []
};

export function resetOnboardingLocalStore() {
  localStore.orgs.clear();
  localStore.users = [];
  localStore.invites = [];
}

function effectiveOrgId(context: OrgContext) {
  return context.orgId ?? demoOrgId;
}

function assertSupabaseWriteEnv() {
  if (!hasSupabaseWriteEnv() && isProductionRuntime()) {
    throw new Error("Supabase write environment is required in production");
  }
}

export async function createOrgWithAdmin(input: { name: string; email: string; displayName: string; now?: Date }) {
  const now = input.now ?? new Date();
  const org: OnboardedOrg = { id: randomUUID(), name: input.name, tier: "trial", createdAt: now.toISOString() };
  const admin: OnboardedMember = {
    id: randomUUID(),
    orgId: org.id,
    email: input.email,
    displayName: input.displayName,
    role: "admin"
  };
  const trialEndsAt = new Date(now.getTime() + TRIAL_PERIOD_DAYS * 86_400_000).toISOString();

  assertSupabaseWriteEnv();
  if (!hasSupabaseWriteEnv()) {
    localStore.orgs.set(org.id, org);
    localStore.users.push(admin);
    return { source: "fallback" as const, org, admin, trialEndsAt };
  }

  const client = createServiceSupabaseClient();
  const orgInsert = await client.from("orgs").insert({ id: org.id, name: org.name, tier: org.tier });
  if (orgInsert.error) throw new Error(`org create failed: ${orgInsert.error.message}`);

  const userInsert = await client
    .from("users")
    .insert({ id: admin.id, org_id: org.id, display_name: admin.displayName, role: admin.role, email: admin.email });
  if (userInsert.error) {
    await client.from("orgs").delete().eq("id", org.id);
    throw new Error(`org admin create failed: ${userInsert.error.message}`);
  }

  try {
    await upsertOrgBilling({ orgId: org.id, plan: "trial", status: "trialing", trialEndsAt });
  } catch (error) {
    // Signup must be retryable: remove the partial org so a retry does not
    // collide with the unique (org_id, email) member index.
    await client.from("users").delete().eq("org_id", org.id);
    await client.from("orgs").delete().eq("id", org.id);
    throw error;
  }

  return { source: "supabase" as const, org, admin, trialEndsAt };
}

async function countOrgSeatsUsed(orgId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  if (!hasSupabaseReadEnv()) {
    const members = localStore.users.filter((user) => user.orgId === orgId).length;
    const pending = localStore.invites.filter(
      (invite) => invite.orgId === orgId && !invite.acceptedAt && !invite.revokedAt && invite.expiresAt > nowIso
    ).length;
    return members + pending;
  }
  const client = createServerSupabaseReadClient();
  const [members, pending] = await Promise.all([
    client.from("users").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    client
      .from("org_invites")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
  ]);
  const firstError = members.error ?? pending.error;
  if (firstError) throw new Error(`seat count read failed: ${firstError.message}`);
  return (members.count ?? 0) + (pending.count ?? 0);
}

export type CreateInviteResult =
  | { ok: true; source: "supabase" | "fallback"; token: string; invite: RedactedOrgInvite }
  | { ok: false; reason: "seat-limit" };

export async function createInvite(
  context: OrgContext,
  input: { email: string; role: OrgInviteRole; invitedBy?: string }
): Promise<CreateInviteResult> {
  const orgId = effectiveOrgId(context);

  // Seat ceilings only bind when billing enforcement is opted in, mirroring
  // the API entitlement gate; local/dev deployments stay open.
  if (billingEnforced()) {
    const billing = await getOrgBilling(orgId);
    const seats = getPlan(billing.plan).entitlements.seats;
    if ((await countOrgSeatsUsed(orgId)) >= seats) {
      return { ok: false, reason: "seat-limit" };
    }
  }

  const issued = issueOrgInvite({ orgId, email: input.email, role: input.role, invitedBy: input.invitedBy });
  assertSupabaseWriteEnv();
  if (!hasSupabaseWriteEnv()) {
    localStore.invites.push(issued.record);
    return { ok: true, source: "fallback", token: issued.token, invite: redactOrgInvite(issued.record) };
  }

  const { error } = await createServiceSupabaseClient().from("org_invites").insert(toOrgInviteRow(issued.record));
  if (error) throw new Error(`org invite write failed: ${error.message}`);
  return { ok: true, source: "supabase", token: issued.token, invite: redactOrgInvite(issued.record) };
}

export async function listInvites(context: OrgContext): Promise<RedactedOrgInvite[]> {
  const orgId = effectiveOrgId(context);
  const nowIso = new Date().toISOString();
  if (!hasSupabaseReadEnv()) {
    return localStore.invites
      .filter((invite) => invite.orgId === orgId && !invite.acceptedAt && !invite.revokedAt && invite.expiresAt > nowIso)
      .map(redactOrgInvite);
  }
  const { data, error } = await createServerSupabaseReadClient()
    .from("org_invites")
    .select("id, org_id, email, role, invited_by, created_at, expires_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`org invite read failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    orgId: String(row.org_id),
    email: String(row.email),
    role: row.role === "admin" ? "admin" : "analyst",
    invitedBy: row.invited_by ? String(row.invited_by) : undefined,
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at)
  }));
}

export async function revokeInvite(context: OrgContext, input: { id: string }) {
  const orgId = effectiveOrgId(context);
  if (!input.id) throw new Error("org invite id is required");
  assertSupabaseWriteEnv();
  if (!hasSupabaseWriteEnv()) {
    const invite = localStore.invites.find((candidate) => candidate.id === input.id && candidate.orgId === orgId);
    if (invite && !invite.revokedAt) invite.revokedAt = new Date().toISOString();
    return { source: "fallback" as const, revoked: true, id: input.id, orgId };
  }
  const { error } = await createServiceSupabaseClient()
    .from("org_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("org_id", orgId);
  if (error) throw new Error(`org invite revoke failed: ${error.message}`);
  return { source: "supabase" as const, revoked: true, id: input.id, orgId };
}

export type AcceptInviteResult =
  | { ok: true; source: "supabase" | "fallback"; orgId: string; email: string; role: OrgInviteRole; userId: string }
  | { ok: false };

export async function acceptInvite(input: { token: string; displayName?: string; now?: Date }): Promise<AcceptInviteResult> {
  const now = input.now ?? new Date();
  const tokenHash = hashOrgInviteToken(input.token);

  assertSupabaseWriteEnv();
  if (!hasSupabaseWriteEnv()) {
    const invite = localStore.invites.find((candidate) => candidate.tokenHash === tokenHash);
    if (!invite || !verifyOrgInvite(input.token, invite, now).ok) return { ok: false };
    invite.acceptedAt = now.toISOString();
    const member: OnboardedMember = {
      id: randomUUID(),
      orgId: invite.orgId,
      email: invite.email,
      displayName: input.displayName?.trim() || invite.email.split("@")[0],
      role: invite.role
    };
    localStore.users.push(member);
    return { ok: true, source: "fallback", orgId: invite.orgId, email: invite.email, role: invite.role, userId: member.id };
  }

  const client = createServiceSupabaseClient();
  // Atomically claim the invite so a token can only ever be redeemed once.
  const { data, error } = await client
    .from("org_invites")
    .update({ accepted_at: now.toISOString() })
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .select("id, org_id, email, role")
    .maybeSingle();
  if (error) throw new Error(`org invite accept failed: ${error.message}`);
  if (!data) return { ok: false };

  const role: OrgInviteRole = data.role === "admin" ? "admin" : "analyst";
  const email = String(data.email);
  const userId = randomUUID();
  const userInsert = await client.from("users").insert({
    id: userId,
    org_id: String(data.org_id),
    display_name: input.displayName?.trim() || email.split("@")[0],
    role,
    email
  });
  if (userInsert.error) {
    // Release the claim so the invitee can retry after a transient failure.
    await client.from("org_invites").update({ accepted_at: null }).eq("id", data.id);
    throw new Error(`invited member create failed: ${userInsert.error.message}`);
  }
  return { ok: true, source: "supabase", orgId: String(data.org_id), email, role, userId };
}

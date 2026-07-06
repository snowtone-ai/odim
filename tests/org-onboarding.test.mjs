import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  inviteTtlHours,
  isOrgInviteRole,
  issueOrgInvite,
  normalizeInviteEmail,
  redactOrgInvite,
  verifyOrgInvite
} from "../lib/onboarding/invites.ts";
import { normalizeDisplayName, normalizeOrgName, selfServeSignupEnabled } from "../lib/onboarding/signup.ts";
import { createOrgWithAdmin, resetOnboardingLocalStore } from "../lib/repositories/onboarding.ts";
import { resetRequestRateLimit } from "../lib/api/rate-limit.ts";
import { POST as signupPost } from "../app/api/orgs/route.ts";
import { DELETE as invitesDelete, GET as invitesGet, POST as invitesPost } from "../app/api/org-invites/route.ts";
import { POST as acceptPost } from "../app/api/org-invites/accept/route.ts";

const testOrgId = "33333333-3333-4333-8333-333333333333";

function withEnv(overrides, run) {
  const saved = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const restore = () => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  return Promise.resolve(run()).finally(restore);
}

// Local fallback runtime: no Supabase persistence, no external auth, pepper set
// so invite hashing works deterministically.
const localOnboardingEnv = {
  API_KEY_PEPPER: "test-pepper",
  AUTH_REQUIRED: undefined,
  SELF_SERVE_SIGNUP: undefined,
  BILLING_ENFORCED: undefined,
  ENVIRONMENT: undefined,
  ODIM_RUNTIME_ENV: undefined,
  VERCEL_ENV: undefined,
  NEXT_PUBLIC_SUPABASE_URL: undefined,
  SUPABASE_URL: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SSO_PROVIDER: undefined
};

test("invite tokens verify only when unexpired, unclaimed, and untampered", async () => {
  await withEnv(localOnboardingEnv, () => {
    const now = new Date("2026-07-06T00:00:00.000Z");
    const { token, record } = issueOrgInvite({ orgId: testOrgId, email: "Analyst@Example.com", role: "analyst", now });

    assert.ok(token.startsWith("odim_invite_"));
    assert.equal(record.email, "analyst@example.com", "emails are normalized to lowercase");
    assert.deepEqual(verifyOrgInvite(token, record, now), { ok: true });
    assert.deepEqual(verifyOrgInvite(`${token}x`, record, now), { ok: false, reason: "mismatch" });

    const afterExpiry = new Date(new Date(record.expiresAt).getTime() + 1000);
    assert.deepEqual(verifyOrgInvite(token, record, afterExpiry), { ok: false, reason: "expired" });
    assert.deepEqual(verifyOrgInvite(token, { ...record, revokedAt: now.toISOString() }, now), { ok: false, reason: "revoked" });
    assert.deepEqual(verifyOrgInvite(token, { ...record, acceptedAt: now.toISOString() }, now), { ok: false, reason: "accepted" });

    const redacted = redactOrgInvite(record);
    assert.equal("tokenHash" in redacted, false, "redacted invites must not expose the token hash");
  });
});

test("onboarding input normalization rejects invalid values", () => {
  assert.equal(normalizeInviteEmail("  User@Example.COM "), "user@example.com");
  assert.equal(normalizeInviteEmail("not-an-email"), undefined);
  assert.equal(normalizeInviteEmail(42), undefined);
  assert.equal(normalizeOrgName("  Yggdrasil   Capital  "), "Yggdrasil Capital");
  assert.equal(normalizeOrgName("x"), undefined);
  assert.equal(normalizeOrgName("y".repeat(81)), undefined);
  assert.equal(normalizeDisplayName("  Jane  Doe ", "jane@x.com"), "Jane Doe");
  assert.equal(normalizeDisplayName(undefined, "jane@x.com"), "jane");
  assert.ok(isOrgInviteRole("analyst") && isOrgInviteRole("admin") && !isOrgInviteRole("owner"));
  assert.equal(inviteTtlHours({}), 168);
  assert.equal(inviteTtlHours({ ORG_INVITE_TTL_HOURS: "24" }), 24);
  assert.equal(inviteTtlHours({ ORG_INVITE_TTL_HOURS: "99999" }), 720, "TTL is clamped");
  assert.equal(selfServeSignupEnabled({}), false, "signup is fail-closed by default");
  assert.equal(selfServeSignupEnabled({ SELF_SERVE_SIGNUP: "true" }), true);
});

test("signup route fails closed when disabled and validates input when enabled", async () => {
  resetRequestRateLimit();
  await withEnv(localOnboardingEnv, async () => {
    const disabled = await signupPost(
      new Request("http://localhost/api/orgs", { method: "POST", body: JSON.stringify({ orgName: "Acme", email: "a@b.co" }) })
    );
    assert.equal(disabled.status, 503);
  });

  resetRequestRateLimit();
  resetOnboardingLocalStore();
  await withEnv({ ...localOnboardingEnv, SELF_SERVE_SIGNUP: "true" }, async () => {
    const badName = await signupPost(
      new Request("http://localhost/api/orgs", { method: "POST", body: JSON.stringify({ orgName: "x", email: "a@b.co" }) })
    );
    assert.equal(badName.status, 400);

    const badEmail = await signupPost(
      new Request("http://localhost/api/orgs", { method: "POST", body: JSON.stringify({ orgName: "Acme Fund", email: "nope" }) })
    );
    assert.equal(badEmail.status, 400);

    const created = await signupPost(
      new Request("http://localhost/api/orgs", {
        method: "POST",
        body: JSON.stringify({ orgName: "Acme Fund", email: "Founder@Acme.com" })
      })
    );
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.equal(body.source, "fallback");
    assert.ok(body.orgId);
    assert.equal(body.admin.role, "admin");
    assert.equal(body.admin.email, "founder@acme.com");
    assert.ok(body.trialEndsAt > new Date().toISOString(), "trial end must be in the future");
  });
});

test("signup route rate-limits repeated attempts per client", async () => {
  resetRequestRateLimit();
  await withEnv(localOnboardingEnv, async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await signupPost(new Request("http://localhost/api/orgs", { method: "POST", body: "{}" }));
      assert.equal(res.status, 503, "attempts under the ceiling reach the env gate");
    }
    const limited = await signupPost(new Request("http://localhost/api/orgs", { method: "POST", body: "{}" }));
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("Retry-After")) >= 1);
  });
  resetRequestRateLimit();
});

test("createOrgWithAdmin provisions a trial org with an admin member in fallback mode", async () => {
  resetOnboardingLocalStore();
  await withEnv(localOnboardingEnv, async () => {
    const created = await createOrgWithAdmin({
      name: "Mimir Research",
      email: "ops@mimir.io",
      displayName: "Ops Lead",
      now: new Date("2026-07-06T00:00:00.000Z")
    });
    assert.equal(created.source, "fallback");
    assert.equal(created.org.tier, "trial");
    assert.equal(created.admin.role, "admin");
    assert.equal(created.trialEndsAt, "2026-07-20T00:00:00.000Z");
  });
});

test("invite API round-trip: create, list, accept once, then reject reuse", async () => {
  resetRequestRateLimit();
  resetOnboardingLocalStore();
  await withEnv(localOnboardingEnv, async () => {
    const headers = { "Content-Type": "application/json", "x-odim-org-id": testOrgId };

    const badRole = await invitesPost(
      new Request("http://localhost/api/org-invites", { method: "POST", headers, body: JSON.stringify({ email: "a@b.co", role: "owner" }) })
    );
    assert.equal(badRole.status, 400);

    const created = await invitesPost(
      new Request("http://localhost/api/org-invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "new.analyst@acme.com", role: "analyst" })
      })
    );
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.ok(createdBody.token.startsWith("odim_invite_"));
    assert.equal(createdBody.invite.email, "new.analyst@acme.com");
    assert.equal("tokenHash" in createdBody.invite, false);

    const listed = await invitesGet(new Request("http://localhost/api/org-invites", { headers }));
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).invites.length, 1);

    const accepted = await acceptPost(
      new Request("http://localhost/api/org-invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: createdBody.token, displayName: "New Analyst" })
      })
    );
    assert.equal(accepted.status, 200);
    const acceptedBody = await accepted.json();
    assert.equal(acceptedBody.orgId, testOrgId);
    assert.equal(acceptedBody.role, "analyst");

    const reused = await acceptPost(
      new Request("http://localhost/api/org-invites/accept", { method: "POST", body: JSON.stringify({ token: createdBody.token }) })
    );
    assert.equal(reused.status, 401, "a claimed invite must not be redeemable again");

    const afterAccept = await invitesGet(new Request("http://localhost/api/org-invites", { headers }));
    assert.equal((await afterAccept.json()).invites.length, 0, "accepted invites leave the pending list");
  });
  resetRequestRateLimit();
});

test("revoked invites cannot be accepted and unknown tokens stay indistinguishable", async () => {
  resetRequestRateLimit();
  resetOnboardingLocalStore();
  await withEnv(localOnboardingEnv, async () => {
    const headers = { "Content-Type": "application/json", "x-odim-org-id": testOrgId };
    const created = await invitesPost(
      new Request("http://localhost/api/org-invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "revoke.me@acme.com", role: "admin" })
      })
    );
    const createdBody = await created.json();

    const revoked = await invitesDelete(
      new Request("http://localhost/api/org-invites", { method: "DELETE", headers, body: JSON.stringify({ id: createdBody.invite.id }) })
    );
    assert.equal(revoked.status, 200);

    const acceptRevoked = await acceptPost(
      new Request("http://localhost/api/org-invites/accept", { method: "POST", body: JSON.stringify({ token: createdBody.token }) })
    );
    assert.equal(acceptRevoked.status, 401);

    const acceptUnknown = await acceptPost(
      new Request("http://localhost/api/org-invites/accept", { method: "POST", body: JSON.stringify({ token: "odim_invite_unknown" }) })
    );
    assert.equal(acceptUnknown.status, 401, "unknown and revoked tokens must be indistinguishable");
  });
  resetRequestRateLimit();
});

test("invite acceptance fails closed when the pepper is not configured", async () => {
  resetRequestRateLimit();
  await withEnv({ ...localOnboardingEnv, API_KEY_PEPPER: undefined }, async () => {
    const res = await acceptPost(
      new Request("http://localhost/api/org-invites/accept", { method: "POST", body: JSON.stringify({ token: "odim_invite_x" }) })
    );
    assert.equal(res.status, 503);
  });
  resetRequestRateLimit();
});

test("onboarding endpoints are SSO-exempt and migration 0013 is registered with RLS", () => {
  const middleware = readFileSync("middleware.ts", "utf8");
  assert.match(middleware, /"\/api\/orgs"/);
  assert.match(middleware, /"\/api\/org-invites\/accept"/);

  const runner = readFileSync("scripts/apply-db-migrations.mjs", "utf8");
  assert.match(runner, /0013_org_onboarding\.sql/);

  const migration = readFileSync("supabase/migrations/0013_org_onboarding.sql", "utf8");
  assert.match(migration, /alter table org_invites enable row level security/);
  assert.match(migration, /token_hash text not null unique/);
  assert.match(migration, /check \(role in \('analyst', 'admin'\)\)/);
  assert.match(migration, /alter table users add column if not exists email text/);
});

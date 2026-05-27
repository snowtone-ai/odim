import assert from "node:assert/strict";
import test from "node:test";
import { checkRequestRateLimit, resetRequestRateLimit } from "../lib/api/rate-limit.ts";
import { canIssueScopes, issueApiKey, redactApiKey, resolveIssuableScopes, toApiKeyRow, verifyApiKey } from "../lib/auth/api-keys.ts";
import { authorizeApiRequest, resetApiAuthRateLimit } from "../lib/auth/request.ts";
import { createApiKey, getAdminSettings, revokeApiKey } from "../lib/repositories/admin.ts";

function withoutSupabaseEnv(run) {
  const snapshot = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("API key issuing stores only hash and redacted metadata", () => {
  const previousPepper = process.env.API_KEY_PEPPER;
  process.env.API_KEY_PEPPER = "test-pepper";
  try {
    const issued = issueApiKey({
      orgId: "demo-org",
      name: "Test key",
      createdBy: "demo-admin",
      now: new Date("2026-05-24T00:00:00.000Z"),
      tokenBytes: Buffer.alloc(24, 7)
    });

    assert.match(issued.token, /^odim_live_/);
    assert.notEqual(issued.record.keyHash, issued.token);
    assert.notEqual(issued.record.prefix, issued.token);
    assert.equal(issued.token.startsWith(issued.record.prefix), true);
    assert.equal(verifyApiKey(issued.token, issued.record), true);
    assert.equal(verifyApiKey(`${issued.token}x`, issued.record), false);
    assert.equal(verifyApiKey(issued.token, { ...issued.record, revokedAt: "2026-05-25T00:00:00.000Z" }), false);

    const redacted = redactApiKey(issued.record);
    assert.equal("keyHash" in redacted, false);
    assert.equal("token" in redacted, false);
  } finally {
    if (previousPepper === undefined) delete process.env.API_KEY_PEPPER;
    else process.env.API_KEY_PEPPER = previousPepper;
  }
});

test("API request auth is optional locally and required when enabled", async () => {
  const previousAuth = process.env.AUTH_REQUIRED;
  const orgId = "11111111-1111-4111-8111-111111111111";
  try {
    process.env.AUTH_REQUIRED = "false";
    const local = await authorizeApiRequest(new Request(`https://odim.local/api/alerts?orgId=${orgId}`), "alerts:read");
    assert.equal(local.ok, true);
    assert.equal(local.context.orgId, orgId);

    process.env.AUTH_REQUIRED = "true";
    const missing = await authorizeApiRequest(new Request("https://odim.local/api/alerts"), "alerts:read");
    assert.equal(missing.ok, false);
    assert.equal(missing.status, 401);
  } finally {
    if (previousAuth === undefined) delete process.env.AUTH_REQUIRED;
    else process.env.AUTH_REQUIRED = previousAuth;
  }
});

test("API request auth resolves org scope from a hashed Supabase API key", async () => {
  const previous = {
    AUTH_REQUIRED: process.env.AUTH_REQUIRED,
    API_KEY_PEPPER: process.env.API_KEY_PEPPER,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  const previousFetch = globalThis.fetch;
  process.env.AUTH_REQUIRED = "true";
  process.env.API_KEY_PEPPER = "test-pepper";
  const issued = issueApiKey({
    orgId: "11111111-1111-4111-8111-111111111111",
    name: "Read key",
    scopes: ["alerts:read"],
    now: new Date("2026-05-24T00:00:00.000Z"),
    tokenBytes: Buffer.alloc(24, 9)
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([toApiKeyRow(issued.record)]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });

  try {
    const auth = await authorizeApiRequest(
      new Request("https://odim.local/api/alerts", { headers: { authorization: `Bearer ${issued.token}` } }),
      "alerts:read"
    );
    assert.equal(auth.ok, true);
    assert.equal(auth.context.orgId, issued.record.orgId);
    assert.deepEqual(auth.scopes, ["alerts:read"]);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = previousFetch;
  }
});

test("production API auth is fail-closed when AUTH_REQUIRED is false and pepper is missing", async () => {
  const previous = {
    AUTH_REQUIRED: process.env.AUTH_REQUIRED,
    API_KEY_PEPPER: process.env.API_KEY_PEPPER,
    VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
  process.env.AUTH_REQUIRED = "false";
  process.env.VERCEL_ENV = "production";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  delete process.env.API_KEY_PEPPER;

  try {
    const auth = await authorizeApiRequest(
      new Request("https://odim.local/api/alerts", { headers: { "x-odim-api-key": "odim_live_missing" } }),
      "alerts:read"
    );
    assert.equal(auth.ok, false);
    assert.equal(auth.status, 503);
    assert.match(auth.error, /API_KEY_PEPPER/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("API key verification rate limits repeated invalid attempts by client and prefix", async () => {
  const previous = {
    AUTH_REQUIRED: process.env.AUTH_REQUIRED,
    API_KEY_PEPPER: process.env.API_KEY_PEPPER,
    API_AUTH_MAX_FAILED_ATTEMPTS: process.env.API_AUTH_MAX_FAILED_ATTEMPTS,
    API_AUTH_RATE_LIMIT_WINDOW_MS: process.env.API_AUTH_RATE_LIMIT_WINDOW_MS,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
  const previousFetch = globalThis.fetch;
  process.env.AUTH_REQUIRED = "true";
  process.env.API_KEY_PEPPER = "test-pepper";
  process.env.API_AUTH_MAX_FAILED_ATTEMPTS = "2";
  process.env.API_AUTH_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  globalThis.fetch = async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  resetApiAuthRateLimit();

  try {
    for (const expectedStatus of [401, 401, 429]) {
      const auth = await authorizeApiRequest(
        new Request("https://odim.local/api/alerts", {
          headers: {
            "x-forwarded-for": "203.0.113.10",
            "x-odim-api-key": "odim_live_invalidtoken"
          }
        }),
        "alerts:read"
      );
      assert.equal(auth.ok, false);
      assert.equal(auth.status, expectedStatus);
    }
  } finally {
    resetApiAuthRateLimit();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = previousFetch;
  }
});

test("API auth forbidden response does not disclose required scope names", async () => {
  const previous = {
    AUTH_REQUIRED: process.env.AUTH_REQUIRED,
    API_KEY_PEPPER: process.env.API_KEY_PEPPER,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  const previousFetch = globalThis.fetch;
  process.env.AUTH_REQUIRED = "true";
  process.env.API_KEY_PEPPER = "test-pepper";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const issued = issueApiKey({
    orgId: "11111111-1111-4111-8111-111111111111",
    name: "Wrong scope key",
    scopes: ["alerts:read"],
    now: new Date("2026-05-24T00:00:00.000Z"),
    tokenBytes: Buffer.alloc(24, 11)
  });
  globalThis.fetch = async () =>
    new Response(JSON.stringify([toApiKeyRow(issued.record)]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });

  try {
    const auth = await authorizeApiRequest(
      new Request("https://odim.local/api/settings", { headers: { authorization: `Bearer ${issued.token}` } }),
      "admin:read"
    );
    assert.equal(auth.ok, false);
    assert.equal(auth.status, 403);
    assert.equal(auth.error, "Insufficient API key permissions");
    assert.equal(auth.error.includes("admin:read"), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = previousFetch;
  }
});

test("API key issuance rejects admin wildcard and scope escalation", async () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  assert.throws(
    () => issueApiKey({ orgId, name: "Wildcard", scopes: ["admin:*"] }),
    /API key scope is not issuable/
  );
  assert.throws(() => resolveIssuableScopes(["admin:*"]), /API key scope is not issuable/);
  assert.equal(canIssueScopes(["admin:write"], ["alerts:read"]), false);
  assert.equal(canIssueScopes(["admin:*"], ["alerts:read"]), true);
  assert.equal(canIssueScopes(["alerts:read", "entities:read"], ["alerts:read"]), true);
});

test("request rate limiter returns retry window after burst", () => {
  resetRequestRateLimit();
  const limits = { maxRequests: 2, windowMs: 60_000 };
  assert.equal(checkRequestRateLimit("org-a", "huginn", limits, 1_000).ok, true);
  assert.equal(checkRequestRateLimit("org-a", "huginn", limits, 2_000).ok, true);
  const blocked = checkRequestRateLimit("org-a", "huginn", limits, 3_000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfter, 58);
  assert.equal(checkRequestRateLimit("org-b", "huginn", limits, 3_000).ok, true);
  resetRequestRateLimit();
});

test("admin repository fallback exposes org, members, alert rules, and redacted api keys", async () => {
  const previousPepper = process.env.API_KEY_PEPPER;
  process.env.API_KEY_PEPPER = "test-pepper";
  try {
    await withoutSupabaseEnv(async () => {
      const settings = await getAdminSettings({ orgId: "demo-org" });
      assert.equal(settings.source, "fallback");
      assert.equal(settings.org.id, "demo-org");
      assert.ok(settings.members.some((member) => member.role === "admin"));
      assert.ok(settings.apiKeys.every((key) => !("keyHash" in key)));
      assert.ok(settings.alertRules.every((rule) => rule.orgId === "demo-org"));
      assert.ok(settings.ingestionRuns.some((run) => run.mode === "backfill"));
      assert.ok(settings.sourceWatermarks.some((watermark) => watermark.sourceId === "sec-edgar"));

      const created = await createApiKey({ orgId: "demo-org" }, { name: "Agent key", createdBy: "demo-admin" });
      assert.equal(created.source, "fallback");
      assert.match(created.token, /^odim_live_/);
      assert.equal("keyHash" in created.apiKey, false);

      const revoked = await revokeApiKey({ orgId: "demo-org" }, { id: created.apiKey.id });
      assert.equal(revoked.revoked, true);
      assert.equal(revoked.orgId, "demo-org");
    });
  } finally {
    if (previousPepper === undefined) delete process.env.API_KEY_PEPPER;
    else process.env.API_KEY_PEPPER = previousPepper;
  }
});

test("admin repository falls back when Supabase schema is not applied", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousStrict = process.env.ADMIN_SUPABASE_STRICT;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.ADMIN_SUPABASE_STRICT = "false";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Could not find the table 'public.orgs' in the schema cache" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  try {
    const settings = await getAdminSettings({ orgId: "demo-org" });
    assert.equal(settings.source, "fallback");
    assert.equal(settings.org.id, "demo-org");
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
    if (previousStrict === undefined) delete process.env.ADMIN_SUPABASE_STRICT;
    else process.env.ADMIN_SUPABASE_STRICT = previousStrict;
    globalThis.fetch = previousFetch;
  }
});

// L-2: ingestionRuns / sourceWatermarks が空でも Settings データ構造が壊れないことを確認
test("admin repository fallback returns array types for ingestion fields", async () => {
  await withoutSupabaseEnv(async () => {
    const settings = await getAdminSettings({ orgId: "demo-org" });
    assert.ok(Array.isArray(settings.ingestionRuns), "ingestionRuns must be an array");
    assert.ok(Array.isArray(settings.sourceWatermarks), "sourceWatermarks must be an array");
    // 各要素の必須フィールド型を検証
    for (const run of settings.ingestionRuns) {
      assert.ok(typeof run.id === "string", "run.id must be string");
      assert.ok(["daily", "backfill", "dry-run"].includes(run.mode), "run.mode must be valid enum");
      assert.ok(["running", "succeeded", "failed"].includes(run.status), "run.status must be valid enum");
      assert.ok(typeof run.rawSignalCount === "number", "run.rawSignalCount must be number");
      assert.ok(typeof run.startedAt === "string", "run.startedAt must be string");
    }
    for (const wm of settings.sourceWatermarks) {
      assert.ok(typeof wm.sourceId === "string", "watermark.sourceId must be string");
      assert.ok(typeof wm.rawSignalCount === "number", "watermark.rawSignalCount must be number");
      assert.ok(typeof wm.lastSuccessAt === "string", "watermark.lastSuccessAt must be string");
    }
  });
});

test("admin repository does not hide missing Supabase schema in production", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousStrict = process.env.ADMIN_SUPABASE_STRICT;
  const previousVercel = process.env.VERCEL_ENV;
  const previousRuntime = process.env.ODIM_RUNTIME_ENV;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.ADMIN_SUPABASE_STRICT = "false";
  process.env.VERCEL_ENV = "production";
  process.env.ODIM_RUNTIME_ENV = "production";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Could not find the table 'public.orgs' in the schema cache" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  try {
    await assert.rejects(() => getAdminSettings({ orgId: "demo-org" }), /admin settings read failed/);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
    if (previousStrict === undefined) delete process.env.ADMIN_SUPABASE_STRICT;
    else process.env.ADMIN_SUPABASE_STRICT = previousStrict;
    if (previousVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercel;
    if (previousRuntime === undefined) delete process.env.ODIM_RUNTIME_ENV;
    else process.env.ODIM_RUNTIME_ENV = previousRuntime;
    globalThis.fetch = previousFetch;
  }
});

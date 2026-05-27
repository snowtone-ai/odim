import assert from "node:assert/strict";
import test from "node:test";
import { getOrgContextFromRequest, tenantOrPublicFilter } from "../lib/api/org.ts";
import { listAlerts, listAuditEvents, listEntities, listSignals } from "../lib/repositories/reality.ts";

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

test("repository APIs fall back to source-backed ingestion fixtures when Supabase is absent", async () => {
  await withoutSupabaseEnv(async () => {
    const [alerts, signals, entities, auditEvents] = await Promise.all([
      listAlerts(),
      listSignals(),
      listEntities(),
      listAuditEvents()
    ]);

    assert.equal(alerts.source, "fallback");
    assert.equal(signals.source, "fallback");
    assert.equal(entities.source, "fallback");
    assert.equal(auditEvents.source, "fallback");
    assert.ok(alerts.alerts.length >= 1);
    assert.ok(signals.signals.some((signal) => signal.layer === "Energy"));
    assert.ok(entities.entities.some((entity) => entity.name.includes("Meta") || entity.name.includes("Entergy")));
    assert.ok(auditEvents.auditEvents.every((event) => event.source));
  });
});

test("repository APIs fall back when Supabase schema is not applied", async () => {
  const previous = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    REPOSITORY_SUPABASE_STRICT: process.env.REPOSITORY_SUPABASE_STRICT,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.REPOSITORY_SUPABASE_STRICT = "false";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Could not find the table 'public.alerts' in the schema cache" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });

  try {
    const alerts = await listAlerts({ orgId: "demo-org" });
    assert.equal(alerts.source, "fallback");
    assert.ok(alerts.alerts.length >= 1);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = previousFetch;
  }
});

test("repository APIs do not hide missing Supabase schema in production", async () => {
  const previous = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    REPOSITORY_SUPABASE_STRICT: process.env.REPOSITORY_SUPABASE_STRICT,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ODIM_RUNTIME_ENV: process.env.ODIM_RUNTIME_ENV
  };
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.REPOSITORY_SUPABASE_STRICT = "false";
  process.env.ODIM_RUNTIME_ENV = "production";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Could not find the table 'public.alerts' in the schema cache" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });

  try {
    await assert.rejects(() => listAlerts({ orgId: "demo-org" }), /alerts read failed/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = previousFetch;
  }
});

test("org context helpers build public-only and public-or-org filters", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const queryOrgId = "22222222-2222-4222-8222-222222222222";
  assert.equal(tenantOrPublicFilter("org_id"), "org_id.is.null");
  assert.equal(tenantOrPublicFilter("org_id", orgId), `org_id.is.null,org_id.eq.${orgId}`);
  assert.equal(tenantOrPublicFilter("org_id", "org-123"), "org_id.is.null");

  const request = new Request(`https://odim.local/api/alerts?orgId=${queryOrgId}`, {
    headers: { "x-odim-org-id": orgId }
  });
  assert.deepEqual(getOrgContextFromRequest(request), { orgId });

  assert.deepEqual(getOrgContextFromRequest(new Request("https://odim.local/api/alerts?orgId=bad-org")), {});
});

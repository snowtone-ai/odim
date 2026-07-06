import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GET } from "../app/api/health/route.ts";

test("health endpoint returns ok status with non-sensitive checks only", async () => {
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.ok(["local", "staging", "production"].includes(body.runtime));
  assert.equal(typeof body.uptimeSeconds, "number");
  assert.equal(typeof body.checks.supabaseRead, "boolean");
  assert.equal(typeof body.checks.supabaseWrite, "boolean");
  assert.equal(typeof body.checks.aiProviderConfigured, "boolean");
  // Must never leak secrets, URLs, or key material.
  const raw = JSON.stringify(body);
  assert.doesNotMatch(raw, /key|token|secret|password|postgres|https?:\/\//i);
});

test("health endpoint is exempt from SSO middleware gating", () => {
  const middleware = readFileSync("middleware.ts", "utf8");
  assert.match(middleware, /\/api\/health/);
});

test("root route is a public landing page, not a dashboard redirect", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  assert.doesNotMatch(page, /redirect\(/);
  assert.match(page, /href="\/login"/);
  assert.match(page, /href="\/map"/);
  assert.doesNotMatch(page, /placeholder|scaffold/i);
});

test("dashboard shell is scoped to the (dashboard) layout, not the root layout", () => {
  const rootLayout = readFileSync("app/layout.tsx", "utf8");
  const dashboardLayout = readFileSync("app/(dashboard)/layout.tsx", "utf8");
  assert.doesNotMatch(rootLayout, /Shell/);
  assert.match(dashboardLayout, /<Shell/);
  assert.match(dashboardLayout, /CommandPalette/);
});

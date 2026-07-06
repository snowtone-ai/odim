import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GET } from "../app/api/health/route.ts";
import { parseMarkdown } from "../lib/docs/markdown.ts";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";

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
  assert.doesNotMatch(raw, /key|token|secret|password|postgres|https?:\/\/|eyJ[A-Za-z0-9_-]+/i);
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

// LP-006 — public API docs surface

test("markdown parser handles headings, nested lists, inline and fenced code", () => {
  const blocks = parseMarkdown(
    "# Title\n\nIntro with `code`.\n\n- top\n  - `nested` -> scope\n\n```json\n{ \"data\": [] }\n```\n"
  );
  assert.deepEqual(
    blocks.map((block) => block.type),
    ["heading", "paragraph", "list", "code"]
  );
  assert.equal(blocks[0].level, 1);
  assert.deepEqual(blocks[1].segments, [
    { code: false, text: "Intro with " },
    { code: true, text: "code" },
    { code: false, text: "." }
  ]);
  assert.equal(blocks[2].items.length, 2);
  assert.equal(blocks[2].items[1].indent, 1);
  assert.equal(blocks[2].items[1].segments[0].code, true);
  assert.equal(blocks[3].language, "json");
  assert.equal(blocks[3].code, '{ "data": [] }');
});

test("docs route renders the real API reference without raw HTML injection", () => {
  const page = readFileSync("app/docs/page.tsx", "utf8");
  assert.match(page, /api-reference\.md/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  // The shipped reference itself must parse into substantive blocks.
  const blocks = parseMarkdown(readFileSync("docs/api-reference.md", "utf8"));
  assert.ok(blocks.some((block) => block.type === "code"));
  assert.ok(blocks.some((block) => block.type === "list"));
  assert.ok(
    blocks.some(
      (block) =>
        block.type === "list" &&
        block.items.some((item) => item.segments.some((s) => s.code && s.text.startsWith("/api/v1/")))
    )
  );
});

// LP-007 — legal readiness pages

test("legal pages exist with real content, metadata, and shared public shell", () => {
  for (const route of ["terms", "privacy", "security"]) {
    const source = readFileSync(`app/${route}/page.tsx`, "utf8");
    assert.match(source, /export const metadata/, route);
    assert.match(source, /PublicShell/, route);
    assert.match(source, /Last updated/, route);
    assert.doesNotMatch(source, /TODO|lorem|placeholder|FIXME/i, route);
  }
});

test("landing footer links to docs and legal pages", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  for (const href of ["/docs", "/terms", "/privacy", "/security"]) {
    assert.match(page, new RegExp(`"${href}"`));
  }
});

test("new public pages are not gated by middleware protected prefixes", () => {
  const middleware = readFileSync("middleware.ts", "utf8");
  for (const path of ["/docs", "/terms", "/privacy", "/security"]) {
    assert.ok(!middleware.includes(`"${path}"`), `${path} must stay public`);
  }
});

// LP-008 — SEO/meta polish

test("sitemap lists only public routes with absolute same-origin urls", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);
  for (const path of ["/", "/docs", "/terms", "/privacy", "/security", "/signup", "/login"]) {
    assert.ok(urls.some((url) => new URL(url).pathname === path), `missing ${path}`);
  }
  assert.equal(new Set(urls.map((url) => new URL(url).origin)).size, 1);
  for (const gated of ["/map", "/entity", "/alerts", "/huginn", "/settings", "/custom", "/invite", "/api"]) {
    assert.ok(!urls.some((url) => new URL(url).pathname.startsWith(gated)), `${gated} must not be listed`);
  }
});

test("robots disallows dashboard, api, and invite paths and points to sitemap", () => {
  const result = robots();
  const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
  for (const path of ["/api/", "/map", "/entity", "/alerts", "/huginn", "/settings", "/custom", "/invite"]) {
    assert.ok(disallow.includes(path), `${path} must be disallowed`);
  }
  assert.match(result.sitemap, /\/sitemap\.xml$/);
});

test("root layout defines OG/twitter metadata and a title template", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /metadataBase/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /twitter/);
  assert.match(layout, /template: "%s — Odim"/);
});

test("every page exports a per-page title", () => {
  for (const page of [
    "app/(dashboard)/map/page.tsx",
    "app/(dashboard)/entity/page.tsx",
    "app/(dashboard)/alerts/page.tsx",
    "app/(dashboard)/huginn/page.tsx",
    "app/(dashboard)/settings/page.tsx",
    "app/(dashboard)/custom/page.tsx",
    "app/login/page.tsx",
    "app/signup/page.tsx",
    "app/invite/page.tsx",
    "app/docs/page.tsx",
    "app/terms/page.tsx",
    "app/privacy/page.tsx",
    "app/security/page.tsx"
  ]) {
    assert.match(readFileSync(page, "utf8"), /export const metadata/, page);
  }
});

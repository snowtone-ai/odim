import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSourceHealthEntries } from "../lib/pipeline/source-health.ts";

function source(path) {
  return readFileSync(path, "utf8");
}

const shell = source("components/ui/settings-shell.tsx");
const page = source("app/(dashboard)/settings/page.tsx");
const surfaces = [
  "components/ui/api-key-manager.tsx",
  "components/ui/billing-panel.tsx",
  "components/ui/audit-export-controls.tsx",
  "components/ui/webhook-settings.tsx",
  "components/ui/source-health-panel.tsx",
  "components/ui/seed-memory-manager.tsx",
  "components/ui/org-members-panel.tsx",
  "components/ui/locale-switcher.tsx"
].map(source).join("\n");

test("settings is an index plus one active work surface", () => {
  assert.match(shell, /Settings categories/);
  assert.match(shell, /Workspace controls/);
  assert.match(shell, /role="tabpanel"/);
  assert.match(shell, /role="tablist"/);
  assert.match(shell, /settings-section-select/);
  assert.match(shell, /Categories/);
  assert.match(shell, /← Categories/);
  assert.match(shell, /aria-live="polite"/);
  assert.match(shell, /min-h-11/);
  assert.doesNotMatch(shell, /from ["']@\/components\/ui\/panel["']/);
});

test("settings keeps the server-owned contracts and org-scoped operations", () => {
  assert.match(page, /getAdminSettings/);
  assert.match(page, /listSeedMemories/);
  assert.match(page, /listWatchtowerRuns/);
  assert.match(page, /getOrgBilling/);
  assert.match(page, /listInvites/);
  assert.match(page, /settingsOrgId/);
  assert.doesNotMatch(page, /defaultSettingsOrgId/);
  assert.match(page, /AlertRuleBuilder/);
  assert.match(page, /WatchtowerWorkflows/);
  assert.match(page, /AuditExportControls/);
  assert.match(page, /SourceHealthPanel/);
  assert.match(page, /categoryLabels/);
});

test("settings actions expose touch-sized controls and explicit feedback", () => {
  assert.match(surfaces, /min-h-11/);
  assert.match(surfaces, /aria-live="polite"/);
  assert.match(surfaces, /aria-live="assertive"/);
  assert.match(surfaces, /focus-visible:outline/);
  assert.match(surfaces, /duration-\[120ms\]/);
  assert.doesNotMatch(surfaces, new RegExp("text-\\[(?:8|9|10)px\\]"));
  assert.doesNotMatch(page, new RegExp("text-\\[(?:8|9|10)px\\]"));
});

test("source and billing states remain truthful and distinguishable", () => {
  const health = source("components/ui/source-health-panel.tsx");
  const billing = source("components/ui/billing-panel.tsx");
  const webhook = source("components/ui/webhook-settings.tsx");
  assert.match(page, /sourcesConfig/);
  assert.match(page, /buildSourceHealthEntries/);
  assert.match(page, /settings\.ingestionRuns/);
  assert.match(health, /live-verified/);
  assert.match(health, /fixture-only/);
  assert.match(health, /configured/);
  assert.match(health, /skipped/);
  assert.match(health, /failed/);
  assert.match(health, /healthy/);
  assert.match(health, /stale/);
  assert.match(health, /failing/);
  assert.match(billing, /billingEnabled/);
  assert.match(billing, /notEnabled/);
  assert.match(webhook, /notConfigured/);
  assert.match(webhook, /testResult/);
});

test("source health keeps configured feeds visible and only live success becomes verified", () => {
  const configuredSources = [
    { id: "sec-form-d", enabled: true },
    { id: "ferc-elibrary", enabled: true },
    { id: "fixture-feed", enabled: true },
    { id: "disabled-feed", enabled: false }
  ];
  const entries = buildSourceHealthEntries(
    configuredSources,
    [{
      mode: "dry-run",
      status: "succeeded",
      startedAt: "2026-08-24T00:00:00.000Z",
      finishedAt: "2026-08-24T00:01:00.000Z",
      sourceReports: [
        { id: "fixture-feed", ok: true, count: 4, lastObservedAt: "2026-08-24T00:00:00.000Z" }
      ]
    }],
    [{
      sourceId: "ferc-elibrary",
      lastSuccessAt: "2026-08-23T00:00:00.000Z",
      lastObservedAt: "2026-08-23T00:00:00.000Z",
      rawSignalCount: 2
    }]
  );
  const byId = new Map(entries.map((entry) => [entry.sourceId, entry]));
  assert.equal(byId.get("sec-form-d")?.state, "configured");
  assert.equal(byId.get("ferc-elibrary")?.state, "live-verified");
  assert.equal(byId.get("fixture-feed")?.state, "fixture-only");
  assert.equal(byId.has("disabled-feed"), false);

  const fallbackEntries = buildSourceHealthEntries(configuredSources, [], [], true);
  assert.ok(fallbackEntries.every((entry) => entry.state === "fixture-only"));

  const failed = buildSourceHealthEntries(
    [{ id: "sec-form-d", enabled: true }],
    [{
      mode: "daily",
      status: "succeeded",
      startedAt: "2026-08-24T00:00:00.000Z",
      sourceReports: [{ id: "sec-form-d", ok: false, count: 0, error: "SEC unavailable" }]
    }],
    []
  );
  assert.equal(failed[0].state, "failed");
  assert.equal(failed[0].detail, "SEC unavailable");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const page = read("app/(dashboard)/alerts/page.tsx");
const workstation = read("components/ui/alerts-workstation.tsx");
const rules = read("components/ui/alert-rule-builder.tsx");
const watchtower = read("components/ui/watchtower-workflows.tsx");
const notificationPrompt = read("components/ui/push-notification-prompt.tsx");
const surfaces = [workstation, rules, watchtower].join("\n");

test("Alerts keeps queue, selected case, and secondary automation in one workbench", () => {
  assert.match(page, /force-dynamic/);
  assert.match(page, /listWatchtowerRuns/);
  assert.match(page, /listWatchtowerPlaybooks/);
  assert.match(workstation, /lg:grid-cols-\[minmax\(300px,0\.42fr\)_minmax\(0,1fr\)\]/);
  assert.match(workstation, /alert-queue-heading/);
  assert.match(workstation, /case-file-heading/);
  assert.match(workstation, /detailTab/);
  assert.match(workstation, /role="tablist"/);
  assert.match(workstation, /<WatchtowerWorkflows/);
  assert.match(workstation, /<EvidenceThread/);
});

test("Alerts exposes loading, empty, error, success, read, and notification states", () => {
  assert.match(workstation, /loading = false/);
  assert.match(workstation, /aria-busy=\{loading\}/);
  assert.match(workstation, /role="status"/);
  assert.match(workstation, /role="alert"/);
  assert.match(workstation, /aria-live="polite"/);
  assert.match(workstation, /markRead/);
  assert.match(workstation, /markAllRead/);
  assert.match(workstation, /PushNotificationPrompt/);
  assert.doesNotMatch(workstation, /aria-haspopup="dialog"/);
  assert.match(workstation, /requestAnimationFrame/);
  assert.match(workstation, /motion-reduce/);
  assert.match(notificationPrompt, /getSubscription\(\)/);
  assert.match(notificationPrompt, /existingSubscription \?\?/);
  assert.match(notificationPrompt, /role="alert"/);
  assert.match(notificationPrompt, /role="status"/);
  assert.match(notificationPrompt, /Retry setup/);
  assert.match(notificationPrompt, /if \(!open \|\| !supported \|\| dismissed\) return null/);
});

test("Alert rule mutations keep the existing API contracts", () => {
  assert.match(rules, /\/api\/alert-rules\?id=/);
  assert.match(rules, /method: "POST"/);
  assert.match(rules, /method: "PATCH"/);
  assert.match(rules, /method: "DELETE"/);
  assert.match(rules, /minConfidence: form\.minConfidence \/ 100/);
  assert.match(rules, /destination: form\.destination/);
  assert.match(rules, /aria-pressed/);
});

test("Watchtower actions keep start, approval, and rerun endpoints", () => {
  assert.match(watchtower, /\/api\/watchtower\/runs/);
  assert.match(watchtower, /\/api\/watchtower\/approvals/);
  assert.match(watchtower, /\/api\/watchtower\/rerun/);
  assert.match(watchtower, /actor: "dashboard"/);
  assert.match(watchtower, /sourceRefs/);
  assert.match(watchtower, /approvals/);
  assert.match(watchtower, /aria-live="polite"/);
  assert.match(watchtower, /min-h-11/);
});

test("Alert surfaces use the operational palette, hairlines, and readable controls", () => {
  assert.match(surfaces, /var\(--signal\)/);
  assert.match(surfaces, /var\(--evidence\)/);
  assert.match(surfaces, /var\(--critical\)/);
  assert.match(surfaces, /var\(--motion-micro\)/);
  assert.doesNotMatch(surfaces, /#c9a961|201,169,97|var\(--rune|linear-gradient|backdrop-filter|glass/);
  assert.doesNotMatch(surfaces, /text-\[(?:[0-9]|10)px\]/);
  assert.match(surfaces, /min-h-11/);
});

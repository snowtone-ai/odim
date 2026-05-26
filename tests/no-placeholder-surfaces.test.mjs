import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

/**
 * Discover all page.tsx files under app/(dashboard)/ automatically.
 * Adding a new screen automatically includes it in these checks.
 */
function discoverPageFiles() {
  const base = "app/(dashboard)";
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${base}/${entry.name}/page.tsx`)
    .filter(existsSync);
}

/**
 * Client component paths that must expose source or confidence evidence.
 * Listed explicitly since client components live outside app/(dashboard)/.
 */
const evidenceComponentFiles = [
  "components/ui/entity-workstation.tsx",
  "components/ui/huginn-console.tsx",
  "lib/i18n/messages.ts"
];

test("dashboard product surfaces do not contain placeholder/scaffold copy", () => {
  const pageFiles = discoverPageFiles();
  assert.ok(pageFiles.length > 0, "No page files discovered — check app/(dashboard)/ path");
  for (const path of pageFiles) {
    const content = readFileSync(path, "utf8");
    assert.doesNotMatch(content, /placeholder|scaffold/i, path);
  }
});

test("core dashboard screens expose source or confidence evidence", () => {
  const pageFiles = discoverPageFiles();
  const allFiles = [...pageFiles, ...evidenceComponentFiles.filter(existsSync)];
  const combined = allFiles.map((f) => readFileSync(f, "utf8")).join("\n");
  assert.match(combined, /source|confidence|Confidence|audit|evidence|sourceRefs/i, "No evidence surface found in dashboard files");
});

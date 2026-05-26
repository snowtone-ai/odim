import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Page files checked for scaffold copy
const productPageFiles = [
  "app/(dashboard)/map/page.tsx",
  "app/(dashboard)/entity/page.tsx",
  "app/(dashboard)/alerts/page.tsx",
  "app/(dashboard)/huginn/page.tsx",
  "app/(dashboard)/settings/page.tsx",
  "lib/i18n/messages.ts"
];

// Surface files that must expose source/confidence evidence
// (entity page now delegates to EntityWorkstation client component)
const evidenceSurfaceFiles = [
  "app/(dashboard)/map/page.tsx",
  "components/ui/entity-workstation.tsx",
  "app/(dashboard)/alerts/page.tsx",
  "components/ui/huginn-console.tsx",
  "app/(dashboard)/settings/page.tsx",
  "lib/i18n/messages.ts"
];

test("dashboard product surfaces do not contain placeholder/scaffold copy", () => {
  for (const path of productPageFiles) {
    const content = readFileSync(path, "utf8");
    assert.doesNotMatch(content, /placeholder|scaffold/i, path);
  }
});

test("core dashboard screens expose source or confidence evidence", () => {
  for (const path of evidenceSurfaceFiles) {
    const content = readFileSync(path, "utf8");
    assert.match(content, /source|confidence|Confidence|audit|evidence|sourceRefs/i, path);
  }
});

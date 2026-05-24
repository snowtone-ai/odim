import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productSurfaceFiles = [
  "app/(dashboard)/map/page.tsx",
  "app/(dashboard)/capital-flow/page.tsx",
  "app/(dashboard)/entity/page.tsx",
  "app/(dashboard)/alerts/page.tsx",
  "app/(dashboard)/huginn/page.tsx",
  "app/(dashboard)/watchlist/page.tsx",
  "app/(dashboard)/audit/page.tsx",
  "app/(dashboard)/settings/page.tsx",
  "lib/i18n/messages.ts"
];

test("dashboard product surfaces do not contain placeholder/scaffold copy", () => {
  for (const path of productSurfaceFiles) {
    const content = readFileSync(path, "utf8");
    assert.doesNotMatch(content, /placeholder|scaffold/i, path);
  }
});

test("core dashboard screens expose source or confidence evidence", () => {
  for (const path of productSurfaceFiles.slice(0, 8)) {
    const content = readFileSync(path, "utf8");
    assert.match(content, /source|confidence|Confidence|audit|evidence|sourceRefs/i, path);
  }
});

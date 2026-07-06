import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("shell keeps desktop sidebar while supporting mobile navigation", () => {
  const shell = readFileSync("components/ui/shell.tsx", "utf8");
  assert.match(shell, /md:fixed/);
  assert.match(shell, /overflow-x-auto/);
  assert.match(shell, /md:ml-\[calc\(var\(--sidebar-w\)\+20px\)\]/);
});

test("Signal Alerts uses a single-column mobile layout before desktop split", () => {
  // Layout is in the AlertsWorkstation client component (refactored from T101)
  const workstation = readFileSync("components/ui/alerts-workstation.tsx", "utf8");
  assert.match(workstation, /grid-cols-1/);
  assert.match(workstation, /xl:grid-cols-\[420px_1fr\]/);
});

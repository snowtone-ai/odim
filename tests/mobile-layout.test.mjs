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
  const alertsPage = readFileSync("app/(dashboard)/alerts/page.tsx", "utf8");
  assert.match(alertsPage, /grid-cols-1/);
  assert.match(alertsPage, /xl:grid-cols-\[420px_1fr\]/);
});

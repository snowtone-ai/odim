import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("shell provides a labeled desktop rail and a fixed mobile nav", () => {
  const shell = readFileSync("components/ui/shell.tsx", "utf8");

  assert.match(shell, /data-testid=\"desktop-rail\"/);
  assert.match(shell, /min-\[1200px\]:w-\[220px\]/);
  assert.match(shell, /md:max-\[1199px\]:ml-\[68px\]/);
  assert.match(shell, /min-\[1200px\]:ml-\[220px\]/);
  assert.doesNotMatch(shell, /md:ml-\[68px\][^\n]*min-\[1200px\]:ml-\[220px\]/);
  assert.match(shell, /data-testid=\"mobile-bottom-nav\"/);
  assert.match(shell, /fixed inset-x-0 bottom-0/);
  assert.match(shell, /max-w-\[390px\]/);
  assert.match(shell, /min-h-11/);
  assert.match(shell, /const mobileNav = \[desktopNav\[2\]/);
});

test("mobile frame reserves space and does not globally render notification permission", () => {
  const shell = readFileSync("components/ui/shell.tsx", "utf8");
  const prompt = readFileSync("components/ui/push-notification-prompt.tsx", "utf8");

  assert.match(shell, /pb-\[78px\]/);
  assert.doesNotMatch(shell, /<PushNotificationPrompt/);
  assert.match(prompt, /open = false/);
  assert.match(prompt, /if \(!open \|\|/);
});

test("Signal Alerts keeps its queue-first mobile split", () => {
  const workstation = readFileSync("components/ui/alerts-workstation.tsx", "utf8");
  assert.match(workstation, /grid-cols-1/);
  assert.match(workstation, /lg:grid-cols-\[minmax\(300px,0\.42fr\)_minmax\(0,1fr\)\]/);
});

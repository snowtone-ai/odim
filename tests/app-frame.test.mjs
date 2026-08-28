import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("dashboard layout composes the frame and command palette", () => {
  const layout = read("app/(dashboard)/layout.tsx");
  assert.match(layout, /<Shell messages=\{messages\} locale=\{locale\}>\{children\}<\/Shell>/);
  assert.match(layout, /<CommandPalette/);
});

test("frame exposes an actionable command trigger and truthful source state", () => {
  const shell = read("components/ui/shell.tsx");
  const messages = read("lib/i18n/messages.ts");

  assert.match(shell, /data-testid=\"context-strip\"/);
  assert.match(shell, /data-testid=\"command-trigger\"/);
  assert.match(shell, /odim:open-command/);
  assert.match(shell, /data-testid=\"source-status\"/);
  assert.match(shell, /text-\[11px\] leading-4/);
  assert.match(shell, /min-h-11/);
  assert.match(shell, /motion-reduce:transition-none/);
  assert.match(messages, /fixtureStatus: \"Fixture data · not live\"/);
  assert.match(messages, /fixtureStatus: \"サンプルデータ（実データではありません）\"/);
});

test("overlays use modal dialogs with initial focus, native inertness, and focus restoration", () => {
  const palette = read("components/ui/command-palette.tsx");
  const keyboard = read("components/ui/keyboard-nav.tsx");
  const cascade = read("components/ui/cascade-map-modal.tsx");
  const gap = read("components/ui/gap-analysis-modal.tsx");
  const focusGuard = read("components/ui/modal-focus.ts");

  for (const source of [palette, keyboard, cascade, gap]) {
    assert.match(source, /<dialog/);
    assert.match(source, /\.showModal\(\)/);
    assert.match(source, /onCancel=/);
    assert.match(source, /previousActiveRef\.current\?\.focus\(\)/);
    assert.match(source, /onKeyDown=\{trapDialogFocus\}/);
    assert.doesNotMatch(source, /aria-modal=\"true\"/);
  }
  assert.match(focusGuard, /event\.shiftKey/);
  assert.match(focusGuard, /event\.preventDefault\(\)/);
  assert.match(focusGuard, /getClientRects\(\)\.length > 0/);
  assert.match(palette, /odim:open-command/);
  assert.doesNotMatch(palette, /backdropFilter/);
  assert.doesNotMatch(keyboard, /backdropFilter/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const builder = readFileSync("components/ui/dashboard-builder.tsx", "utf8");
const page = readFileSync("app/(dashboard)/custom/page.tsx", "utf8");

test("custom route is a canvas workspace, not a card gallery", () => {
  assert.match(page, /DashboardBuilder/);
  assert.match(builder, /labels\.canvas/);
  assert.match(builder, /grid-cols-12/);
  assert.match(builder, /labels\.canvasColumns/);
  assert.match(builder, /draggable={editMode}/);
  assert.match(builder, /onDrop=/);
  assert.match(builder, /labels\.buildTools/);
  assert.match(builder, /labels\.addSurface/);
  assert.match(builder, /labels\.fixtureWorkspace/);
  assert.doesNotMatch(builder, /widgetPalette\.map\(\(entry\) => <section/);
});

test("custom workspace has accessible state and touch targets", () => {
  assert.match(builder, /role="tablist"/);
  assert.match(builder, /aria-selected/);
  assert.match(builder, /aria-pressed={editMode}/);
  assert.match(builder, /aria-live="polite"/);
  assert.match(builder, /min-h-11/);
  assert.match(builder, /duration-\[120ms\]/);
  assert.match(builder, /duration-\[180ms\]/);
  assert.match(builder, /motion-reduce:transition-none/);
  assert.match(builder, /labels\.remove/);
  assert.doesNotMatch(builder, new RegExp("text-\\[(?:8|9|10)px\\]"));
});

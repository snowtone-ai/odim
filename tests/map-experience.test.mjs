import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const map = read("components/ui/reality-map.tsx");
const page = read("app/(dashboard)/map/page.tsx");
const dailyDiff = read("components/ui/daily-diff.tsx");
const tooltip = read("components/ui/substrate-tooltip.tsx");

test("Reality Map uses the public OpenFreeMap dark style through a single command strip", () => {
  assert.match(map, /https:\/\/tiles\.openfreemap\.org\/styles\/dark/);
  assert.match(map, /Noto Sans Regular/);
  assert.match(map, /data-testid="map-command-strip"/);
  assert.match(map, /aria-controls="map-filter-controls"/);
  assert.match(map, /Fixture map · not live/);
  assert.doesNotMatch(map, /styles\/liberty/);
});

test("selection owns the only contextual map inspector and provenance remains explicit", () => {
  assert.match(map, /data-testid="map-inspector"/);
  assert.match(map, /<EvidenceThread/);
  assert.match(map, /label: "Fixture data", detail: "not live"/);
  assert.match(map, /dailyDiff\?: DailyDiff/);
  assert.doesNotMatch(map, /backdropFilter|backdrop-filter|#c9a961|glow-pulse/);
});

test("map failures can be retried and map animation is restricted to selected context", () => {
  assert.match(map, /map\.on\("error", markStyleError\)/);
  assert.match(map, /function createMissingStyleImage/);
  assert.match(map, /circle-11/);
  assert.match(map, /const installMissingStyleImage/);
  assert.match(map, /map\.on\("styleimagemissing"/);
  assert.ok(map.indexOf('map.on("styleimagemissing"') < map.indexOf('map.on("load"'));
  assert.match(map, /data-testid="map-load-error"/);
  assert.match(map, /data-testid="map-retry"/);
  assert.match(map, /setMapAttempt\(\(attempt\) => attempt \+ 1\)/);
  assert.match(map, /entity-selected-ring/);
  assert.match(map, /const MAP_TRANSITION_MS = 280/);
  assert.match(map, /function mapTransitionDuration\(\)/);
  assert.match(map, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(map, /essential: true/);
  assert.match(map, /!selectedIdRef\.current/);
  assert.match(map, /document\.hidden/);
  assert.match(map, /cancelAnimationFrame/);
});

test("the route keeps daily change information inside the map and mobile does not stack it over selection", () => {
  assert.match(page, /dailyDiff=\{diff\}/);
  assert.doesNotMatch(page, /<DailyDiffPanel/);
  assert.match(page, /100dvh/);
  assert.match(dailyDiff, /selectionActive\?: boolean/);
  assert.match(dailyDiff, /hidden md:block/);
  assert.match(dailyDiff, /Fixture comparison with the prior seeded run/);
  assert.match(dailyDiff, /aria-expanded/);
});

test("supporting tooltip uses the shared dark surface language without blur", () => {
  assert.match(tooltip, /var\(--surface\)/);
  assert.match(tooltip, /var\(--signal\)/);
  assert.doesNotMatch(map, /text-\[(?:9|10)px\]|font-size:(?:9|10)px/);
  assert.doesNotMatch(dailyDiff, /text-\[(?:9|10)px\]/);
  assert.doesNotMatch(tooltip, /fontSize: (?:9|10)/);
  assert.doesNotMatch(tooltip, /backdropFilter|backdrop-filter/);
});

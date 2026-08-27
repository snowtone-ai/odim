import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const map = read("components/ui/reality-map.tsx");
const alerts = read("components/ui/alerts-workstation.tsx");
const entities = read("components/ui/entity-workstation.tsx");
const settings = read("components/ui/settings-shell.tsx");
const commandPalette = read("components/ui/command-palette.tsx");
const globals = read("app/globals.css");

test("Reality Map keeps MapLibre out of the initial runtime and cleans async work", () => {
  assert.match(map, /import\(["']maplibre-gl["']\)/);
  assert.doesNotMatch(map, /import\s+(?!type\b)[\s\S]{0,140}from\s+["']maplibre-gl["']/);
  assert.match(map, /const entityById = new Map\(allEntities\.map/);
  assert.match(map, /const searchResults = useMemo/);
  assert.doesNotMatch(map, /setTimeout\(\(\) => searchInputRef\.current/);
  assert.match(map, /requestAnimationFrame\(\(\) => searchInputRef\.current\?\.focus\(\)\)/);
  assert.match(map, /cancelAnimationFrame\(frame\)/);
  assert.match(map, /document\.addEventListener\("visibilitychange"/);
  assert.match(map, /if \(document\.hidden\)/);
  assert.match(map, /clearInterval\(dashIntervalRef\.current\)/);
  assert.match(map, /if \(cancelled\) return;/);
  assert.match(map, /mapRef\.current\.remove\(\)/);
});

test("Reality Map keeps compact source attribution visible", () => {
  assert.match(map, /attributionControl: \{ compact: true \}/);
  assert.match(globals, /\.maplibregl-ctrl-attrib \{/);
  assert.doesNotMatch(globals, /\.maplibregl-ctrl-attrib\s*\{[^}]*display:\s*none/is);
});

test("Alerts and settings reuse indexed derived collections", () => {
  assert.match(alerts, /readAlertIds/);
  assert.match(alerts, /new Set\(readAlertIds\)/);
  assert.match(alerts, /const existing = grouped\.get\(key\)/);
  assert.match(alerts, /if \(existing\) existing\.push\(alert\)/);
  assert.match(settings, /const existing = grouped\.get\(category\)/);
  assert.match(settings, /if \(existing\) existing\.push\(section\)/);
  assert.match(settings, /useMemo<CategoryLabels>/);
});

test("Entity comparison and command search compute only when their inputs change", () => {
  assert.match(entities, /const displayed = useMemo/);
  assert.match(entities, /const compareEntities = useMemo/);
  assert.match(entities, /<EntityCompare entities=\{compareEntities\}/);
  assert.match(commandPalette, /const allResults = useMemo/);
  assert.match(commandPalette, /const filtered = useMemo/);
  assert.match(commandPalette, /requestAnimationFrame\(\(\) => inputRef\.current\?\.focus\(\)\)/);
  assert.match(commandPalette, /cancelAnimationFrame\(frame\)/);
  assert.doesNotMatch(commandPalette, /setTimeout\(/);
});

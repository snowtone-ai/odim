import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const workstation = read("components/ui/entity-workstation.tsx");
const compare = read("components/ui/entity-compare.tsx");
const gap = read("components/ui/gap-analysis-modal.tsx");
const cascade = read("components/ui/cascade-map-modal.tsx");
const controls = [
  read("components/ui/saved-search-bar.tsx"),
  read("components/ui/favorite-button.tsx"),
  read("components/ui/export-button.tsx"),
  read("components/ui/entity-link.tsx")
].join("\n");

test("Entities keeps index, object, and evidence as one stable workbench", () => {
  assert.match(workstation, /lg:grid-cols-\[280px_minmax\(0,1fr\)_340px\]/);
  assert.match(workstation, /aria-label="Entity index"/);
  assert.match(workstation, /aria-label="Evidence inspector"/);
  assert.match(workstation, /mobileView/);
  assert.match(workstation, /mobileTab/);
  assert.match(workstation, /role="tablist"/);
  assert.match(workstation, /evidenceWorkbench/);
  assert.match(workstation, /useFavorites/);
});

test("Entity evidence and persistence contracts remain connected", () => {
  assert.match(workstation, /Evidence paths/);
  assert.match(workstation, /Recent source records/);
  assert.match(workstation, /setCascadeEntityId/);
  assert.match(workstation, /<SavedSearchBar/);
  assert.match(workstation, /<FavoriteButton/);
  assert.match(controls, /useSavedSearches/);
  assert.match(controls, /useFavorites/);
  assert.match(controls, /\/api\/export\?type=/);
  assert.match(cascade, /\/api\/entity-cascade\?id=/);
});

test("Comparison is a readable value surface rather than a decorative chart panel", () => {
  assert.match(compare, /aria-label="Entity comparison"/);
  assert.match(compare, /Layer evidence/);
  assert.match(compare, /(?:min-h-11|h-11)/);
  assert.doesNotMatch(compare, /linear-gradient|backdrop-filter|#c9a961|var\(--rune/);
});

test("Functional modals expose dialog semantics, escape, and focus return", () => {
  for (const source of [gap, cascade]) {
    assert.match(source, /<dialog/);
    assert.match(source, /\.showModal\(\)/);
    assert.match(source, /onCancel=/);
    assert.match(source, /onKeyDown=\{trapDialogFocus\}/);
    assert.match(source, /previousActiveRef\.current\?\.focus\(\)/);
    assert.match(source, /(?:min-h-11|h-11)/);
    assert.doesNotMatch(source, /backdrop-filter|linear-gradient|#c9a961|var\(--rune/);
  }
});

test("Entity actions use the new operational palette and motion contract", () => {
  assert.match(controls, /var\(--signal\)/);
  assert.match(controls, /var\(--evidence\)/);
  assert.match(controls, /var\(--motion-micro\)/);
  assert.match(controls, /min-h-11/);
  assert.doesNotMatch(controls, /#c9a961|var\(--rune|linear-gradient|backdrop-filter/);
});

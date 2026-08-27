import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertLinkUsesDefaultPrefetch(source, href, name) {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const disabledPattern = new RegExp(`href="${escapedHref}"[^>]*prefetch=\\{false\\}|prefetch=\\{false\\}[^>]*href="${escapedHref}"`);
  assert.doesNotMatch(source, disabledPattern, `${name} should use Next's default prefetch policy`);
}

test("primary dashboard navigation uses Next's default prefetch policy", () => {
  const shell = read("components/ui/shell.tsx");

  assert.doesNotMatch(shell, /prefetch=\{false\}/);
  assert.match(shell, /function RailLink/);
  assert.match(shell, /function MobileNav/);
});

test("landing high-intent routes use default prefetch while low-intent links stay explicit", () => {
  const landing = read("app/page.tsx");
  const publicShell = read("components/ui/public-shell.tsx");

  assertLinkUsesDefaultPrefetch(landing, "/map", "landing map CTA");
  assertLinkUsesDefaultPrefetch(landing, "/login", "landing sign-in link");
  assertLinkUsesDefaultPrefetch(landing, "/signup", "landing workspace CTA");
  assertLinkUsesDefaultPrefetch(publicShell, "/login", "public shell sign-in CTA");
  assertLinkUsesDefaultPrefetch(publicShell, "/signup", "public shell workspace CTA");
  assert.match(landing, /href="\/docs"[^>]*prefetch=\{false\}/);
  assert.match(landing, /\["API Docs", "\/docs"\][\s\S]*prefetch=\{false\}/);
  assert.match(publicShell, /prefetch=\{false\}/);
});

test("command palette memoizes search work and cancels focus scheduling", () => {
  const palette = read("components/ui/command-palette.tsx");

  assert.match(palette, /useMemo/);
  assert.match(palette, /const allResults = useMemo/);
  assert.match(palette, /const filtered = useMemo/);
  assert.match(palette, /requestAnimationFrame/);
  assert.match(palette, /cancelAnimationFrame/);
  assert.doesNotMatch(palette, /setTimeout\(/);
});

test("editorial display font is not globally preloaded", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /const spectral = Spectral\([\s\S]*?preload: false/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tokens = readFileSync("styles/tokens.css", "utf8");
const globals = readFileSync("app/globals.css", "utf8");
const screen = readFileSync("components/ui/screen.tsx", "utf8");
const panel = readFileSync("components/ui/panel.tsx", "utf8");
const evidenceThread = readFileSync("components/ui/evidence-thread.tsx", "utf8");
const anomalyBadge = readFileSync("components/ui/anomaly-badge.tsx", "utf8");
const watchlist = readFileSync("components/ui/watchlist-view.tsx", "utf8");
const sparkline = readFileSync("components/ui/sparkline.tsx", "utf8");
const confidence = readFileSync("components/ui/confidence.tsx", "utf8");

test("design foundation uses the six-color operational palette with safe migration aliases", () => {
  assert.match(tokens, /--field:\s*#0a1016/i);
  assert.match(tokens, /--surface:\s*#131d26/i);
  assert.match(tokens, /--text:\s*#e8eff2/i);
  assert.match(tokens, /--signal:\s*#4c90f0/i);
  assert.match(tokens, /--evidence:\s*#5cc6d2/i);
  assert.match(tokens, /--critical:\s*#e2745b/i);
  assert.match(tokens, /--rune:\s*var\(--signal\)/);
  assert.match(tokens, /--glass-bg:\s*var\(--surface\)/);
  assert.match(tokens, /--shadow-glow:\s*none/);
  assert.doesNotMatch(tokens, /#c9a961|#dfc376|#9a7f48/i);
});

test("motion remains compact, continuous, and removable", () => {
  assert.match(tokens, /--motion-micro:\s*120ms/);
  assert.match(tokens, /--motion-state:\s*180ms/);
  assert.match(tokens, /--motion-surface:\s*280ms/);
  assert.match(tokens, /--ease-primary:\s*cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/);
  assert.match(globals, /@keyframes odim-route-enter/);
  assert.match(globals, /translateY\(4px\)/);
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(globals, /scroll-behavior: auto !important/);
  assert.doesNotMatch(globals, /backdrop-filter|linear-gradient|glow-pulse/);
});

test("shared route sections prevent staggered card presentation and expose the Evidence Thread", () => {
  assert.match(screen, /odim-route/);
  assert.doesNotMatch(screen, /stagger/);
  assert.match(panel, /border-y bg-\[var\(--surface\)\]/);
  assert.doesNotMatch(panel, /boxShadow|shadow-|linear-gradient/);
  assert.match(evidenceThread, /<ol/);
  assert.match(evidenceThread, /data-state=\{state\}/);
  assert.match(evidenceThread, /verified/);
});

test("status and watch surfaces stay on semantic tokens without legacy effects", () => {
  assert.match(anomalyBadge, /var\(--warning\)/);
  assert.match(anomalyBadge, /var\(--critical\)/);
  assert.doesNotMatch(anomalyBadge, /#eab308|rgba\(220,38,38|rgba\(234,179,8/);
  assert.doesNotMatch(watchlist, /rgba\(|boxShadow|--ink-|--negative|transition-all/);
  assert.doesNotMatch(sparkline, /linearGradient|#22c55e|#dc2626|#6b7280/);
  assert.doesNotMatch(confidence, /--ink-/);
});

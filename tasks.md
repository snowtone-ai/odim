# tasks.md -- pm-zero v9.5 Execution Ledger

## Goal Binding
- Active goal: Odim v3.0 — First-Principles Product Overhaul
- Planning owner: Souma (Planner)
- Implementation owner: Sonnet (Claude Code)
- Review owner: Souma
- Scope: T031–T052 (full product overhaul). No scope deferral.

## Status Vocabulary
- proposed: idea exists, not ready
- ready: owner, dependencies, write scope, acceptance, verification, and expected evidence are clear
- doing: one owner is actively working
- blocked: needs decision, dependency, credential, environment, or human action
- review: implementation complete, review pending
- done: accepted by reviewer
- verified: evidence recorded

---

## Architecture Decision: Map Approach (3-Skeleton Comparison)

### Skeleton A: MapLibre Native Layers (GeoJSON Sources)
- Entity markers as `symbol` layer with per-substrate SDF icons (SVG → SDF at build time)
- Connection lines as `line` layer with GeoJSON LineString features from ontology links
- Clustering via MapLibre's built-in cluster source property
- Popups via MapLibre's native Popup class
- **Pros**: Best performance (fully GPU-rendered), smallest bundle, zero marker drift, proper zoom behavior, built-in clustering
- **Cons**: Less flexible than HTML for complex marker interiors; SDF icons limited to single-color tinting

### Skeleton B: MapLibre + deck.gl Overlay
- MapLibre for basemap; deck.gl ScatterplotLayer/IconLayer for entities, ArcLayer for connections
- GPU-accelerated animation, ideal for 10K+ entities
- **Pros**: Most visually striking arc animations, best for massive datasets, custom shaders
- **Cons**: +500KB bundle, overkill for <100 entities, deck.gl triangulation on main thread causes jank, complex React integration

### Skeleton C: MapLibre + Enhanced HTML Markers (Current Approach Extended)
- Keep DOM-based markers but redesign with substrate-specific SVG icons inside HTML wrappers
- Connection lines as a separate SVG/canvas overlay or GeoJSON line layer
- **Pros**: Maximum HTML/CSS flexibility for marker interiors, familiar pattern
- **Cons**: DOM rendering bottleneck at scale, marker drift risk if CSS fails to load, mixed DOM+WebGL for connections is fragile

### Decision: **Skeleton A — MapLibre Native Layers**
- **Why**: Odim's demo entity count is 10–50. Native symbol+line layers give correct geo-positioning (zero drift), GPU rendering, built-in clustering, and the smallest bundle. The "military software" aesthetic demands clean, crisp, performant rendering — not DOM manipulation. deck.gl's 500KB overhead and main-thread triangulation are unjustified for this scale. Research confirms MapLibre is 2x faster than deck.gl for tile rendering.
- **Icon strategy**: Build 7 substrate SVG icons at design time, convert to SDF images via `map.addImage()` with `sdf: true` for runtime color tinting. Each substrate type gets a distinct silhouette (bolt, coin, mountain, chip, droplet, gem, truck) recognizable at 16px.
- **Connection strategy**: GeoJSON LineString source with `line` layer; great-circle interpolation for long-distance connections; line color = source entity's substrate color; opacity/width driven by confidence.

---

## Phase 0: Pre-Flight (Uncommitted Map Fixes)

The following changes are already implemented but uncommitted from the previous session. They form the foundation for Phase 1.

| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| T031 | ready | Sonnet | none | (already modified) components/ui/reality-map.tsx, app/(dashboard)/map/page.tsx | Commit existing map fixes: CARTO Dark Matter tiles, top-level CSS import (drift fix), compact map page layout | pnpm typecheck; pnpm build | Build passes; changes committed |

---

## Phase 1: Map — Palantir Gotham Quality (Priority: P0)

Reference: Palantir Gotham uses geospatial mapping + network analysis + entity-centric common operating picture. Goal: Odim's map must let an analyst understand substrate distribution, entity connections, and confidence levels in one glance.

| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| T032 | ready | Sonnet | T031 | lib/map/types.ts, lib/map/entities.ts | Define MapEntity type with lat/lng/substrate/score/confidence/connections, export demo entities from fixture data with real coordinates, export connection edges from ontologyLinks | pnpm typecheck | Types compile; entities have valid coordinates and connections |
| T033 | ready | Sonnet | T032 | public/icons/substrate-*.svg, components/ui/reality-map.tsx | Create 7 substrate SVG icons (energy=bolt, cash=coin, land=mountain, compute=chip, water=droplet, raw_materials=gem, logistics=truck). Each icon: 24×24, single-path, SDF-compatible silhouette. Register via `map.addImage(key, img, {sdf:true})` for runtime color tinting | pnpm typecheck; pnpm build; visual check | 7 SVG files exist; map renders icons per substrate type with correct colors |
| T034 | ready | Sonnet | T033 | components/ui/reality-map.tsx | Replace HTML markers with MapLibre native `symbol` layer using GeoJSON source. Entity data as FeatureCollection. Icon = substrate SDF image, color = LAYER_COLORS[substrate]. Add `text-field` for entity name at zoom ≥ 5. Size scales with zoom via `interpolate` expression | pnpm typecheck; pnpm build; visual check | Markers render as native symbols, no DOM elements, proper geo-positioning at all zoom levels |
| T035 | ready | Sonnet | T034 | components/ui/reality-map.tsx | Add MapLibre clustering: GeoJSON source with `cluster: true, clusterMaxZoom: 8, clusterRadius: 50`. Cluster circle layer with `circle-radius` stepped by point_count. Cluster count label as symbol layer. Click cluster → zoom to expand. Uncluster transition animation | pnpm typecheck; pnpm build; visual check | Clusters appear at low zoom; click to expand; individual entities at high zoom |
| T036 | ready | Sonnet | T034 | components/ui/reality-map.tsx, lib/map/connections.ts | Add connection line layer: GeoJSON LineString source from ontology links. Line color = source entity substrate color. Line width = confidence × 3. Line opacity = 0.4–0.8 based on confidence. Dash array for low-confidence links. Great-circle interpolation for >1000km connections | pnpm typecheck; pnpm build; visual check | Connection lines visible between related entities; width/opacity reflect confidence |
| T037 | ready | Sonnet | T036 | components/ui/reality-map.tsx | Entity interaction: (a) hover → highlight entity + connected lines + tooltip with name/score/confidence/substrate; (b) click → select entity, dim unrelated entities, highlight connected entities and lines, show detail in sidebar; (c) `mouseenter`/`mouseleave` cursor change. Use `queryRenderedFeatures` for hit testing | pnpm typecheck; pnpm build; visual check | Hover shows tooltip; click selects and highlights network; deselect on map click |
| T038 | ready | Sonnet | T037 | app/(dashboard)/map/page.tsx, components/ui/reality-map.tsx | Map sidebar redesign: (a) Selected entity detail panel (name, score, confidence, substrate, connected entities list); (b) Layer toggles stay; (c) Live signal feed stays but compact (3 items); (d) Sidebar collapses to icon-only on smaller viewports. Total sidebar width: 300px | pnpm typecheck; pnpm build; visual check | Sidebar shows entity detail when selected; layer toggles work; live feed visible |
| T039 | ready | Sonnet | T038 | components/ui/reality-map.tsx, app/(dashboard)/map/page.tsx | Map search bar: floating search input (top-left, glass background) that filters entities by name. Type-ahead dropdown showing matching entities. Select → fly to entity + select it. Empty state = "Search entities…" placeholder. Cmd+F or / to focus | pnpm typecheck; pnpm build; visual check | Search bar filters entities; select flies to location; keyboard shortcut works |
| T040 | ready | Sonnet | T039 | components/ui/reality-map.tsx, styles/tokens.css | Map visual polish: (a) Subtle grid overlay at zoom < 3 (CSS-based, not tile); (b) Confidence ring around each entity icon (circle layer behind symbol, radius = score/10); (c) Animated pulse on high-priority entities (score > 75); (d) Selected entity glow effect; (e) Connection line animated dash for "active" links; (f) Smooth flyTo transitions with bearing/pitch tilt | pnpm typecheck; pnpm build; visual check | Visual effects render correctly; animations are smooth; no performance degradation |

---

## Phase 2: Navigation Consolidation — 8 Screens → 5 (Priority: P0)

Rationale: Capital Flow, Watchlist, and Audit are either thin wrappers or belong inside other screens. Consolidation removes navigation overhead and creates focused workstations.

**Target navigation**: Map · Entities · Alerts · Huginn · Settings

| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| T041 | ready | Sonnet | T031 | components/ui/shell.tsx, lib/i18n/messages.ts | Update Shell nav from 7 items to 5: remove Capital Flow, Watchlist, Audit from nav array. Update i18n nav keys. Keep icon choices: Globe (Map), Building2 (Entities), Bell (Alerts), Bird (Huginn), Settings (Settings). Mobile top bar follows same 5-item structure | pnpm typecheck; pnpm build | Shell renders 5 nav items; mobile bar shows 5 icons |
| T042 | ready | Sonnet | T041 | components/ui/screen.tsx, app/(dashboard)/*/page.tsx, lib/i18n/messages.ts | Remove Screen eyebrow numbers ("画面 01" etc.) from all pages. Remove `eyebrow` prop from Screen component. Screen component becomes: title + optional live badge. Update all page.tsx that use Screen to remove eyebrow. Map page already uses custom header (no Screen wrapper) | pnpm typecheck; pnpm build | No "Screen XX" text visible anywhere; Screen component has no eyebrow prop |
| T043 | ready | Sonnet | T042 | app/(dashboard)/entity/page.tsx, lib/i18n/messages.ts, lib/data.ts | Merge Capital Flow content into Entity Intelligence page: (a) Add "Sector Heat" summary cards (7 substrate counts) as a compact row above entity list; (b) Add "Narrative–Reality Gap" as a column in the entity detail area; (c) Remove redundant "Entity Flow" (Sankey) — it duplicates ontology links. Entity page becomes the primary analytical workstation | pnpm typecheck; pnpm build; visual check | Entity page shows sector heat + gap data; no separate Capital Flow page needed |
| T044 | ready | Sonnet | T043 | app/(dashboard)/entity/page.tsx, components/ui/watchlist-view.tsx, lib/i18n/messages.ts | Merge Watchlist into Entity page: (a) Add star/favorite toggle to entity list items (already exists as FavoriteButton); (b) Add "Watched" filter tab above entity list (All / Watched); (c) Move Daily Brief into entity detail panel as a collapsible section; (d) Watchlist presets (sectors/regions) become filter chips on entity list | pnpm typecheck; pnpm build; visual check | Entity page has favorite toggle, watched filter, brief section |
| T045 | ready | Sonnet | T044 | app/(dashboard)/settings/page.tsx, lib/i18n/messages.ts | Merge Audit Trail into Settings page: Settings already has a truncated audit log panel. Expand it to show full audit events with pagination/scroll. Remove standalone Audit page route. Audit panel in Settings shows: event, actor, source, confidence, detail (expandable) | pnpm typecheck; pnpm build; visual check | Settings shows full audit log; /audit route removed |
| T046 | ready | Sonnet | T045 | app/(dashboard)/capital-flow/, app/(dashboard)/watchlist/, app/(dashboard)/audit/, lib/i18n/messages.ts | Delete standalone pages: `capital-flow/page.tsx`, `watchlist/page.tsx`, `audit/page.tsx`. Clean up i18n messages: remove `screens.capitalFlow`, `screens.watchlist`, `screens.audit` top-level keys (content migrated to entity/settings). Remove unused imports in lib/data.ts if any | pnpm typecheck; pnpm build; pnpm test | No orphan routes; build succeeds; tests pass |

---

## Phase 3: Huginn Enhancement (Priority: P1)

| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| T047 | ready | Sonnet | T041 | app/(dashboard)/huginn/page.tsx, components/ui/huginn-input.tsx, lib/i18n/messages.ts | Add interactive query input: (a) Create HuginnInput client component with text input + submit button; (b) On submit, POST to /api/huginn with orgId and question; (c) Display response in existing dialogue format; (d) Keep current server-rendered default query as initial state; (e) Loading state with animated "Thinking…" indicator; (f) Input placeholder: "Ask Huginn…" | pnpm typecheck; pnpm build; visual check | User can type and submit questions; response renders with sources and trace |
| T048 | ready | Sonnet | T047 | app/(dashboard)/huginn/page.tsx, lib/huginn/grader.ts, lib/i18n/messages.ts | Sycophancy: internal suppression only. (a) Remove sycophancy badge/warning from Huginn UI entirely; (b) Keep grader's `sycophancy_suspected` flag detection and `writeSycophancyAuditEvent` in backend — these continue to fire silently; (c) Remove `badges.sycophancy` i18n key; (d) If sycophancy detected, grader re-invokes answer generation with anti-sycophancy system prompt injection (add `suppressSycophancy` option to `answerHuginnQuestion`) | pnpm typecheck; pnpm test; pnpm build | No sycophancy UI visible; audit events still fire; anti-sycophancy prompt injected when flag detected |
| T049 | ready | Sonnet | T048 | app/(dashboard)/huginn/page.tsx, lib/i18n/messages.ts | Simplify Munin display: (a) Remove raw fact/procedure/seed/opinion count grid — internal implementation detail; (b) Keep only: confidence bar + "N memory records" label; (c) Remove biasTest i18n keys from UI (internal-only); (d) Keep Sources panel and Reasoning Trace panel | pnpm typecheck; pnpm build; visual check | No Munin count grid visible; confidence bar present; sources visible |

---

## Phase 4: Cross-Cutting Improvements (Priority: P1)

| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| T050 | ready | Sonnet | T046 | components/ui/command-palette.tsx, components/ui/shell.tsx, lib/i18n/messages.ts | Global search (Cmd+K): (a) Create CommandPalette client component: modal overlay with search input; (b) Search across entities, alerts, settings sections; (c) Arrow keys to navigate, Enter to select, Esc to close; (d) Results grouped by type (Entity, Alert, Setting); (e) Select → navigate to relevant page with entity/item focused; (f) Register Cmd+K / Ctrl+K listener in Shell | pnpm typecheck; pnpm build; visual check | Cmd+K opens palette; search returns results; selection navigates correctly |
| T051 | ready | Sonnet | T046 | app/(dashboard)/entity/page.tsx, app/(dashboard)/alerts/page.tsx, app/(dashboard)/huginn/page.tsx, components/ui/entity-link.tsx | Cross-screen entity linking: (a) Create EntityLink component (styled span, hover underline, click → navigate to /entity?id=X); (b) Replace plain entity name text in alerts page, Huginn sources, map popups with EntityLink; (c) Entity page reads `?id=` query param to auto-select entity | pnpm typecheck; pnpm build; visual check | Clicking entity name in alerts/huginn/map navigates to entity page with that entity selected |
| T052 | ready | Sonnet | T046 | lib/i18n/messages.ts | i18n message overhaul for all changes: (a) Add new keys for merged screens, command palette, entity link tooltips, map search, Huginn input; (b) Remove deleted screen keys (capitalFlow, watchlist, audit at top level); (c) Audit all user-facing strings for precision: no vague labels, every word carries information; (d) Both en and ja locales updated in lockstep | pnpm typecheck; pnpm build | All i18n keys compile; no missing key runtime errors; ja/en parity |
| T053 | ready | Sonnet | T052 | app/(dashboard)/*/page.tsx, components/ui/screen.tsx, lib/i18n/messages.ts | Text-level corrections: (a) Screen component: remove "Live · Source-backed" badge — redundant after Gotham-quality map; (b) Entity page: "Committed" metric → show actual amount not fallback "Source-backed" text; (c) Alerts: "Signal Chain" steps — make dynamic from actual alert evidence, not static i18n array; (d) Settings: remove verbose copy paragraphs under each panel — panel content speaks for itself | pnpm typecheck; pnpm build; visual check | No redundant badges; metric values are real; no placeholder copy |

---

## Phase 5: Verification & Cleanup (Priority: P0)

| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| T054 | ready | Sonnet | T053 | docs/repo-map.md, docs/state.md | Update docs: (a) repo-map.md: update Architecture Overview to reflect 5 screens, new map components, command palette; (b) state.md: update current state to v3.0 overhaul; (c) Remove references to deleted pages | pnpm verify | Docs match actual codebase structure |
| T055 | ready | Sonnet | T054 | all modified files | Full verification: `pnpm typecheck && pnpm test && pnpm build`. Fix any failures. Run `pnpm lint` if available. Confirm no orphan imports, no dead i18n keys, no type errors | pnpm typecheck; pnpm test; pnpm build | All checks green |

---

## Execution Order & Parallelization

```
Phase 0: T031 (commit existing fixes)
  ↓
Phase 1: T032 → T033 → T034 → T035 → T036 → T037 → T038 → T039 → T040
  ↓ (T041 can start after T031, parallel with late Phase 1)
Phase 2: T041 → T042 → T043 → T044 → T045 → T046
  ↓
Phase 3: T047 → T048 → T049 (depends on T041 for nav)
Phase 4: T050 ∥ T051 ∥ T052 → T053 (T050/T051/T052 are parallelizable)
  ↓
Phase 5: T054 → T055
```

**Parallelization opportunities**:
- Phase 1 (map) and Phase 2 (nav consolidation) share only shell.tsx and i18n. T041 can start after T031, but T043–T046 should wait until Phase 1 map is stable to avoid merge conflicts in page.tsx files.
- T050 (command palette), T051 (entity links), T052 (i18n) are independent of each other.

**Write scope conflicts**: Map work (Phase 1) and entity page merges (T043–T044) both touch page components but different files. Safe to parallelize with disjoint scopes.

---

## Historical Tasks (v1.0–v2.0)

<details>
<summary>T001–T030: Scaffold, Pipeline, Auth, i18n, Huginn/Munin v2 (all verified)</summary>

| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| T001 | verified | Codex | none | AGENTS.md, CLAUDE.md, HANDOFF-JA.md, docs/**, tasks.md, scripts/**, .env.example, .gitignore | pm-zero v9.5 project memory exists and responsibilities are separated | pnpm verify | scripts/verify.mjs passes structural checks |
| T002 | verified | Codex | T001 | app/**, components/**, styles/**, lib/**, config/**, scrapers/**, supabase/**, .github/** | Odim skeleton contains 8 routes, design tokens, ontology schema, AI/provider abstraction, pipeline/resolver foundations, and mock API data | pnpm verify | scripts/verify.mjs passes structural checks |
| T003 | verified | Codex | T002 | package lock and installed dependencies | Install dependencies and run typecheck/build in the target environment | pnpm install; pnpm typecheck; pnpm build | pnpm install completed; pnpm typecheck passed; pnpm build passed |
| T004 | verified | Codex | T003 | lib/pipeline/**, scrapers/**, supabase/**, config/**, .github/**, tests/** | Replace demo ingestion with first real FERC/SEC/building-permit sources while preserving idempotency and audit logs | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T004 evidence; dry-run emits source-backed ingestion plan |
| T005 | verified | Codex | T004 | scrapers/**, lib/pipeline/**, config/**, tests/**, supabase/** | Add remaining Reality Layer adapters and narrative trigger ingestion without treating narrative as truth | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T005 evidence; all 7 Reality Layers plus narrative trigger covered |
| T006 | verified | Codex | T005 | lib/pipeline/alert.ts, lib/pipeline/**, supabase/**, tests/** | Generate source-backed alerts with confidence/evidence and alert_created audit events while keeping narrative as trigger only | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T006 evidence; narrative test proves no ontology promotion |
| T007 | verified | Codex | T006 | app/api/**, lib/data.ts, lib/repositories/**, lib/supabase/**, tests/** | Replace static mock API responses with repository-backed data reads and deterministic source-backed fallback | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T007 evidence; repository fallback tests pass |
| T008 | verified | Codex | T007 | app/api/huginn/**, lib/huginn/**, lib/munin/**, lib/ai/**, tests/**, supabase/** | Implement org-scoped Huginn/Munin v1 query flow with scoped memory retrieval, sources, confidence, and reasoning trace | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T008 evidence; org leakage test excludes other-org memory |
| T009 | verified | Codex | T008 | app/api/**, lib/repositories/**, lib/supabase/**, tests/**, supabase/** | Add org-aware API filtering so service-role reads cannot leak tenant data | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T009 evidence; public-or-org filters tested |
| T010 | verified | Codex | T009 | app/**, components/**, lib/i18n/**, tests/**, .env.example | Add Japanese/English i18n foundation | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T010 evidence; i18n tests pass |
| T011 | verified | Codex | T010 | components/ui/shell.tsx, components/ui/screen.tsx, app/(dashboard)/alerts/page.tsx, app/globals.css, tests/** | Make shell and Signal Alerts usable on mobile | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T011 evidence; mobile layout tests pass |
| T012 | verified | Codex | T011 | scripts/**, package.json, tests/**, tasks.md | Add release audit gate for Phase F requirements | pnpm release:audit; pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T012 evidence; release audit gate exists |
| T013 | verified | Codex | T012 | app/(dashboard)/**, components/**, lib/data.ts, lib/repositories/**, tests/** | Replace remaining placeholder dashboard panels with source-backed product surfaces | pnpm test; pnpm typecheck; pnpm verify; pnpm release:audit; pnpm scrape:dry-run; pnpm build; browser smoke | Verified in T013 evidence; no-placeholder tests pass |
| T014 | verified | Codex | T013 | app/api/**, app/(dashboard)/settings/page.tsx, lib/auth/**, lib/repositories/**, supabase/**, tests/** | Add commercial auth/org management surfaces and API key primitives | pnpm test; pnpm typecheck; pnpm verify; pnpm release:audit; pnpm scrape:dry-run; pnpm build | Verified in T014 evidence; auth/API key tests pass |
| T015 | verified | Codex | T014 | docs/**, scripts/**, app/**, lib/**, supabase/**, .env.example, tests/** | Perform Phase F commercial-readiness audit and close locally solvable gaps | pnpm test; pnpm typecheck; pnpm verify; pnpm release:audit; pnpm scrape:dry-run; pnpm build; browser smoke | Verified in T015 evidence; commercial-readiness matrix exists |
| T016 | verified | Codex | T015 | supabase/**, lib/api/**, lib/auth/**, lib/ai/**, lib/repositories/**, lib/pipeline/**, scrapers/**, config/**, scripts/**, tests/**, docs/**, .env.example, styles/**, components/**, app/(dashboard)/map/page.tsx | Remediate pre-release review findings | pnpm test; pnpm typecheck; pnpm release:audit; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T016 evidence |
| T017–T030 | verified | Codex | T016 | (see v2.0 scope) | Huginn/Munin v2.0 full implementation | pnpm test; pnpm typecheck; pnpm release:audit; pnpm verify; pnpm build | 49/49 tests pass; release:audit 94 checks pass |

</details>

<details>
<summary>R001–R009: Review Remediation (all verified)</summary>

| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| R001 | verified | Codex | T029 | lib/huginn/precompute.ts, lib/huginn/cascade.ts, lib/munin/dream.ts, scripts/release-audit.mjs | Sleep-time Compute persistence | pnpm test; pnpm typecheck; pnpm release:audit | precompute persistence audit passes |
| R002 | verified | Codex | T020 | app/(dashboard)/settings/page.tsx, components/ui/seed-memory-manager.tsx, lib/munin/seed.ts, lib/i18n/messages.ts | Seed Memory CRUD UI | pnpm test; pnpm typecheck; pnpm release:audit | seed CRUD tests pass |
| R003 | verified | Codex | T025 | app/(dashboard)/huginn/page.tsx, components/ui/eval-button.tsx, lib/i18n/messages.ts | Huginn Console runtime rendering | pnpm typecheck; pnpm release:audit | audit passes |
| R004 | verified | Codex | T026 | lib/huginn/gapfill.ts, lib/huginn/narrative-capture.ts, scripts/release-audit.mjs | Gapfill/narrative persistence | pnpm test; pnpm typecheck; pnpm release:audit | audit passes |
| R005 | verified | Codex | T030 | lib/huginn/bias-test.ts, scripts/release-audit.mjs | Bias test pipeline integration | pnpm test; pnpm release:audit | bias tests pass |
| R006 | verified | Codex | T027 | lib/munin/dream.ts, lib/munin/dream-phases.ts | Dream idempotency | pnpm test; pnpm typecheck | dream tests pass |
| R007 | verified | Codex | T017 | supabase/tests/**, scripts/** | Staging smoke + migration scripts | pnpm verify; pnpm release:audit | audit passes |
| R008 | verified | Codex | T029 | lib/ai/rate-limit.ts, lib/ai/provider.ts, supabase/migrations/0004_*.sql, .env.example | Shared AI rate limiting | pnpm test; pnpm typecheck; pnpm release:audit | audit passes |
| R009 | verified | Codex | R007 | staging/production Supabase | Apply migrations + live RLS smoke | psql + staging smoke SQL | 0002/0003 applied; cross-org counts = 0 |

</details>

---

## Blockers
| ID | Task | Blocker | Needed decision | Owner |
|---|---|---|---|---|
| B004 | browser smoke | Dev server background start fails in sandbox with Node/Windows `spawn EINVAL` | Run dev server in normal terminal or rely on `pnpm build` | Human |

## Review Notes
| Task | Reviewer | Result | Follow-up |
|---|---|---|---|
| T001-T030 | Codex | pass | Historical; see git history |
| R001-R009 | Codex | pass | Historical; see git history |

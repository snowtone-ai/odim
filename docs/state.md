# state.md

## Current
- Branch: main
- Active task: long-term operational hardening toward fully usable no-paid-API product
- Current executor: Codex CEO Agent
- Write lock: none
- Coordinator: CEO Agent
- Latest verification pointer: operational ingestion hardening verified (55/55 tests pass, typecheck clean, pnpm verify success, pnpm build success)
- Verification mode: standard

## Completed after v3.0

### Operational ingestion hardening
- Daily scrape workflow now runs a dry-run smoke and then `pnpm scrape` with Supabase write env, instead of cron-only dry-run.
- Added `scrape:backfill` mode, `SCRAPE_MODE`, `SCRAPE_BACKFILL_LIMIT`, `SCRAPE_MIN_SIGNALS`, and source-failure controls.
- `scrapers/run.ts` now emits source-level reports, fails on too-few signals, supports daily/backfill/dry-run modes, records ingestion runs, and updates source watermarks when writing.
- Backfill now supports `SCRAPE_SOURCE_IDS`, `SCRAPE_BACKFILL_START`, `SCRAPE_BACKFILL_END`, `SCRAPE_PAGE_SIZE`, and `SCRAPE_MAX_PAGES`.
- EIA, PatentsView, and configured JSON/CSV sources support paged backfill requests; configured feeds can use `{limit}`, `{offset}`, and `{page}` URL placeholders.
- Added `supabase/migrations/0005_ingestion_operations.sql` with `ingestion_runs` and `source_watermarks`.
- Default migration runner now applies 0001–0005, including AI rate limits and ingestion operations.
- Pipeline DB upserts now use durable conflict keys: raw signals by fingerprint, alerts/audit by dedupe key, ontology by id.
- Production repository/admin reads and writes now fail closed when Supabase env is missing instead of returning fallback data.
- Daily Munin Dream workflow now uses Node 24 and `pnpm dream:daily` with `DEFAULT_ORG_ID` instead of inline TypeScript import and paid-source org naming.

## Completed in v3.0 (T031–T055)

### Phase 0: Pre-flight
- T031: Committed existing map fixes (CARTO Dark Matter, CSS import, compact layout)

### Phase 1: Map — Palantir Gotham quality
- T032–T040: Full MapLibre native layer rewrite
  - Symbol layer with SDF substrate icons (bolt/coin/mountain/chip/droplet/gem/truck)
  - Native clustering (clusterMaxZoom 8, radius 50)
  - Connection lines from ontology links (confidence-proportional width/opacity)
  - Entity interaction: hover popup, click select + network highlight, flyTo
  - Map search bar (float top-left, `/` or Cmd+F to focus)
  - Confidence rings (circle layer), animated pulse (score>75), selected glow

### Phase 2: Navigation 8 → 5 screens
- T041: Shell nav reduced to Map / Entities / Alerts / Huginn / Settings
- T042: Screen eyebrow numbers removed from all pages
- T043: Capital Flow sector heat + narrative-reality gap merged into Entity page
- T044: Watchlist (Watched filter, Daily Brief) merged into Entity page
- T045: Audit Trail expanded to full log in Settings (was truncated)
- T046: Deleted capital-flow, watchlist, audit standalone pages

### Phase 3: Huginn enhancements
- T047: HuginnInput + HuginnConsole client components — interactive query
- T048: Sycophancy badge removed from UI; backend detection + auto-retry with anti-sycophancy prompt continues silently
- T049: Munin count grid removed; shows only confidence bar + total record count

### Phase 4: Cross-cutting
- T050: CommandPalette (Cmd+K) — search entities, alerts, settings
- T051: EntityLink component — navigation to /entity?id=X
- T052: i18n messages.ts overhaul — nav keys, entity keys, huginn input keys, removed defunct screens
- T053: Text corrections — settings verbose copy removed, alert chain dynamic from evidence, map eyebrow removed

### Phase 5: Verification
- T054: docs/state.md + docs/repo-map.md updated
- T055: pnpm typecheck ✓ | pnpm test 49/49 ✓ | pnpm build ✓

## Architecture

### Navigation (5 screens)
- /map — Reality Map (Palantir Gotham quality, MapLibre native layers)
- /entity — Entity Intelligence (merged Capital Flow + Watchlist)
- /alerts — Signal Alerts
- /huginn — Huginn (interactive query + simplified Munin)
- /settings — Settings (includes full Audit Trail)

### Key components (v3.0)
- `components/ui/reality-map.tsx` — MapLibre native symbol+line layers, clustering, connections
- `components/ui/entity-workstation.tsx` — Client component: filter tabs, entity select, sector heat, gap, brief
- `components/ui/huginn-console.tsx` — Client component: interactive query, trace, sources, eval
- `components/ui/huginn-input.tsx` — Query input with loading state
- `components/ui/command-palette.tsx` — Cmd+K global search
- `components/ui/entity-link.tsx` — Cross-screen entity navigation
- `lib/map/types.ts`, `lib/map/entities.ts`, `lib/map/connections.ts` — Map data layer

### API routes (unchanged)
- POST /api/huginn — answerHuginnQuestion with sycophancy auto-retry

## Current Blocker
- Dev server background launch still fails in sandbox (Node/Windows spawn EINVAL); pnpm build is verified fallback.
- Supabase: single-environment (main/production-tagged); staging URL may match production until dedicated project created.

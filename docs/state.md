# state.md

## Current
- Branch: feat/lp-006-008-public-surfaces (LP-005 merged to main via PR #7)
- Active task: LP-006/007/008 public surfaces (API docs, legal pages, SEO/meta) — implemented, reviewed, recommendations applied
- Current executor: main agent
- Write lock: none
- Coordinator: main agent
- Latest verification pointer: LP-006/007/008 — public `/docs` (renders `docs/api-reference.md` via trusted markdown parser, no raw HTML), `/terms` `/privacy` `/security` legal pages with shared `PublicShell`, landing footer links, OG/twitter metadata + title template in root layout, `sitemap.xml` (public routes only), `robots.txt` (disallows `/api/`, dashboard prefixes, `/invite`), per-page titles on 13 pages; launch-surfaces tests extended; typecheck/lint/build/verify green
- Verification mode: Tier 1 class (300+ line diff) — fresh-context Sonnet review PASS-with-recommendations, all applied (see tasks.md LP-006/007/008 Review Notes)
- Human gates outstanding: none.
- Legal pages (`/terms`, `/privacy`, `/security`): substantive content complete (Japan/Tokyo governing law, APPI/GDPR, processor list, support-channel contact). Formal legal review deferred — practice product.
- Supabase: project `xyvioekqwmbgrwlinzxe` restored by operator; migrations 0001–0013 applied 2026-07-06.

## Completed after v3.0

### AI Native Upgrade 1+2
- Added Evidence GraphRAG primitives and repository loading for source-backed entity/signal/alert/audit/source paths.
- Huginn cascade now has an `evidence_graph` layer and passes graph paths into model context and the UI trace.
- Entity Intelligence surfaces top evidence paths, citation coverage, and trace completeness for selected entities.
- Added Agentic Watchtower playbooks, run generation, approval/reject/rerun state transitions, dashboard APIs, Alerts/Settings UI, and Supabase migration `0010_ai_native_workflows.sql`.
- Review hardening added Evidence GraphRAG TTL caching, bounded BFS fanout, false-positive edge suppression, entity-scoped metrics, Watchtower approval optimistic revision locking, local write serialization, sanitized Watchtower API errors, auth-disabled org override gates, API smoke coverage, and append-only migration `0011_watchtower_hardening.sql` for Watchtower RLS/index/updated_at hardening.
- Verification: `rtk pnpm test` (100/100), `rtk pnpm typecheck`, `rtk pnpm lint`, `rtk pnpm build`, `rtk pnpm verify`, and `rtk pnpm browser:smoke` passed. Manual Chrome check confirmed Watchtower appears in `/alerts` and `/settings`; browser smoke confirmed `/`, `/map`, `/entity`, `/alerts`, `/huginn`, `/settings`, `/api/watchtower/runs`, `/api/graphrag/query`, `/api/watchtower/approvals`, and `/api/watchtower/rerun`.

### Release-critical refactoring and review
- RC-001窶鼎C-031 are implemented as focused commits across security headers, CI, env validation, auth scope controls, prompt safety, AI/scraper timeouts, transactional ingestion, route rate limits, frontend resilience, RLS smoke coverage, parser coverage, and bias tests.
- Added `middleware.ts`, `.github/workflows/ci.yml`, `lib/env/validate.ts`, `lib/api/rate-limit.ts`, `supabase/migrations/0006_ingest_transaction.sql`, `supabase/migrations/0007_performance_indexes.sql`, route-level Huginn tests, and expanded parser/bias/RLS smoke tests.
- Default migration runner now applies 0001窶・007, including transactional ingestion and performance indexes.
- `AGENTS.md` now records release-critical coding rules for future repository work.
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (78/78), `pnpm build`, and `pnpm release:audit` (91 checks) passed.

### Operational ingestion hardening
- Daily scrape workflow now runs a dry-run smoke and then `pnpm scrape` with Supabase write env, instead of cron-only dry-run.
- Added `scrape:backfill` mode, `SCRAPE_MODE`, `SCRAPE_BACKFILL_LIMIT`, `SCRAPE_MIN_SIGNALS`, and source-failure controls.
- `scrapers/run.ts` now emits source-level reports, fails on too-few signals, supports daily/backfill/dry-run modes, records ingestion runs, and updates source watermarks when writing.
- Backfill now supports `SCRAPE_SOURCE_IDS`, `SCRAPE_BACKFILL_START`, `SCRAPE_BACKFILL_END`, `SCRAPE_PAGE_SIZE`, and `SCRAPE_MAX_PAGES`.
- EIA, PatentsView, and configured JSON/CSV sources support paged backfill requests; configured feeds can use `{limit}`, `{offset}`, and `{page}` URL placeholders.
- FERC, building permits, cloud regions, water districts, USGS minerals, port statistics, narrative, state PUC, and FAA feed adapters now accept the same page/offset/limit URL controls for backfill.
- SEC EDGAR backfill now follows `filings.files` historical submission files instead of only reading `filings.recent`; daily mode remains recent-only.
- Settings now surfaces recent ingestion runs and source watermarks so daily/backfill operations are visible without querying Supabase directly.
- Added `supabase/migrations/0005_ingestion_operations.sql` with `ingestion_runs` and `source_watermarks`.
- Default migration runner now applies 0001–0005, including AI rate limits and ingestion operations.
- Pipeline DB upserts now use durable conflict keys: raw signals by fingerprint, alerts/audit by dedupe key, ontology by id.
- Production repository/admin reads and writes now fail closed when Supabase env is missing instead of returning fallback data.
- Daily Munin Dream workflow now uses Node 24 and `pnpm dream:daily` with `DEFAULT_ORG_ID` instead of inline TypeScript import and paid-source org naming.
- App/default operational scripts use `DEFAULT_ORG_ID` for default org context; `PAID_SOURCE_ORG_ID` remains limited to configured proprietary source templates.
- `tasks.md` and `docs/commercial-readiness.md` now record the operational hardening evidence instead of stale v2/v3 verification snapshots.

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
- No active implementation blocker.
- Supabase: single-environment (main/production-tagged); staging URL may match production until dedicated project created.

## Completed after v3.0

### Phase 7: Data Foundation
- Added SEC expansion scrapers for Form 4, 8-K, 13D/G, and 13F dry-run coverage.
- Added new public-source adapters for FRED, Federal Register, EDINET, Companies House, and USAspending.
- Enabled Phase 7 configured sources and expanded daily scrape workflow/environment coverage.
- Ingestion now computes entity scores via `lib/pipeline/scoring.ts`, records freshness SLA checks, and exposes dry-run source reports for all fixture-backed sources.
- Added Morning Brief daily diff panel, CSV/JSON export API/button, global keyboard nav shell hook, and persisted saved-search bars for Huginn and Entity views.
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (84/84), `pnpm build`, `pnpm scrape:dry-run`.

### Phase 8: Intelligence & Differentiation
- Added calibration, attribution, anomaly detection, sentiment divergence, and sector rotation pipeline modules.
- Entity workstation now supports compare mode, keyboard-synced selection, anomaly badges, divergence surfacing, and sector rotation summaries.
- Reality Map now includes geographic drill-down overlays; Settings adds calibration / attribution visibility and audit export controls.
- Added browser notification prompt + polling-backed push queue route, and enabled CAISO/SPP queue coverage in source config/workflow/env docs.
- Hardened SEC residual-risk area by expanding Form 4 / 13F / 13D-G parser tolerance for nested XML and text variants.
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (90/90), `pnpm build`, `pnpm scrape:dry-run`.

### Phase 9: Institutional Grade
- Added versioned REST API routes under `app/api/v1/` with scoped-key auth, pagination, and per-endpoint rate limiting.
- Added SSO session plumbing (`lib/auth/sso.ts`, `app/api/auth/callback/route.ts`, `middleware.ts`) and a minimal enterprise login handoff screen.
- Added custom dashboard builder persistence and `/custom` route, multi-provider Huginn ensemble support, and deterministic backtesting CLI/reporting.
- Expanded source coverage with OpenSanctions, FEMA, SAM.gov, and NRC scrapers and wired them into dry-run/live scrape flow.
- Reworked browser notifications to persistent Web Push subscription delivery and moved geographic drill-down onto dedicated MapLibre aggregation layers by zoom band.
- Added runtime environment separation for local/staging/production Supabase selection plus migration `0009_push_subscriptions.sql`.
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (94/94), `pnpm build`, `pnpm scrape:dry-run`.

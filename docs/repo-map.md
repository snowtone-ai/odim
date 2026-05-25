# repo-map.md -- pm-zero v9.5 Repository Map

## Read Policy
- Session start: read Summary only.
- Before editing: read the section for the target area when target files are unclear.
- When navigation is unclear: read Entry Points and Directory Map.
- After structural changes: update only the affected section.

## Summary
- App type: Next.js 16 App Router web application for Odim Reality Intelligence OS.
- Main runtime: Node.js 20.9+ target, React 19.2, TypeScript strict mode.
- Package manager: pnpm.
- Primary source directory: app/, components/, lib/.
- Primary test directory: tests/; scripts/verify.mjs is current structural gate.
- Main entry points: app/layout.tsx, app/(dashboard)/*/page.tsx, app/api/*/route.ts.
- Verification command: pnpm verify.
- Huginn/Munin canonical spec: context/source-05-huginn-munin.md (v2.0 active).

## Directory Map
| Path | Purpose | Edit Frequency | Notes |
|---|---|---|---|
| app/ | Routes, layout, API handlers | high | 8 dashboard screens and route handlers. |
| app/(dashboard)/ | Dashboard pages: map, capital-flow, entity, alerts, huginn, watchlist, audit, settings | high | Each page.tsx is a full screen. |
| app/api/ | API routes: alerts, entities, signals, audit, settings, api-keys, huginn, seed-memory | high | Org-scoped, auth-gated. |
| components/ui/ | Reusable UI: panel, screen, confidence, shell | high | Follow styles/tokens.css and context/source-07-design.md. |
| lib/ai/ | AI provider abstraction and rate limiting | high | provider.ts (mock/Gemini answer, self-assessment, grader), rate-limit.ts (org-model-scoped RPM/RPD/TPM with optional Supabase shared backend). |
| lib/auth/ | API key management and request authorization | high | api-keys.ts (HMAC-SHA256), request.ts (env-gated scoped auth). |
| lib/api/ | Org context parsing and tenant isolation helpers | medium | org.ts (public-or-org filters). |
| lib/huginn/ | Huginn query orchestration | high | query.ts plus cascade, self-assessment, gapfill, narrative capture/RDS, eval log, grader, sleep-time precompute, bias tests. |
| lib/munin/ | Munin memory system | high | memory.ts, types.ts, write-gate.ts, seed.ts, dream.ts, dream-phases.ts. |
| lib/ontology/ | Core ontology type definitions | medium | types.ts (6 object types, link types). |
| lib/pipeline/ | Signal ingestion pipeline | medium | normalize → ontologize → alert → audit → ingest. |
| lib/resolvers/ | SPVResolver, RDS, Triangulation | medium | spv-resolver.ts, rds.ts, triangulation.ts. |
| lib/repositories/ | Data access layer with fallback | medium | reality.ts (alerts/signals/entities/audit), admin.ts (settings/keys). |
| lib/i18n/ | Internationalization | medium | messages.ts (en/ja typed catalog). |
| lib/env/ | Runtime environment detection | low | runtime.ts. |
| lib/supabase/ | Supabase client factories | low | client.ts (browser/service-role). |
| lib/data.ts | Fixture data from ingestion pipeline | medium | Source-backed deterministic fallback. |
| supabase/ | Database migrations, RLS, seed, tests | medium | 0001_initial.sql, 0002_huginn_munin_v2.sql, 0003_sleep_time_compute.sql, 0004_ai_rate_limit_usage.sql, RLS smoke tests, service-role grants. |
| scrapers/ | Public data collection scripts | medium | 8 adapters (FERC, SEC, permits, cloud, water, minerals, ports, narrative). |
| tests/ | Node test suite | medium | Pipeline, auth, i18n, security, Huginn/Munin v2, bias tests, mobile, release audit. |
| config/ | Replaceable source definitions | medium | sources.json (paid sources added by config). |
| scripts/ | Setup, verification, release automation | medium | setup.mjs, verify.mjs, release-audit.mjs, issue-bootstrap-api-key.mjs, run-staging-rls-smoke.mjs. |
| styles/ | Design system tokens | low | tokens.css (CSS custom properties). |
| docs/ | pm-zero project memory | medium | vision, state, decisions, repo-map, issues, commercial-readiness. |
| context/ | Canonical product source material (11 files) | low | source-00 through source-10; inputs, not implementation output. |
| .github/workflows/ | CI/CD | low | daily-scrape.yml, daily-dream.yml, and manual staging-rls-smoke.yml. |

## Entry Points
| Area | File | Purpose |
|---|---|---|
| App shell | app/layout.tsx | Global metadata, fonts (IBM Plex Sans/Mono, Spectral), Shell wrapper. |
| Dashboard home | app/page.tsx | Redirects to /map. |
| Reality Map | app/(dashboard)/map/page.tsx | 3D globe + layer activity + signal feed. |
| Capital Flow | app/(dashboard)/capital-flow/page.tsx | Sector heatmap + Sankey + RDS. |
| Entity Intelligence | app/(dashboard)/entity/page.tsx | Entity deep-dive with reality scores. |
| Signal Alerts | app/(dashboard)/alerts/page.tsx | Alert queue with signal chain. |
| Huginn Console | app/(dashboard)/huginn/page.tsx | Runtime Huginn dialogue + reasoning trace + Munin counts + eval logging. |
| Watchlist & Briefs | app/(dashboard)/watchlist/page.tsx | Tracked entities + daily briefs. |
| Audit Trail | app/(dashboard)/audit/page.tsx | Transparent event log. |
| Settings | app/(dashboard)/settings/page.tsx | Admin: alert rules, API keys, team, ontology. |
| API Huginn | app/api/huginn/route.ts | Huginn natural-language query. |
| API Huginn eval | app/api/huginn/eval/route.ts | Huginn answer rating update for huginn_eval_log. |
| API Seed Memory | app/api/seed-memory/route.ts | Seed Memory CRUD through writeGate and MVCC. |
| API admin | app/api/settings/route.ts | Org settings, members, alert rules, redacted API keys. |
| API keys | app/api/api-keys/route.ts | One-time API key issue and revocation. |
| API alerts | app/api/alerts/route.ts | Alerts read (alerts:read scope). |
| API entities | app/api/entities/route.ts | Entity read (entities:read scope). |
| API signals | app/api/signals/route.ts | Raw signals read (signals:read scope). |
| API audit | app/api/audit/route.ts | Audit events read (audit:read scope). |
| AI provider | lib/ai/provider.ts | Mock/Gemini-compatible answer, structured self-assessment, and independent grader abstraction. |
| AI rate limits | lib/ai/rate-limit.ts | Org-and-model-scoped Gemini free-tier RPM/RPD/TPM guard; optional Supabase shared limiter via 0004. |
| Auth request | lib/auth/request.ts | Env-gated route authorization with scoped API keys. |
| Auth API keys | lib/auth/api-keys.ts | HMAC-SHA256 hashing, timing-safe verification. |
| Org filters | lib/api/org.ts | Org context parsing, public-or-org isolation. |
| Admin repository | lib/repositories/admin.ts | Supabase-backed admin settings with fallback. |
| Reality repository | lib/repositories/reality.ts | Supabase reads with fallback for alerts/signals/entities/audit. |
| Huginn query | lib/huginn/query.ts | Org-scoped query orchestration, self-assessment, cascade, eval logging, grader, reasoning trace. |
| Huginn cascade | lib/huginn/cascade.ts | Layered Munin/Odim/gapfill retrieval with separate opinion and narrative paths. |
| Munin memory | lib/munin/memory.ts | v2 fact/procedure/seed memory search, opinion fixtures/search, MVCC filters. |
| Munin write gate | lib/munin/write-gate.ts | Write-time routing for memory/opinion/narrative with salience threshold. |
| Seed memory | lib/munin/seed.ts | Seed Memory CRUD with fact/opinion separation and MVCC fallback. |
| Seed Memory UI | components/ui/seed-memory-manager.tsx | Client-side create/edit/retire UI wired to /api/seed-memory. |
| Dream batch | lib/munin/dream.ts | Dream phases, diff recording, and sleep-time precompute seeding. |
| Fallback data | lib/data.ts | Source-backed fixture data from ingestion pipeline. |
| i18n | lib/i18n/messages.ts | Typed English/Japanese UI message catalog. |
| Ontology types | lib/ontology/types.ts | Core object/link types (6 object types). |
| Pipeline normalize | lib/pipeline/normalize.ts | SHA256 fingerprinting, deduplication. |
| Pipeline ontologize | lib/pipeline/ontologize.ts | Signal → ontology objects/links (source-specific handlers). |
| Pipeline alert | lib/pipeline/alert.ts | Alert rule engine (source-specific thresholds). |
| Pipeline audit | lib/pipeline/audit.ts | Audit event generation. |
| Pipeline ingest | lib/pipeline/ingest.ts | Supabase upsert orchestration. |
| Pipeline fixtures | lib/pipeline/fixtures.ts | Synthetic test data (8 signals). |
| Pipeline idempotency | lib/pipeline/idempotency.ts | SHA256 → deterministic UUID. |
| Scrape runner | scrapers/run.ts | CLI entry for dry-run/live scrape. |
| Configured source | scrapers/configured-source.ts | Generic JSON/CSV adapter for paid feeds. |
| Verification | scripts/verify.mjs | Repository structural gate. |
| DB migrations | scripts/apply-db-migrations.mjs | Applies selected Supabase SQL migrations to staging or production through psql. |
| Release audit | scripts/release-audit.mjs | Phase F + Huginn/Munin v2 launch-readiness control gate. |
| Bias test CLI | scripts/bias-test.mjs | Monthly investment bias test runner. |
| Bootstrap API key | scripts/issue-bootstrap-api-key.mjs | One-time admin API key issuance. |
| Commercial readiness | docs/commercial-readiness.md | Phase F §4 requirement matrix + human-only gates. |

## Common Workflows
| Workflow | Read First | Edit Usually | Verify |
|---|---|---|---|
| Add dashboard screen | context/source-06-screens.md | app/(dashboard)/, components/ui/ | pnpm verify; pnpm typecheck |
| Change design | context/source-07-design.md | styles/tokens.css, app/globals.css | pnpm verify |
| Add resolver | context/source-03-ontology.md | lib/resolvers/ | pnpm test; pnpm verify |
| Add scraper | context/source-04-data-pipeline.md | scrapers/, config/sources.json | pnpm test; pnpm verify |
| Add paid source | context/source-08-roadmap.md | config/sources.json, .env.example | pnpm test; pnpm scrape:dry-run; pnpm release:audit; set orgIdEnv |
| Change Munin memory | context/source-05-huginn-munin.md | lib/munin/, supabase/migrations/ | pnpm test; pnpm verify |
| Change Huginn query | context/source-05-huginn-munin.md | lib/huginn/, lib/munin/, lib/ai/ | pnpm test; pnpm typecheck |
| Change admin/auth | context/source-08-roadmap.md | app/api/settings/, app/api/api-keys/, lib/auth/, lib/repositories/admin.ts | pnpm test; pnpm typecheck; pnpm release:audit; pnpm build |
| Update pipeline | context/source-04-data-pipeline.md | lib/pipeline/, scrapers/ | pnpm test; pnpm scrape:dry-run |

## Generated / External Files
| Path | Rule |
|---|---|
| node_modules/ | ignored; never edit. |
| .next/ | ignored; build output. |
| .env* | ignored except .env.example. |
| playwright-report/ | ignored test output. |
| context/source-*.md | canonical source material; edit only when product source changes. |

## Update Rules
- Keep Summary under 20 lines.
- Keep each directory note concrete.
- Move rationale to docs/decisions.md.

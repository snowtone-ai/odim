# Repo Map

## Purpose
Next.js 16 App Router + Supabase + Gemini AI. Ingests public signals (SEC, FERC, permits, ports...), maps to ontology, answers analyst queries via multi-layer AI cascade (Huginn) with persistent memory (Munin), graph-native evidence paths, and approval-gated Watchtower workflows.

## Read First
1. `docs/state.md` — current execution state, active tasks, blockers
2. `docs/decisions.md` — architectural decisions (D-001-D-025)
3. `lib/huginn/query.ts` — main AI query orchestrator
4. `lib/pipeline/ingest.ts` — signal ingestion pipeline
5. `lib/auth/request.ts` — auth flow, every API route calls this

## Architecture
- **UI:** `app/(dashboard)/` — 5 pages: map, entity, alerts, huginn, settings; Shell/CommandPalette live in `app/(dashboard)/layout.tsx`; `app/page.tsx` is the public landing page; `components/ui/`
- **Routing:** Next.js App Router; `middleware.ts` applies security headers plus SSO session enforcement (`/`, `/login`, `/api/health` stay public); `app/api/` includes `v1/`, health, export, audit-export, push-subscribe, auth callback, and existing handlers.
- **Domain:** `lib/huginn/` (cascade, grading, bias, precompute); `lib/graphrag/` (Evidence GraphRAG); `lib/watchtower/` (playbooks, runs, approvals); `lib/munin/` (memory, dream, write-gate, seed); `lib/ai/ensemble.ts` for multi-provider generation.
- **Data:** `lib/repositories/admin.ts`, `reality.ts`, `evidence-graph.ts`, and `watchtower.ts` — Supabase or fallback fixtures; `lib/pipeline/` adds scoring, freshness, diff, calibration, attribution, anomaly, sentiment, sector-rotation, and backtest.
- **External:** Gemini/OpenAI/Claude provider hooks; Supabase (`lib/supabase/client.ts`); scrapers (`scrapers/`) now include SEC expansion, FRED, Federal Register, EDINET, Companies House, USAspending, OpenSanctions, FEMA, SAM.gov, NRC, and ISO queue coverage.
- **Config:** `config/sources.json`; `lib/env/runtime.ts`; `lib/env/validate.ts`; `.env.example`; `docs/api-reference.md`
- **Tests:** `tests/` — auth, route handlers, pipeline, huginn, GraphRAG, Watchtower, bias, security, RLS, i18n, mobile

## Key Areas
| Area | Start Here | Verify |
|---|---|---|
| AI query | `lib/huginn/query.ts` | `tests/huginn-query.test.mjs` |
| Evidence cascade | `lib/huginn/cascade.ts` | `tests/huginn-munin-v2.test.mjs` |
| Evidence GraphRAG | `lib/graphrag/evidence-graph.ts` + `lib/repositories/evidence-graph.ts` | `tests/ai-native-upgrades.test.mjs` |
| Watchtower workflows | `lib/watchtower/workflows.ts` + `lib/repositories/watchtower.ts` | `tests/ai-native-upgrades.test.mjs` |
| Memory read/write | `lib/munin/memory.ts` | `lib/munin/write-gate.ts` |
| Dream synthesis | `lib/munin/dream.ts` | `tests/bias-*.test.ts` |
| Signal ingestion | `scrapers/run.ts` → `lib/pipeline/ingest.ts` | `tests/pipeline-ingestion.test.mjs` |
| Ontology mapping | `lib/pipeline/ontologize.ts` | `tests/pipeline-ingestion.test.mjs` |
| Auth / API keys | `lib/auth/request.ts` | `tests/security-controls.test.mjs` |
| API route rate limiting | `lib/api/rate-limit.ts` | `tests/api-keys.test.mjs` |
| AI rate limiting | `lib/ai/rate-limit.ts` | `tests/ai-rate-limit.test.mjs` |
| Map UI | `components/ui/reality-map.tsx` | `lib/map/entities.ts` |
| Entity UI | `components/ui/entity-workstation.tsx` | `app/(dashboard)/entity/page.tsx` |
| Huginn UI | `components/ui/huginn-console.tsx` | `app/(dashboard)/huginn/page.tsx` |
| Settings | `app/(dashboard)/settings/page.tsx` | `components/ui/seed-memory-manager.tsx` |
| DB schema | `supabase/migrations/0001-0011` | `supabase/tests/rls-cross-org-smoke.sql` |

## Critical Flows
| Flow | Entry | Core Path | Risk |
|---|---|---|---|
| User query | `POST /api/huginn` | `auth/request` → `huginn/query` → `huginn/cascade` → `ai/provider` | high |
| Evidence query | `POST /api/graphrag/query`, `GET /api/v1/evidence-graph` | `auth/request` → `repositories/evidence-graph` → `graphrag/evidence-graph` | high |
| Watchtower run | `app/api/watchtower/*`, `GET /api/v1/watchtower/runs` | `auth/request` → `repositories/watchtower` → `watchtower/workflows` | high |
| Signal ingest | `daily-scrape.yml` | `scrapers/run` → `pipeline/ontologize` → `pipeline/ingest` | high |
| Dream synthesis | `daily-dream.yml` | `munin/dream` → `dream-phases` → `ai/provider` → `munin/memory` | med |
| Auth | all `app/api/*/route.ts` | `auth/request` → `auth/api-keys` → rate-limit | high |
| Precompute cache | `huginn/precompute.ts` | `findPrecomputedAnswer` / `invalidatePrecomputedAnswers` | med |
| Seed memory | `POST /api/seed-memory` | `auth/request` → `munin/seed` → `munin/write-gate` | low |

## Change Routes
| Change Type | Start Here | Then Check |
|---|---|---|
| UI | `components/ui/*.tsx` | page in `app/(dashboard)/`, `lib/i18n/messages.ts`, persisted stores in `lib/stores/`, `public/push-sw.js` for browser notification UX, `components/ui/dashboard-builder.tsx` for `/custom` |
| API | `app/api/*/route.ts` | `lib/auth/request.ts`, `lib/auth/sso.ts`, `lib/api/v1-router.ts`, service modules in `lib/` |
| AI/query logic | `lib/huginn/query.ts` | `cascade.ts`, `grader.ts`, `bias-test.ts`, huginn tests |
| Evidence GraphRAG | `lib/graphrag/evidence-graph.ts` | `lib/repositories/evidence-graph.ts`, Huginn/entity UI, `tests/ai-native-upgrades.test.mjs` |
| Watchtower | `lib/watchtower/` | `lib/repositories/watchtower.ts`, `app/api/watchtower/`, Alerts/Settings UI, migrations 0010-0011 |
| Memory | `lib/munin/memory.ts` | `write-gate.ts`, `seed.ts`, dream tests |
| Ingestion | `lib/pipeline/ingest.ts` | `ontologize.ts`, `alert.ts`, `scrapers/run.ts`, `calibration.ts`, `attribution.ts`, `anomaly.ts`, `sentiment.ts`, `sector-rotation.ts`, `backtest.ts` |
| Scrapers | `scrapers/<name>.ts` | `scrapers/run.ts`, `config/sources.json`, pipeline tests |
| DB schema | `supabase/migrations/` | `lib/repositories/`, RLS smoke, `scripts/apply-db-migrations.mjs` |
| Auth/security | `lib/auth/request.ts` | `api-keys.ts`, `lib/api/rate-limit.ts`, security tests |
| Config/env | `lib/env/runtime.ts` | `lib/env/validate.ts`, `.env.example`, `lib/ai/rate-limit.ts`, `lib/auth/request.ts`, `lib/supabase/client.ts` |
| Workflows | `.github/workflows/*.yml` | `tests/automation-workflows.test.mjs`, `scripts/verify.mjs` |

## High-Risk Areas
| Area | Why | Verify |
|---|---|---|
| `lib/auth/request.ts` | Auth bypass = full access | `codegraph_callers` + security tests |
| `lib/repositories/evidence-graph.ts` | Graph context can leak tenant evidence if org filters regress | `tests/ai-native-upgrades.test.mjs` + auth route tests |
| `lib/repositories/watchtower.ts` | Approval-gated automation can dispatch or persist cross-org state incorrectly | `tests/ai-native-upgrades.test.mjs` + migration/RLS review |
| `lib/munin/write-gate.ts` | Memory quality gate | `codegraph_impact` + huginn tests |
| `lib/pipeline/idempotency.ts` | Fingerprint bugs → dedup failure | pipeline tests |
| `scrapers/run.ts` | Silent empty updates | automation tests + `pnpm scrape:dry-run` |
| `lib/ai/rate-limit.ts` | Quota exceeded or bypass | rate-limit tests |
| Supabase RLS policies | Tenant data leak | `supabase/tests/rls-cross-org-smoke.sql` |

## Do Not Read First
- `lib/i18n/messages.ts` — localization strings, stable
- `lib/ontology/types.ts` — static type defs
- `lib/munin/types.ts`, `lib/pipeline/types.ts` — shared type defs
- `lib/pipeline/fixtures.ts` — test/demo data only
- `lib/data.ts` — shared utilities, read only on unexpected failures
- `scripts/*.mjs` — ops/admin utilities (migrations, key issuance, audit)
- `postcss.config.mjs`, `next.config.ts` — infra config, rarely changes
- `context/source-*.md` — original product specs, use only for deep domain questions

## Agent Rule
Read this file first. Then inspect only the minimum relevant files. Use CodeGraph or search only to verify current dependencies and impact radius.

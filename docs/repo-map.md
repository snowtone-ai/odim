# Repo Map

## Purpose
Odim is a multi-agent intelligence system that ingests real-world signals (SEC, FERC, permits, ports), maps them to an ontology, and answers analyst questions via a multi-layer AI evidence cascade (Huginn) backed by a persistent memory system (Munin). It is a Next.js 16 App Router app with a Supabase backend and Gemini AI.

## AI First-Read Order
1. `docs/state.md` — current execution state
2. `docs/decisions.md` — architectural decisions
3. `lib/huginn/query.ts` — main AI query orchestrator
4. `lib/munin/memory.ts` — memory retrieval/write
5. `lib/pipeline/ingest.ts` — signal ingestion pipeline
6. `lib/auth/request.ts` — auth flow entry point
7. `app/api/huginn/route.ts` — primary API entry

## Architecture Overview
- **UI layer:** `app/(dashboard)/` — 5 pages (alerts, entity, huginn, map, settings); `components/ui/`
- **Routing / application layer:** Next.js App Router; `app/api/` — 9 route handlers
- **Domain logic:** `lib/huginn/` (cascade search, grading, bias, precompute); `lib/munin/` (memory, dream, write-gate); `lib/pipeline/` (normalize, ontologize, alerts)
- **Data access:** `lib/repositories/admin.ts`, `lib/repositories/reality.ts` — Supabase or fallback fixtures
- **External services:** Google Gemini API (`lib/ai/provider.ts`); Supabase (`lib/supabase/`); scrapers (`scrapers/`)
- **Config / environment:** `.env` (see env vars below); `config/sources.json`; `lib/env/runtime.ts`
- **Data sources:** `docs/data-sources.md` — comprehensive reference for all Substrate + Narrative layer sources
- **Tests:** `tests/` — 14 files covering auth, pipeline, huginn, bias, security, RLS

## Key Entry Points
| Area | File | Why it matters |
|---|---|---|
| AI query API | `app/api/huginn/route.ts` | Primary user-facing endpoint |
| Query orchestrator | `lib/huginn/query.ts` | Drives entire answer generation |
| Auth middleware | `lib/auth/request.ts` | Every API route calls `authorizeApiRequest` |
| Memory read | `lib/munin/memory.ts` | `searchMuninMemory` feeds cascade |
| Signal ingestion | `lib/pipeline/ingest.ts` | `ingestSignals` → normalize → ontologize → alerts |
| Autonomous agent | `lib/munin/dream.ts` | Daily synthesis loop |
| Scraper runner | `scrapers/run.ts` | `runScrapers` called by `daily-scrape.yml` |
| Settings UI | `components/ui/seed-memory-manager.tsx` | Fact/opinion CRUD |

## Core Modules
| Module | Responsibility | Key dependencies |
|---|---|---|
| `lib/huginn/query.ts` | Answer orchestration | cascade, provider, grader, eval-log |
| `lib/huginn/cascade.ts` | Multi-layer evidence search | munin/memory, repositories/reality, gapfill, narrative-capture |
| `lib/huginn/precompute.ts` | Cache precomputed answers | supabase |
| `lib/huginn/self-assessment.ts` | Derive search plan from question | — |
| `lib/huginn/grader.ts` | Quality rubric scoring | provider |
| `lib/huginn/bias-test.ts` | Confirmation bias detection | provider |
| `lib/munin/memory.ts` | Memory CRUD + semantic search | supabase |
| `lib/munin/dream.ts` | Autonomous daily synthesis | dream-phases, memory, provider |
| `lib/munin/write-gate.ts` | Memory quality filter | — |
| `lib/pipeline/ingest.ts` | Full ingestion pipeline | normalize, ontologize, alert, audit |
| `lib/pipeline/ontologize.ts` | Signal → ontology objects/links | idempotency |
| `lib/pipeline/normalize.ts` | Raw signal validation + dedup | idempotency |
| `lib/pipeline/alert.ts` | Alert generation from signals | — |
| `lib/auth/request.ts` | API key auth + rate limiting | api-keys, supabase, rate-limit |
| `lib/auth/api-keys.ts` | Key issuing/verification | supabase |
| `lib/ai/provider.ts` | Gemini API wrapper | rate-limit |
| `lib/ai/rate-limit.ts` | RPM/RPD/TPM enforcement | supabase |
| `lib/repositories/reality.ts` | Entity/alert/signal/audit queries | supabase, fixtures |
| `lib/repositories/admin.ts` | Org/member/apikey/alertrule CRUD | supabase, fixtures |
| `lib/api/org.ts` | OrgContext extraction + RLS filters | — |
| `lib/munin/seed.ts` | Seed CRUD (list/create/update/delete) + Supabase fallback | write-gate, supabase |
| `lib/resolvers/triangulation.ts` | Confidence score from layer count: `triangulate(n, max=7)` → 0.25–0.95 | — |
| `lib/resolvers/spv-resolver.ts` | Rank SPV candidates by confidence: `rankSpvCandidates(candidates[])` | — |
| `lib/resolvers/rds.ts` | Reality Data Score computation | cascade |
| `lib/data.ts` | Shared data utilities (20 symbols); used by scripts and repositories | — |

## Critical Flows

### Flow 1: User Query (Huginn)
- **Entry:** `POST /api/huginn` → `app/api/huginn/route.ts`
- **Main files:** `lib/auth/request.ts` → `lib/huginn/query.ts` → `lib/huginn/cascade.ts` → `lib/ai/provider.ts`
- **Important functions:** `authorizeApiRequest`, `answerHuginnQuestion`, `cascadeSearch`, `generateAnswer`, `generateGraderAssessment`, `logHuginnEval`
- **Downstream dependencies:** `searchMuninMemory`, `listAlerts/Entities/Signals`, `realityGapfillSearch`, `narrativeCaptureSearch`, Gemini API
- **Tests:** `tests/huginn-*.test.mjs`

### Flow 2: Signal Ingestion (Scraper → DB)
- **Entry:** `daily-scrape.yml` → `scrapers/run.ts:runScrapers`
- **Main files:** `scrapers/*.ts` → `lib/pipeline/ingest.ts` → `lib/pipeline/normalize.ts` → `lib/pipeline/ontologize.ts`
- **Important functions:** `ingestSignals`, `normalizeSignal`, `ontologizeSignal`, `buildAlerts`, `buildAuditEvents`, `deterministicUuid`
- **Downstream dependencies:** Supabase tables: `signals`, `entities`, `entity_links`, `alerts`, `audit_log`
- **Tests:** `tests/pipeline-ingestion.test.mjs`

### Flow 3: Autonomous Dream (Munin)
- **Entry:** `daily-dream.yml` → `lib/munin/dream.ts:runDream`
- **Main files:** `lib/munin/dream-phases.ts`, `lib/munin/memory.ts`, `lib/ai/provider.ts`
- **Important functions:** `consolidateMemories`, `synthesizeInsights`, `detectBiasHazards`, `invalidatePrecomputedAnswers`, `recordDreamRun`
- **Downstream dependencies:** `munin_memory`, `pre_computed_answers` tables
- **Tests:** `tests/bias-*.test.ts`

### Flow 4: Auth
- **Entry:** All `app/api/*/route.ts` → `authorizeApiRequest`
- **Main files:** `lib/auth/request.ts`, `lib/auth/api-keys.ts`
- **Important functions:** `extractApiToken`, `verifyApiKey`, `assertApiAuthAttemptAllowed`, `recordFailedApiAuthAttempt`
- **Downstream dependencies:** `api_keys` table, `lib/ai/rate-limit.ts`
- **Tests:** `tests/api-keys.test.mjs`, `tests/security-controls.test.mjs`

## Dependency / Call Relationship Summary
- `app/api/huginn/route.ts` → `authorizeApiRequest` → `answerHuginnQuestion`
- `answerHuginnQuestion` → `cascadeSearch` → `searchMuninMemory`, `listAlerts`, `realityGapfillSearch`
- `cascadeSearch` → `findPrecomputedAnswer` (early exit on cache hit)
- `generateAnswer` → `assertAiRateLimitAvailableForRequest` → Gemini API
- `runScrapers` → `ingestSignals` → `normalizeSignal` → `ontologizeSignal` → `buildAlerts`
- `runDream` → `synthesizeInsights` → `generateAnswer` → writes to `munin_memory`
- `invalidatePrecomputedAnswers` triggered by `ingestSignals` and `runDream`
- Changes to `lib/pipeline/ontologize.ts` impact `entities`, `entity_links`, `alerts`
- Changes to `lib/munin/write-gate.ts` affect all memory writes (seed + dream)
- `lib/munin/seed.ts` calls `writeGate` before any DB write → gate is enforced for all user seeds
- `lib/resolvers/triangulation.ts:triangulate` → confidence scalar fed into cascade RDS scoring
- `lib/resolvers/spv-resolver.ts:rankSpvCandidates` → used in entity resolution for SPV parent matching

## High-Risk Areas
| Area | Why risky | Verify with |
|---|---|---|
| `lib/auth/request.ts` | Auth bypass = full access | `codegraph_callers` + `tests/security-controls.test.mjs` |
| `lib/munin/write-gate.ts` | Memory quality gate; bypass allows noise | `codegraph_impact` + `tests/huginn-*.test.mjs` |
| `lib/pipeline/idempotency.ts` | Fingerprint bugs → dedup failures | `codegraph_callers` + `tests/pipeline-ingestion.test.mjs` |
| `lib/huginn/precompute.ts` | Stale cache → wrong answers | `codegraph_impact` on `invalidatePrecomputedAnswers` |
| `lib/ai/rate-limit.ts` | Misconfiguration → quota exceeded or auth bypass | `codegraph_callers` + `tests/ai-rate-limit.test.mjs` |
| Supabase RLS policies | Tenant data leak | `.github/workflows/staging-rls-smoke.mjs` |

## Common Change Routes
| If changing... | Start here | Then verify |
|---|---|---|
| AI query logic | `lib/huginn/query.ts` | callers of `answerHuginnQuestion` + huginn tests |
| Evidence search | `lib/huginn/cascade.ts` | `cascadeSearch` callees + huginn tests |
| Memory read/write | `lib/munin/memory.ts` + `lib/munin/seed.ts` | `write-gate.ts` + seed-memory API + dream tests |
| Signal ingestion | `lib/pipeline/ingest.ts` | `ontologize.ts`, `alert.ts` + pipeline tests |
| Auth/API key | `lib/auth/request.ts` | all `app/api/*/route.ts` callers + security tests |
| Gemini/AI provider | `lib/ai/provider.ts` | `rate-limit.ts` + huginn integration tests |
| DB schema | Supabase migrations | `lib/repositories/` + `lib/supabase/` + RLS smoke |
| Scraper | `scrapers/<name>.ts` | `scrapers/run.ts` + pipeline tests + `config/sources.json` |
| Env config | `.env.example` + `lib/env/runtime.ts` | `lib/ai/rate-limit.ts`, `lib/auth/request.ts` |

## Key Environment Variables
| Variable | Purpose | Required in prod |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server writes | Yes |
| `API_KEY_PEPPER` | Hash salt for API keys | Yes |
| `AUTH_REQUIRED` | Enforce API key auth | Yes |
| `AI_PROVIDER` | `mock` or `gemini` | Yes |
| `AI_API_KEY` | Gemini API key | If `AI_PROVIDER=gemini` |
| `AI_MODEL` | Default: `gemini-2.5-flash` | No |
| `SLEEP_COMPUTE_ENABLED` | Precomputed answer cache | No |
| `AI_RATE_LIMITS` | JSON `{rpm, rpd, tpm}` | No |

## Supabase Tables (Stable Schema)
| Table | Purpose |
|---|---|
| `api_keys` | API key auth (prefix, hash, scopes, revoked_at) |
| `munin_memory` | MVCC fact/seed/narrative memory (validFrom/validTo) |
| `munin_opinions` | MVCC user opinion seeds |
| `pre_computed_answers` | Cached Huginn answers (expires_at, invalidated status) |
| `signals` | Normalized ingested signals (fingerprint dedup) |
| `entities` / `entity_links` | Ontology objects and relationships |
| `alerts` | Generated alerts (dedupeKey, priority, evidence) |
| `audit_log` | All system events |
| `ai_rate_limit_usage` | RPM/RPD/TPM tracking per model+org+date |

## Low-Priority Read Areas
Only inspect these when directly relevant:
- `lib/i18n/messages.ts` — localization strings
- `lib/ontology/types.ts` — static type defs (stable)
- `lib/munin/types.ts` — shared memory type defs (`MemoryClass`, `AgentScope`, `SourceType`, `WriteGateCandidate`)
- `lib/pipeline/types.ts` — `SourceRef` and pipeline type defs
- `lib/pipeline/fixtures.ts` — test/demo data only
- `lib/data.ts` — shared utilities; read only when repositories or scripts fail unexpectedly
- `scripts/*.mjs` — ops/admin utilities (migrations, key issuance, audit, RLS smoke)
- `postcss.config.mjs`, `next.config.ts` — infra config

## Agent Rule
Before editing:
1. Read `docs/repo-map.md` (this file) — Summary section first.
2. Use `codegraph_context` to locate current relevant symbols/files.
3. Check callers (`codegraph_callers`) and impact (`codegraph_impact`) before touching shared code.
4. Make the smallest safe change.
5. Run `pnpm verify` (lint + typecheck + test).

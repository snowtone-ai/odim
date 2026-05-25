# tasks.md -- pm-zero v9.5 Execution Ledger

## Goal Binding
- Active goal: Huginn/Munin v2.0 upgrade (context/source-05-huginn-munin.md).
- Canonical spec: context/source-05-huginn-munin.md (v2.0)
- Planning owner: Souma (Planner)
- Implementation owner: Codex CLI
- Review owner: Codex CLI
- Scope: T017-T030 (v2.0 full implementation). No scope deferral.

## Status Vocabulary
- proposed: idea exists, not ready
- ready: owner, dependencies, write scope, acceptance, verification, and expected evidence are clear
- doing: one owner is actively working
- blocked: needs decision, dependency, credential, environment, or human action
- review: implementation complete, review pending
- done: accepted by reviewer
- verified: evidence recorded

## Tasks
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
| T016 | verified | Codex | T015 | supabase/**, lib/api/**, lib/auth/**, lib/ai/**, lib/repositories/**, lib/pipeline/**, scrapers/**, config/**, scripts/**, tests/**, docs/**, .env.example, styles/**, components/**, app/(dashboard)/map/page.tsx | Remediate pre-release review findings around RLS, auth, rate limits, production no-fallback, paid-source org binding, staging smoke, grants, and design-token consistency | pnpm test; pnpm typecheck; pnpm release:audit; pnpm verify; pnpm scrape:dry-run; pnpm build | Verified in T016 evidence; pre-release remediation locally complete |

## v2.0 Huginn/Munin Upgrade Tasks (Full - context/source-05-huginn-munin.md)

| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| T017 | done | Codex | T016 | supabase/migrations/0002_huginn_munin_v2.sql, scripts/release-audit.mjs, scripts/run-staging-rls-smoke.mjs, supabase/tests/rls-cross-org-smoke.sql | munin_memory expanded; munin_opinions, munin_dream_runs, huginn_eval_log created with org RLS and service_role grants; release audit and staging smoke include v2 tables | pnpm test; pnpm typecheck; pnpm release:audit; pnpm verify; pnpm build | 0002 migration exists; release:audit v2 schema/RLS checks pass; staging smoke includes munin_opinions and huginn_eval_log probes |
| T018 | done | Codex | T017 | lib/munin/write-gate.ts, lib/munin/types.ts, .env.example, tests/huginn-munin-v2.test.mjs | WriteGateResult/types implemented; web_narrative structurally rejected; opinions route to munin_opinions; salience threshold env-configurable; seed stays active | pnpm test; pnpm typecheck; pnpm verify; pnpm build | v2 writeGate tests pass; MUNIN_SALIENCE_THRESHOLD documented |
| T019 | done | Codex | T018 | lib/munin/memory.ts, tests/huginn-munin-v2.test.mjs | MuninMemory/MuninOpinion v2 types; fixture seed/opinion; active+validTo search filters; opinions excluded by default and available through searchOpinions | pnpm test; pnpm typecheck; pnpm verify; pnpm build | v2 Munin search tests pass; toMuninMemoryRow includes v2 columns |
| T020 | done | Codex | T019 | app/(dashboard)/settings/page.tsx, app/api/seed-memory/route.ts, lib/munin/seed.ts, lib/i18n/messages.ts | Seed Memory panel and CRUD API; fact seeds enter munin_memory core; opinion seeds enter munin_opinions; update/delete use MVCC; admin:write gated | pnpm test; pnpm typecheck; pnpm verify; pnpm build | seed CRUD/MVCC tests pass; settings build passes with fallback when local DB lacks v2 schema |
| T021 | done | Codex | T019 | lib/huginn/query.ts, lib/huginn/cascade.ts | Huginn uses cascadeSearch; Layer 1 Munin and Layer 2 Odim cache; core/seed always present; opinions only on explicit plan; retrieval_layers_used returned | pnpm test; pnpm typecheck; pnpm verify; pnpm build | cascade/self-assessment tests pass; Huginn response includes retrieval_layers_used |
| T022 | done | Codex | T021 | lib/huginn/gapfill.ts, config/sources.json, .env.example | reality_gapfill_search uses allowlisted domains only; mock FERC fixture; results route through writeGate as primary/official evidence; cascade integration | pnpm test; pnpm typecheck; pnpm verify; pnpm build | gapfill tests pass; allowedGapfillDomains and GAPFILL_ENABLED documented |
| T023 | done | Codex | T021 | lib/huginn/self-assessment.ts, lib/ai/provider.ts, lib/huginn/query.ts | SelfAssessmentPlan and assessQuery implemented; provider supports structured Gemini/mock plan; plan controls cascade/opinion/gapfill/narrative behavior | pnpm test; pnpm typecheck; pnpm verify; pnpm build | self-assessment tests pass; reasoning trace includes self_assessment step |
| T024 | done | Codex | T023 | lib/huginn/eval-log.ts, app/api/huginn/eval/route.ts, lib/huginn/query.ts | Every Huginn query logs huginn_eval_log fallback/Supabase row; response returns eval_log_id; eval API accepts 1-5 rating and note org-scoped | pnpm test; pnpm typecheck; pnpm verify; pnpm build | Huginn tests pass with eval fallback logging; /api/huginn/eval builds |
| T025 | done | Codex | T024 | app/(dashboard)/huginn/page.tsx, components/ui/eval-button.tsx, lib/i18n/messages.ts | Huginn Console displays eval button, Munin fact/procedure/seed/opinion counts, Reality/Narrative labels, cascade layers, sycophancy badge slot, en/ja keys | pnpm test; pnpm typecheck; pnpm verify; pnpm build | i18n/no-placeholder/build checks pass; /huginn prerenders successfully |
| T026 | done | Codex | T025 | lib/huginn/narrative-capture.ts, lib/huginn/cascade.ts, lib/huginn/query.ts, .env.example | narrative_capture_search tags web_narrative; writeGate rejects memory; narrative stays out of answer evidence; computeRDS returns rds; response exposes narrativeContrast | pnpm test; pnpm typecheck; pnpm verify; pnpm build | narrative capture tests pass; NARRATIVE_CAPTURE_ENABLED documented |
| T027 | done | Codex | T025 | lib/munin/dream.ts, lib/munin/dream-phases.ts, .github/workflows/daily-dream.yml, .env.example | Dream job excludes opinions/seeds, runs cluster/consolidate/contradict/promote, writes new rows through writeGate, records munin_dream_runs diff, scheduled daily workflow | pnpm test; pnpm typecheck; pnpm verify; pnpm build | dream modules typecheck/build; daily-dream workflow exists; DREAM_ENABLED documented |
| T028 | done | Codex | T024 | lib/huginn/grader.ts, lib/huginn/query.ts, lib/ai/provider.ts, app/(dashboard)/huginn/page.tsx, .env.example | Outcomes grader receives only question+answer, returns score/flags, sycophancy writes audit event, grader_score/flags logged to eval, UI flag slot populated | pnpm test; pnpm typecheck; pnpm verify; pnpm build | grader tests pass; GRADER_ENABLED documented |
| T029 | done | Codex | T028 | supabase/migrations/0003_sleep_time_compute.sql, lib/huginn/precompute.ts, lib/huginn/cascade.ts, lib/munin/dream.ts, .env.example | pre_computed_answers schema with org RLS; Dream phase seeds precompute rows; cascade cache hit can skip retrieval; expiration/invalidation helpers present | pnpm test; pnpm typecheck; pnpm release:audit; pnpm verify; pnpm build | 0003 migration exists; release:audit sleep-time schema check passes; SLEEP_COMPUTE_ENABLED documented |
| T030 | done | Codex | T028 | lib/huginn/bias-test.ts, scripts/bias-test.mjs, tests/bias-*.test.ts, scripts/release-audit.mjs | 3-stage investment bias tests implemented; CLI runner emits JSON; audit_log event path wired; release audit checks framework | pnpm test; pnpm typecheck; pnpm release:audit; pnpm verify; pnpm build | bias tests pass; release:audit v2 bias framework check passes |

## v2.0 Completion Evidence
- Verification on 2026-05-25: `pnpm test` passed 49/49, `pnpm typecheck` passed, `pnpm release:audit` passed 94 checks, `pnpm verify` passed, and `pnpm build` passed after review remediation.
- Staging RLS smoke is extended for `munin_opinions` and `huginn_eval_log`; scripts now load `.env.local` and include `db:migrate:staging` / `db:migrate:production`.

## Review Remediation Tasks (review-result.md)

| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| R001 | verified | Codex | T029 | lib/huginn/precompute.ts, lib/huginn/cascade.ts, lib/munin/dream.ts, scripts/release-audit.mjs | Sleep-time Compute reads/writes `pre_computed_answers` in Supabase when configured and keeps in-memory fallback for local verification | pnpm test; pnpm typecheck; pnpm release:audit | precompute persistence audit passes; cache hit/invalidation test passes |
| R002 | verified | Codex | T020 | app/(dashboard)/settings/page.tsx, components/ui/seed-memory-manager.tsx, lib/munin/seed.ts, lib/i18n/messages.ts | Seed Memory UI can create, edit, and retire fact/opinion seeds through `/api/seed-memory`; server writes surface Supabase errors | pnpm test; pnpm typecheck; pnpm release:audit | `ui:seed-memory-actions` audit passes; seed CRUD tests pass |
| R003 | verified | Codex | T025 | app/(dashboard)/huginn/page.tsx, components/ui/eval-button.tsx, lib/i18n/messages.ts | Huginn Console renders runtime Huginn response, real `eval_log_id`, trace, sources, counts, and EvalButton error states | pnpm typecheck; pnpm release:audit | `ui:huginn-console-runtime` and `ui:eval-error-handling` audits pass |
| R004 | verified | Codex | T026 | lib/huginn/gapfill.ts, lib/huginn/narrative-capture.ts, scripts/release-audit.mjs | Reality gapfill persists source-backed Munin memory; narrative capture persists tenant-scoped `raw_signals` and remains outside judgment memory | pnpm test; pnpm typecheck; pnpm release:audit | `v2:gapfill-narrative-persistence` audit passes |
| R005 | verified | Codex | T030 | lib/huginn/bias-test.ts, scripts/release-audit.mjs | Bias test CLI runs controlled cases through the Huginn query pipeline instead of only regex helpers | pnpm test; pnpm release:audit | bias tests and `v2:bias-test-framework` audit pass |
| R006 | verified | Codex | T027 | lib/munin/dream.ts, lib/munin/dream-phases.ts | Dream IDs are idempotent by org/content/class; clustering/contradiction logic uses source overlap and symmetric polarity detection | pnpm test; pnpm typecheck | dream test passes; L-01 remediated |
| R007 | verified | Codex | T017 | supabase/tests/rls-cross-org-smoke.sql, scripts/run-staging-rls-smoke.mjs, scripts/apply-db-migrations.mjs, .github/workflows/staging-rls-smoke.yml | Staging smoke policies include `WITH CHECK`; migration/smoke scripts load `.env.local`; manual CI workflow exists | pnpm verify; pnpm release:audit | `v2:staging-smoke-new-tables` and `rls:staging-smoke-command` audits pass |
| R008 | verified | Codex | T029 | lib/ai/rate-limit.ts, lib/ai/provider.ts, supabase/migrations/0004_ai_rate_limit_usage.sql, .env.example | Multi-instance deployments can opt into Supabase-backed shared AI rate limiting while local default stays in-process | pnpm test; pnpm typecheck; pnpm release:audit | `ai:shared-rate-limit-schema` and `ai:free-tier-limits` audits pass |
| R009 | verified | Codex | R007 | staging/production Supabase environments | Apply migrations 0002/0003 to staging and production, then run live staging RLS smoke | psql migration execution and staging RLS smoke SQL | `0002/0003` applied on both configured targets; staging RLS smoke returned all cross-org counts = `0` |

## Blockers
| ID | Task | Blocker | Needed decision | Owner |
|---|---|---|---|---|
| B001 | T003 | Dependencies may not be installed in this sandbox and network is restricted | Resolved by pnpm install | Codex |
| B004 | browser smoke | Dev server background start fails in this sandbox with Node/Windows `spawn EINVAL` | Run dev server in a normal terminal or rely on `pnpm build` until sandbox spawn is fixed | Human |

## Review Notes
| Task | Reviewer | Result | Follow-up |
|---|---|---|---|
| T001-T016 | Codex | pass | Historical implementation remains verified; see previous ledger evidence in git history for full per-task notes. |
| T017-T030 | Codex | pass | Local implementation and verification complete. Human/environment follow-up: apply migrations to staging/production and run live `pnpm rls:staging`. |

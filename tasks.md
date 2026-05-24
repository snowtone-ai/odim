# tasks.md -- pm-zero v9.5 Execution Ledger

## Goal Binding
- Active goal: Build Odim repository from context and pm-zero v9.5.
- Planning owner: Codex CLI
- Implementation owner: Codex CLI
- Review owner: Codex CLI

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
| T004 | verified | Codex | T003 | lib/pipeline/**, scrapers/**, supabase/**, config/**, .github/**, tests/** | Replace demo ingestion with first real FERC/SEC/building-permit sources while preserving idempotency and audit logs | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | tests pass; typecheck passes; verify passes; scrape dry-run emits 3 raw signals / 10 ontology objects / 7 links / 20 audit events; build passes |
| T005 | verified | Codex | T004 | scrapers/**, lib/pipeline/**, config/**, tests/**, supabase/** | Add remaining Reality Layer adapters (compute, water, raw_materials, logistics) and narrative trigger ingestion without treating narrative as truth | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | tests pass; typecheck passes; verify passes; scrape dry-run emits all 7 Reality Layers + narrative trigger; build passes |
| T006 | verified | Codex | T005 | lib/pipeline/alert.ts, lib/pipeline/**, supabase/**, tests/** | Generate source-backed alerts with confidence/evidence and alert_created audit events while keeping narrative as a trigger only | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | scrape dry-run emits 8 raw signals / 20 ontology objects / 12 links / 5 alerts / 45 audit events; narrative test proves no ontology promotion |
| T007 | verified | Codex | T006 | app/api/**, lib/data.ts, lib/repositories/**, lib/supabase/**, tests/** | Replace static mock API responses with repository-backed data reads that use Supabase when configured and deterministic source-backed fallback data only when DB env is absent | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | tests pass; typecheck passes; verify passes; dry-run remains stable; build includes /api/audit and repository-backed routes |
| T008 | verified | Codex | T007 | app/api/huginn/**, lib/huginn/**, lib/munin/**, lib/ai/**, tests/**, supabase/** | Implement org-scoped Huginn/Munin query flow with scoped memory retrieval, source-backed ontology/audit context, confidence, sources, and reasoning trace | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | tests pass; typecheck passes; verify passes; dry-run stable; build passes; org leakage test proves other-org Munin memory is excluded |
| T009 | verified | Codex | T008 | app/api/**, lib/repositories/**, lib/supabase/**, tests/**, supabase/** | Add org-aware API filtering so service-role reads cannot leak org-scoped alerts, ontology objects, or Munin-derived context across tenants | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | tests pass; typecheck passes; verify passes; dry-run stable; build passes; repository filters public-or-org for alerts/entities/audit |
| T010 | verified | Codex | T009 | app/**, components/**, lib/i18n/**, tests/**, .env.example | Add Japanese/English i18n foundation and remove hard-coded screen/navigation copy from the 8 product screens where practical | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | tests pass; typecheck passes; verify passes; dry-run stable; build passes; all 8 dashboard screens and shell use typed i18n messages |
| T011 | verified | Codex | T010 | components/ui/shell.tsx, components/ui/screen.tsx, app/(dashboard)/alerts/page.tsx, app/globals.css, tests/** | Make the shell and Signal Alerts usable on mobile while preserving desktop analyst layout | pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | tests pass; typecheck passes; verify passes; dry-run stable; build passes; static tests prove mobile shell and single-column alerts layout |
| T012 | verified | Codex | T011 | scripts/**, package.json, tests/**, tasks.md | Add a release audit gate that codifies Phase F requirements and fails on missing critical launch-readiness controls | pnpm release:audit; pnpm test; pnpm typecheck; pnpm verify; pnpm scrape:dry-run; pnpm build | release:audit passes 35 checks; tests pass; typecheck passes; verify passes; dry-run stable; build passes |
| T013 | verified | Codex | T012 | app/(dashboard)/**, components/**, lib/data.ts, lib/repositories/**, tests/** | Replace remaining placeholder dashboard panels with source-backed product surfaces for the 8 screens, prioritizing Entity, Capital Flow, Huginn, Watchlist, Audit, and Settings | pnpm test; pnpm typecheck; pnpm verify; pnpm release:audit; pnpm scrape:dry-run; pnpm build; browser smoke | tests pass; typecheck passes; verify passes; release:audit passes 37 checks; dry-run stable; build passes; browser smoke passed for /alerts mobile, /entity, /huginn with no console errors |
| T014 | verified | Codex | T013 | app/api/**, app/(dashboard)/settings/page.tsx, lib/auth/**, lib/repositories/**, supabase/**, tests/** | Add commercial auth/org management surfaces and API key management primitives without requiring paid services, preserving env-based Supabase migration path | pnpm test; pnpm typecheck; pnpm verify; pnpm release:audit; pnpm scrape:dry-run; pnpm build | tests pass; typecheck passes; verify passes; release:audit passes 44 checks; dry-run stable; build passes with /api/settings and /api/api-keys |
| T015 | verified | Codex | T014 | docs/**, scripts/**, app/**, lib/**, supabase/**, .env.example, tests/** | Perform a requirement-by-requirement Phase F §4 commercial-readiness audit, close code/doc/env-gate gaps that can be solved locally, and explicitly record any human-only launch gates | pnpm test; pnpm typecheck; pnpm verify; pnpm release:audit; pnpm scrape:dry-run; pnpm build; browser smoke | tests pass; typecheck passes; verify passes; release:audit passes 49 checks; dry-run stable; build passes; browser/API smoke passed for /settings, mobile /alerts, /api/alerts, and /api/huginn |
| T016 | verified | Codex | T015 | supabase/**, lib/api/**, lib/auth/**, lib/ai/**, lib/repositories/**, lib/pipeline/**, scrapers/**, config/**, scripts/**, tests/**, docs/**, .env.example, styles/**, components/**, app/(dashboard)/map/page.tsx | Remediate pre-release review findings: raw_signals RLS, org-scoped AI rate buckets, production fail-closed auth, required API key pepper, API key verification rate limit, no scope-leak auth errors, production no-fallback Supabase failures, infrastructure rate-limit launch gate, stronger release audit, paid-source org binding, executable staging RLS smoke, service_role write grants, and design-token consistency | pnpm test; pnpm typecheck; pnpm release:audit; pnpm verify; pnpm scrape:dry-run; pnpm build | tests pass 38/38; typecheck passes; release:audit passes 59 checks with structural RLS/auth checks, service_role write grants, API key auth rate limit, no scope-leak auth errors, production no-fallback checks, infrastructure rate-limit launch gate, and executable staging RLS smoke command; verify passes; scrape dry-run emits 8 raw / 20 objects / 12 links / 5 alerts / 45 audit events; build passes |

## Blockers
| ID | Task | Blocker | Needed decision | Owner |
|---|---|---|---|---|
| B001 | T003 | Dependencies may not be installed in this sandbox and network is restricted | Resolved by pnpm install | Codex |

## Review Notes
| Task | Reviewer | Result | Follow-up |
|---|---|---|---|
| T001 | Codex | pass | Keep context/source-* as canonical product source material. |
| T002 | Codex | pass | Full production data integrations remain T004+. |
| T003 | Codex | pass | package versions were verified with npm registry on 2026-05-24. |
| T004 | Codex | pass | FERC feed URL remains env-configured because FERC public export endpoints vary; adapter accepts JSON/CSV and dry-run covers parser/idempotency/audit behavior. |
| T005 | Codex | pass | All 7 Reality Layers now have configured adapters; live collection remains env-gated by SCRAPE_ENABLED=true. |
| T006 | Codex | pass | Alert generation is deterministic and source-backed; narrative alerts do not create ontology objects or links. |
| T007 | Codex | pass | API reads Supabase when configured; otherwise returns deterministic ingestion-fixture fallback, not hand-authored mock rows. |
| T008 | Codex | pass | Huginn requires orgId, retrieves only org-scoped Munin memories, returns reasoning trace/sources/confidence, and prepares/persists recall memory when write env is configured. |
| T009 | Codex | pass | API repository applies app-layer public-or-org filters, including audit_log.org_id, so service-role reads do not rely on RLS alone. |
| T010 | Codex | pass | English/Japanese message catalog is tested; shell and all 8 screens consume i18n messages via NEXT_PUBLIC_DEFAULT_LOCALE. |
| T011 | Codex | pass | Shell uses mobile horizontal nav and desktop fixed sidebar; Signal Alerts uses mobile single-column layout before desktop split. |
| T012 | Codex | pass | release:audit codifies Phase F controls and currently passes 35 checks. It is a gate, not proof that all Phase F UX/commercial criteria are complete. |
| T013 | Codex | pass | Remaining dashboard placeholders were replaced with source-backed surfaces. Browser smoke checked /alerts mobile, /entity, and /huginn; no console errors/warnings were reported. |
| T014 | Codex | pass | Commercial admin primitives now include hashed/redacted API keys, org/member/settings surfaces, alert rules, Supabase RLS/schema path, and fallback behavior when migrations are not applied locally. |
| T015 | Codex | pass | Phase F §4 requirements now have a commercial-readiness matrix, free-tier Gemini guard, scoped API key route gate, schema-missing fallback behavior, and config-only paid source ingestion path. |
| T016 | Codex | pass | Pre-release review findings were closed locally, and staging Supabase RLS evidence now records `cross_org_*` probes as all `0` (manual SQL Editor execution on 2026-05-24). `pnpm rls:staging`, static SQL/app-layer/security tests, and release audit guard against regression. |

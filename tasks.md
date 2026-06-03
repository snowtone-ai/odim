# tasks.md

## Completed Ledger: AI Native Upgrade 1+2

### AI-NATIVE-001 — Reality GraphRAG Decision Workbench
- Owner: CEO Agent
- Depends On: `docs/vision.md`, `lib/pipeline/types.ts`, existing Huginn cascade, entity dashboard data, API auth/rate-limit helpers
- Write Scope: `lib/graphrag/**`, `lib/repositories/evidence-graph.ts`, `lib/huginn/**`, `app/api/graphrag/**`, `app/api/v1/evidence-graph/**`, `app/(dashboard)/entity/page.tsx`, `components/ui/entity-workstation.tsx`, `components/ui/huginn-console.tsx`, `lib/i18n/messages.ts`, focused tests
- Standard Applied: source-backed citations, measurable trace completeness/citation coverage, org-scoped reads, deterministic fallback, no unsupported narrative-as-truth
- Acceptance:
  - Evidence graph materializes entities, signals, alerts, audits, sources, and ontology links into scored nodes/edges.
  - Query API returns ranked evidence paths with confidence, citation coverage, trace completeness, and source refs.
  - Huginn includes an `evidence_graph` retrieval layer, evidence paths in context, and visible trace output.
  - Entity workstation surfaces top evidence paths for the selected entity without blocking current workflows.
- Verification:
  - Focused graph build/query metrics and Huginn integration tests added in `tests/ai-native-upgrades.test.mjs`.
  - Review hardening passed: `rtk pnpm test` (100/100), `rtk pnpm typecheck`, `rtk pnpm lint`, `rtk pnpm build`, `rtk pnpm verify`, `rtk pnpm browser:smoke`.
- Evidence: implemented `lib/graphrag/**`, repository/API integration, Huginn `evidence_graph` cascade/context output, Entity/Huginn UI panels, i18n labels, bounded citation/trace metrics, bounded BFS fanout, false-positive edge suppression, entity-scoped metrics, and TTL graph caching.

### AI-NATIVE-002 — Agentic Watchtower Workflows
- Owner: CEO Agent
- Depends On: alerts repository/data, API auth/rate-limit helpers, Supabase migrations, settings and alerts dashboard surfaces
- Write Scope: `lib/watchtower/**`, `lib/repositories/watchtower.ts`, `app/api/watchtower/**`, `app/api/v1/watchtower/**`, `app/(dashboard)/alerts/page.tsx`, `app/(dashboard)/settings/page.tsx`, `components/ui/alerts-workstation.tsx`, `components/ui/watchtower-workflows.tsx`, `supabase/migrations/0010_ai_native_workflows.sql`, `supabase/migrations/0011_watchtower_hardening.sql`, `scripts/apply-db-migrations.mjs`, focused tests
- Standard Applied: predefined workflow paths, human approval gates before dispatch, durable run/step/approval trace, bounded local fallback, production fail-closed semantics
- Acceptance:
  - Three production-shaped playbooks exist for data center buildout, water-rights stress, and incentive/subsidy watch.
  - Runs include scoped steps, graph retrieval, contradiction check, approval gate, dispatch step, risk flags, trace metrics, and source refs.
  - APIs can list, start, approve/reject, and rerun Watchtower runs with validation and scoped auth.
  - Alerts and Settings expose Watchtower run state and approval actions.
  - Supabase migration adds append-only workflow persistence tables with RLS.
- Verification:
  - Focused tests added for run generation, approval transitions, rerun behavior, and migration registration/RLS checks.
  - Review hardening passed: `rtk pnpm test` (100/100), `rtk pnpm typecheck`, `rtk pnpm lint`, `rtk pnpm build`, `rtk pnpm verify`, `rtk pnpm browser:smoke`.
- Evidence: implemented `lib/watchtower/**`, repository/API integration, Alerts/Settings Watchtower UI, append-only Supabase migrations `0010_ai_native_workflows.sql` and `0011_watchtower_hardening.sql`, optimistic revision locking for Supabase approval updates, in-process local-store write serialization, bounded local fallback storage, sanitized API errors, auth-disabled org override gates, migration runner inclusion, and API-backed browser smoke coverage.

### Coordination Notes
- Git safety point: `backup/pre-ai-native-upgrade-20260603-154106` at pre-update HEAD plus `stash@{0}` named `pre-ai-native-upgrade-20260603-154106`.
- Working branch used for implementation: `codex/ai-native-upgrades-1-2-20260603-154106`.
- Main adoption: ready after review hardening, Supabase SQL confirmation, browser recovery, README cleanup, and final verification.
- Delegation: `Sagan` explorer completed read-only touchpoint investigation. CEO owned overlapping implementation files to avoid same-file conflicts.

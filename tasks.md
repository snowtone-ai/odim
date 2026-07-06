# tasks.md

## Active Program: Launch Readiness (LP)

Goal: close the gap between "code-complete platform" and "marketable commercial product".
Ordered by launch impact per token. One LP task group per session.

### LP-000 — Baseline repair: failing mobile-layout test — DONE (this session)
- Owner: main agent
- Write Scope: `tests/mobile-layout.test.mjs`
- Acceptance: full test suite green on main baseline.
- Evidence: commit 3086b9f changed shell main margin to `+20px` without updating the test; test expectation aligned to implementation.

### LP-001 — Operational health endpoint — DONE (this session)
- Owner: main agent
- Write Scope: `app/api/health/route.ts`, `middleware.ts`, `tests/launch-surfaces.test.mjs`
- Acceptance: `GET /api/health` returns status/runtime/uptime/non-sensitive booleans, is SSO-exempt, never leaks secrets/URLs/key material.
- Verification: `tests/launch-surfaces.test.mjs` includes a secret-leak regex guard.

### LP-002 — Public landing page + shell scoping — DONE (this session)
- Owner: main agent
- Write Scope: `app/page.tsx`, `app/layout.tsx`, `app/(dashboard)/layout.tsx`, `tests/launch-surfaces.test.mjs`
- Acceptance: root `/` is a public marketing surface (hero, principles, layers, audiences, sources, CTA to `/login` and `/map`); dashboard Shell/CommandPalette move to `(dashboard)` group layout so `/` and `/login` render without the sidebar; `/` remains outside the SSO-protected path list.
- Verification: launch-surfaces tests + full suite + build.

### LP-002.1 — Stop build-time DB reads on dashboard pages — DONE (this session)
- Owner: main agent
- Write Scope: `app/(dashboard)/alerts/page.tsx`, `app/(dashboard)/entity/page.tsx`
- Finding: `/alerts` and `/entity` were statically prerendered while calling Supabase-backed repositories, so builds fetched live data and baked it into static HTML (stale + tenant-boundary risk; build fails entirely when Supabase is unreachable). `/settings` and `/huginn` were already `force-dynamic`.
- Fix: added `export const dynamic = "force-dynamic"` to both pages so repository reads happen per-request.

### LP-003 — Billing & plan entitlements (env-gated) — DONE (this session)
- Owner: main agent
- Risk: HIGH (billing class → Tier 2 review; no live Stripe activation — all Stripe behavior is env-gated and no real keys exist in the repo).
- Write Scope: `lib/billing/plans.ts`, `lib/billing/stripe.ts`, `lib/repositories/billing.ts`, `app/api/billing/checkout/route.ts`, `app/api/billing/webhook/route.ts`, `lib/auth/request.ts`, `middleware.ts`, `supabase/migrations/0012_billing_entitlements.sql`, `scripts/apply-db-migrations.mjs`, `app/(dashboard)/settings/page.tsx`, `components/ui/billing-panel.tsx`, `lib/i18n/messages.ts`, `.env.example`, `tests/billing.test.mjs`
- Acceptance:
  - Plan catalog (trial/pro/enterprise) with ascending entitlements; `org_billing` + append-only `billing_events` tables with RLS (org read-only; writes service-role only).
  - Checkout route authorizes `admin:write`, validates plan, fails closed (503) when Stripe env is absent; redirect URLs are always same-origin.
  - Webhook route verifies Stripe HMAC signatures (replay-window tolerance), is idempotent via unique `stripe_event_id`, and maps checkout/subscription lifecycle events to org billing state.
  - Entitlement gate in `authorizeApiRequest`: only when `BILLING_ENFORCED=true` — blocks canceled subscriptions/expired trials (403) and applies per-plan API rate ceilings (429). Local mode stays free/open.
  - Settings shows a Plan & Billing panel (en/ja) with env-gated upgrade buttons.
- Verification: `tests/billing.test.mjs` 7/7 (signature verify, event mapping, fail-closed routes, activity gate, middleware exemption, migration registration); full suite 111/111; typecheck/lint/build/verify green.
- Review Notes: Tier 2 fresh-context Opus review — PASS, no blockers. Applied recommendations: (1) compensating `releaseBillingEvent` delete when the post-record upsert fails, so Stripe retries can re-apply instead of being dropped by the idempotency guard; (2) checkout redirect base prefers `NEXT_PUBLIC_APP_URL` over request origin (reverse-proxy safety). Accepted-as-designed: entitlement cache invalidation is instance-local (≤60s TTL staleness across serverless instances); `isSubscriptionActive` relies on Stripe lifecycle events rather than `current_period_end` as a secondary guard (candidate for LP follow-up).

### LP-004 — Self-serve org onboarding — BACKLOG
- Risk: HIGH (auth class). Org creation flow, member invites, API key issuance UI in Settings, first-run guidance.

### LP-005 — Observability & error tracking — BACKLOG
- Structured request logging, env-gated Sentry (or equivalent) hook, error-rate visibility; extend `/api/health` with dependency latency probes.

### LP-006 — Public API docs surface — BACKLOG
- Publish `docs/api-reference.md` as a public `/docs` route from the landing page.

### LP-007 — Legal readiness pages — BACKLOG
- Terms, privacy, and security posture pages linked from landing footer (content approval is a human gate).

### LP-008 — Landing SEO/meta polish — BACKLOG
- OG metadata, sitemap.xml, robots.txt, per-page titles.

## Completed Ledger: AI Native Upgrade 1+2

### AI-NATIVE-001 — Reality GraphRAG Decision Workbench
- Owner: main agent
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
- Owner: main agent
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

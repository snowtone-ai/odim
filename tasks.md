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

### LP-004 — Self-serve org onboarding — DONE (this session)
- Owner: main agent
- Risk: HIGH (auth class → Tier 2 review class; self-serve signup is env-gated and fail-closed by default).
- Write Scope: `supabase/migrations/0013_org_onboarding.sql`, `scripts/apply-db-migrations.mjs`, `lib/onboarding/invites.ts`, `lib/onboarding/signup.ts`, `lib/repositories/onboarding.ts`, `lib/repositories/billing.ts`, `lib/auth/sso.ts`, `lib/api/rate-limit.ts`, `middleware.ts`, `app/api/orgs/route.ts`, `app/api/org-invites/**`, `app/signup/page.tsx`, `app/invite/page.tsx`, `app/login/page.tsx`, `app/page.tsx`, `app/(dashboard)/settings/page.tsx`, `components/ui/{api-key-manager,org-members-panel,signup-form,invite-accept-form}.tsx`, `lib/i18n/messages.ts`, `.env.example`, `tests/org-onboarding.test.mjs`
- Acceptance:
  - `org_invites` table (migration 0013, append-only) stores HMAC-hashed invite tokens only, RLS enabled (org read; service-role writes); `users` gains an `email` column with unique (org_id, email) partial index.
  - `POST /api/orgs`: public self-serve signup, fail-closed 503 unless `SELF_SERVE_SIGNUP=true`, per-IP + global rate limits, input validation, creates org + admin user + 14-day trial billing with compensating cleanup; issues a `selfserve` SSO session only when SSO is enabled.
  - `/api/org-invites`: admin:read list / admin:write create+revoke; seat-ceiling gate only when `BILLING_ENFORCED=true`; `/api/org-invites/accept` redeems a token exactly once (atomic claim), returns generic 401 for unknown/revoked/expired tokens, 503 without pepper.
  - Middleware SSO exemptions limited to `/api/orgs` and `/api/org-invites/accept`.
  - Settings: API key issuance UI (one-time token display, scope picker, revoke), members & pending-invites panel (one-time invite link), first-run Getting Started checklist; public `/signup` and `/invite` pages; landing/login signup links.
- Verification: `tests/org-onboarding.test.mjs` 10/10 (token lifecycle, fail-closed signup, rate limiting incl. spoof-resistant client IP, single-use accept, revocation, pepper 503, middleware/migration registration); full suite 121/121; typecheck/lint/build/verify green; gitleaks clean.
- Review Notes: Tier 2 class run as fresh-context Sonnet review at high effort (Opus substitution per budget rule — recorded). Verdict PASS-with-recommendations; blockers fixed in follow-up commit: (1) rate-limit client key now resists x-forwarded-for spoofing and adds instance-wide global buckets; (2) public signup/accept 500s no longer echo internal error messages; (3) `invitedBy` audit metadata capped. Accepted-as-designed: SSO session secret fallback to `API_KEY_PEPPER` (pre-existing design), service-role read client with app-layer org filters (D-011), compensating deletes instead of DB transactions (repo idiom), no email-ownership verification at signup (env-gated surface; email verification is an LP follow-up candidate).
- Human gate: applying migration 0013 to production Supabase (`pnpm db:migrate:production`) and enabling `SELF_SERVE_SIGNUP` in any deployed environment remain operator actions.

### LP-005 — Observability & error tracking — DONE (this session)
- Owner: main agent
- Risk: MEDIUM (new external call class → Tier 1 review; no auth/billing/schema changes).
- Write Scope: `lib/observability/{logger,metrics,error-tracking,instrument,probes}.ts`, `app/api/health/route.ts`, `app/api/observability/route.ts`, `app/api/v1/**` (9 routes wrapped), `.env.example`, `tests/observability.test.mjs`
- Acceptance:
  - Structured single-line JSON logs with secret-field-name and token-shape redaction; `api.request` logs (route/method/status/duration) on the instrumented surface, opt-out via `REQUEST_LOGGING=false`.
  - Env-gated Sentry-protocol error reporter (`SENTRY_DSN`, no SDK): envelope over fetch, 3s timeout, never throws, always logs locally, delivery failures logged visibly.
  - In-process per-route request/error counters (bounded: 200 routes + `(other)` overflow bucket, 20-entry error ring buffer, messages capped at 200 chars); aggregate totals + error rate on public `/api/health`, full per-route snapshot behind admin:read `/api/observability`.
  - `/api/health` gains a Supabase REST latency probe (HEAD, 1.5s timeout, booleans/latency only — no URLs or key material) and an `errorTracking` check.
  - All 9 `app/api/v1/**` routes wrapped by `instrumentApiRoute` with signatures preserved (Next route type checking unaffected); crashes convert to generic 500 JSON.
- Verification: `tests/observability.test.mjs` 12/12 (redaction incl. connection-string credentials, DSN parsing, envelope shape + envelope message scrubbing, no-throw delivery failure incl. TimeoutError, counter/ring-buffer bounds, instrumented pass-through + crash path, probe leak guard, health shape incl. existing secret-leak regex, admin snapshot, 401 when auth enforced); full suite 133/133; typecheck/lint/build/verify green; gitleaks clean.
- Review Notes: Tier 1 fresh-context Sonnet review — PASS-with-recommendations, no blockers. Applied: (1) Sentry envelope exception messages now scrubbed for token shapes and connection-string credentials; (2) added auth-failure test for `/api/observability`; (3) added TimeoutError (DOMException) delivery-failure test; (4) documented shallow redaction bound on `redactLogFields`; (5) corrected metrics bound comment to MAX_TRACKED_ROUTES + 1. Accepted-as-designed: local `app.error` logs keep raw messages (trusted sink); per-instance counters (D-027).
- Operator-gate follow-through (delegated 2026-07-06): migration 0013 apply attempted — blocked, Supabase tenant `xyvioekqwmbgrwlinzxe` not found for both staging/production URLs (see docs/issues.md); `SELF_SERVE_SIGNUP` decision recorded in D-028 (no deployed environment exists yet).

### LP-006 — Public API docs surface — DONE (this session)
- Owner: main agent
- Risk: LOW (public static content; no auth/schema/billing changes; middleware untouched).
- Write Scope: `lib/docs/markdown.ts`, `components/ui/public-shell.tsx`, `app/docs/page.tsx`, `app/page.tsx` (footer link), `tests/launch-surfaces.test.mjs`
- Acceptance: `/docs` publicly renders `docs/api-reference.md` (build-time read of repo-controlled content) via a minimal trusted-content markdown parser — headings, nested lists, fenced/inline code — rendered as React elements only (no `dangerouslySetInnerHTML`); linked from the landing footer; shares `PublicShell` chrome with legal pages.
- Verification: markdown parser unit tests incl. malformed input (unclosed fence, blank-only, odd indentation); docs-page source guard against raw HTML injection; real `api-reference.md` parses into substantive blocks.

### LP-007 — Legal readiness pages — DONE (this session)
- Owner: main agent
- Risk: LOW-MEDIUM (public content; no code-path risk; content itself is operator-gated).
- Write Scope: `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/security/page.tsx`, `components/ui/public-shell.tsx`, `app/page.tsx` (footer links), `tests/launch-surfaces.test.mjs`
- Acceptance: Terms of Service (incl. no-investment-advice/no-reliance clauses, API acceptable use, liability cap), Privacy Policy (data categories, processors: Supabase/Stripe/AI providers/error tracking, retention, APPI/GDPR rights), and Security posture page (RLS tenant isolation, hashed keys, CSP, fail-closed defaults, disclosure policy) — all linked from the landing footer, no placeholders.
- Verification: tests assert pages exist with metadata, `Last updated` dates, no TODO/lorem/placeholder, and footer links present.
- Human gate (outstanding): operator approval of legal text before first public deploy — especially governing law/jurisdiction (drafted: Japan / Tokyo District Court), the absence of a published contact address (support-channel phrasing used), and processor disclosures matching the deployed configuration.

### LP-008 — Landing SEO/meta polish — DONE (this session)
- Owner: main agent
- Risk: LOW.
- Write Scope: `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`, per-page `metadata` exports on 13 pages (5 dashboard + custom + login/signup/invite + docs/terms/privacy/security), `tests/launch-surfaces.test.mjs`
- Acceptance: root layout gains `metadataBase` (from `NEXT_PUBLIC_APP_URL`), title template `%s — Odim`, OG + twitter cards using `/odim-logo.png`; `sitemap.xml` lists public routes only; `robots.txt` disallows `/api/`, all dashboard prefixes, and token-carrying `/invite`; every page exports a title.
- Verification: `sitemap()`/`robots()` called directly in tests (same-origin absolute URLs, gated-path exclusion, sitemap pointer); layout source asserts OG/twitter/template.

#### LP-006/007/008 combined session record (branch `feat/lp-006-008-public-surfaces`)
- Verification: full suite 143/143 (launch-surfaces 14 tests: +9 new, +1 review follow-up); typecheck/lint/build/verify green; `gitleaks git --log-opts="main..HEAD"` clean (2 repo-wide findings are pre-existing synthetic fixture tokens in `tests/observability.test.mjs`, commit f7b3159 — candidate for `.gitleaksignore`).
- Review Notes: Tier 1 fresh-context Sonnet review (300+ line diff) — PASS-with-recommendations, no blockers. Applied: (1) malformed-markdown termination tests; (2) fence language regex widened to `[\w+-]*`; (3) prose section keys switched to index. Accepted-as-designed: `/login`/`/signup` remain in sitemap (public acquisition surfaces).

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

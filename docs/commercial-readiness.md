# Commercial Readiness Audit

Scope: `context/source-08-roadmap.md` Phase F §4, plus Phase F common gates.
Status authority: `tasks.md` verification evidence. This document records the requirement-to-evidence map; it is not a substitute for passing commands.

## Phase F §4 Matrix

| Requirement | Status Target | Authoritative Evidence |
|---|---|---|
| Requirement 1: all 8 screens are complete at `source-07-design.md` quality | Local code gate | `app/(dashboard)/*/page.tsx`, `styles/tokens.css`, `components/ui/*`, `tests/no-placeholder-surfaces.test.mjs`, `pnpm release:audit`, browser smoke |
| Requirement 2: all 7 Reality Layers have data pipelines | Local code gate | `config/sources.json`, `scrapers/*`, `lib/pipeline/*`, `tests/pipeline-ingestion.test.mjs`, `pnpm scrape:dry-run` |
| Requirement 3: Huginn/Munin works with org isolation | Local code gate plus staging RLS smoke | `app/api/huginn/route.ts`, `lib/huginn/query.ts`, `lib/munin/memory.ts`, `lib/api/org.ts`, `supabase/migrations/0001_initial.sql`, `tests/huginn-query.test.mjs`, `tests/security-controls.test.mjs` |
| Requirement 4: all reasoning has sources, confidence, and Audit Trail traceability | Local code gate | `lib/pipeline/audit.ts`, `lib/pipeline/alert.ts`, `lib/repositories/reality.ts`, `app/(dashboard)/audit/page.tsx`, `tests/pipeline-ingestion.test.mjs`, `tests/no-placeholder-surfaces.test.mjs` |
| Requirement 5: runs inside free tiers for Gemini Flash / Supabase / Vercel | Local code gate plus env discipline | `lib/ai/rate-limit.ts`, `.env.example`, `package.json`, `pnpm build`; Gemini 2.5 Flash defaults are capped at 10 RPM / 250,000 TPM / 250 RPD per org/model bucket. Google AI rate-limit docs checked on 2026-05-24: https://ai.google.dev/gemini-api/docs/rate-limits |
| Requirement 6: commercialization requires only `.env` key replacement and paid source entries in `config/sources.json` | Local code gate | `.env.example`, `config/sources.json`, `scrapers/configured-source.ts`, `scrapers/run.ts`, `tests/pipeline-ingestion.test.mjs`; paid feeds must set `orgIdEnv` so proprietary raw signals remain tenant-scoped |

## Common Quality Gates

| Gate | Evidence |
|---|---|
| Anti-slop design checklist | `styles/tokens.css`, `app/globals.css`, `components/ui/shell.tsx`, `pnpm release:audit`, browser smoke |
| Every inference/data item has `source_refs` | `lib/pipeline/normalize.ts`, `lib/pipeline/ontologize.ts`, `lib/pipeline/audit.ts`, `tests/pipeline-ingestion.test.mjs` |
| Org isolation and RLS are preserved | `supabase/migrations/0001_initial.sql`, `lib/api/org.ts`, `lib/auth/request.ts`, `tests/repository-fallback.test.mjs`, `tests/api-keys.test.mjs`, `tests/security-controls.test.mjs`; includes `raw_signals_public_or_org` RLS and app-layer raw signal visibility filter |
| Free-tier rate limits are not exceeded by default | `AI_RATE_LIMIT_TIER=free`, `AI_MAX_RPM=10`, `AI_MAX_RPD=250`, `AI_MAX_TPM=250000`, `lib/ai/rate-limit.ts`; buckets are org-and-model scoped |
| Production API auth fails closed | `lib/auth/request.ts`, `lib/auth/api-keys.ts`, `.env.example`, `tests/api-keys.test.mjs`; Vercel production env forces API key auth, `API_KEY_PEPPER`, failed API key verification rate limits, and scope-safe permission errors that do not disclose scope names |
| Production Supabase failures do not fall back to demo data | `lib/env/runtime.ts`, `lib/repositories/reality.ts`, `lib/repositories/admin.ts`, `lib/huginn/query.ts`, `tests/repository-fallback.test.mjs`, `tests/huginn-query.test.mjs`; `ODIM_RUNTIME_ENV=production` or Vercel production env disables schema/read/write fallback |
| Narrative is not mixed into Reality truth | `lib/pipeline/ontologize.ts`, `tests/pipeline-ingestion.test.mjs` |
| Glossary language remains consistent | Dashboard copy is centralized in `lib/i18n/messages.ts`; product terms remain Odim/Huginn/Munin/Reality Layer/Audit Trail |

## Human-Only Launch Gates

These are deployment operations, not code changes:

- Apply `supabase/migrations/0001_initial.sql` to the target Supabase project.
- Set `.env` values in Vercel/Supabase/GitHub Actions from `.env.example`, including `AUTH_REQUIRED=true` for commercial API routes.
- Set a high-entropy `API_KEY_PEPPER`; API key auth returns 503 when auth is enforced without it.
- Configure infrastructure-level API auth rate limiting for production, such as Vercel Edge Middleware, Vercel Firewall, Cloudflare WAF, API Gateway, or Redis-backed shared throttling. The in-process limiter is a fail-safe, not the only commercial control.
- Ensure `service_role` has write grants by running `supabase/tests/service-role-write-grants.sql` in Supabase SQL Editor if a bootstrap API key write returns `permission denied for table api_keys`.
- Issue an initial admin API key with `pnpm issue:bootstrap-api-key` or seed an admin user in Supabase.
- Replace or add production source URLs/API keys in `config/sources.json` and environment variables.
- For every paid configured source, set its `orgIdEnv` value so proprietary `raw_signals` are visible only to the owning org.
- In Supabase staging, run `pnpm rls:staging` with `SUPABASE_STAGING_DATABASE_URL` and verify cross-org SELECT counts are all `0`; paste the result in Staging RLS Evidence below.
- Approve production deployment, billing settings, privacy terms, and any handling of personal or regulated data.

## Final Verification Snapshot

Recorded after T016 pre-release review remediation:

| Gate | Result |
|---|---|
| `pnpm test` | 38 tests passed |
| `pnpm typecheck` | passed |
| `pnpm release:audit` | 59 checks passed |
| `pnpm scrape:dry-run` | 8 raw / 20 objects / 12 links / 5 alerts / 45 audit events |
| `pnpm verify` | structural checks passed |
| `pnpm build` | production build passed |
| Browser/API smoke | `/settings` desktop, `/alerts` mobile, `/api/alerts`, and `/api/huginn` passed with no console errors |

## Staging RLS Evidence

Status: completed on 2026-05-24 (manual SQL Editor execution, because local `psql` was unavailable).

Run after applying `supabase/migrations/0001_initial.sql` to the staging Supabase project.

Preferred command:

```bash
SUPABASE_STAGING_DATABASE_URL="postgresql://..." pnpm rls:staging
```

The command uses `psql -v ON_ERROR_STOP=1`, so SQL typos, missing tables/policies, and non-zero cross-org counts fail the release gate. The underlying SQL file is:

```sql
\i supabase/tests/rls-cross-org-smoke.sql
```

Required result:

| Probe | Expected |
|---|---|
| `cross_org_raw_signals` | `0` |
| `cross_org_alerts` | `0` |
| `cross_org_api_keys` | `0` |
| `cross_org_audit_log` | `0` |
| `cross_org_munin_memory` | `0` |

Evidence to record before commercial release:

| Field | Value |
|---|---|
| Staging project | `xyvioekqwmbgrwlinzxe` |
| Migration applied at | `2026-05-24 21:33:40 +09:00` |
| Smoke test run at | `2026-05-24 21:33:40 +09:00` |
| Operator | `chidj` |
| `cross_org_raw_signals` | `0` |
| `cross_org_alerts` | `0` |
| `cross_org_api_keys` | `0` |
| `cross_org_audit_log` | `0` |
| `cross_org_munin_memory` | `0` |
| Result artifact | Supabase SQL Editor run of `supabase/tests/rls-cross-org-smoke.sql` |

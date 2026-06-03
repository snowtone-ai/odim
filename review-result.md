# Code Review: AI Native Upgrade 1+2 — Evidence GraphRAG + Agentic Watchtower

**Reviewer**: Senior Full-Stack Engineer (production review)
**Branch**: `codex/ai-native-upgrades-1-2-20260603-154106`
**Scope**: 49 files, +3891 / −596 lines
**Date**: 2026-06-03

---

## 1. Executive Summary

This PR introduces two major subsystems: (1) an Evidence GraphRAG decision workbench that materializes entities, signals, alerts, and audit events into scored, source-backed evidence paths, and (2) an Agentic Watchtower workflow engine with playbook-driven runs, human approval gates, and multi-store persistence. Both integrate into the Huginn reasoning cascade, entity intelligence, alerts, and settings UI.

**Overall Assessment**: The architecture is well-decomposed — pure-function workflow logic is separated from repository I/O, API routes follow auth→validate→execute ordering, and the migration has appropriate RLS policies. The core evidence graph algorithm and state machine are correct for the current data scale. However, there are several issues that would cause real production incidents under scale, concurrency, or partial-deployment scenarios.

**Merge Recommendation**: **Approve with follow-ups** (see §6)

### Top 3 Risks

1. **Watchtower approval race condition**: `updateWatchtowerApproval` does read-then-mutate-then-write without optimistic concurrency control. Two simultaneous approval decisions will silently lose one write.
2. **Evidence graph materialization is O(N²) and unbounded**: `buildEvidenceGraph` cross-joins all signals × objects for every query, with no caching or limit. At 500+ objects × 500+ signals this becomes a blocking bottleneck on every Huginn query and entity page load.
3. **Fallback/production behavior split on write path**: `startWatchtowerRun` calls `assertSupabaseWriteEnv()` then immediately falls through to local file write when env is missing — the assertion is a no-op in non-production, creating a silent data loss path when `NODE_ENV` is misconfigured.

---

## 2. Findings

### F-01: Watchtower approval TOCTOU race condition
- **Severity**: Critical
- **Affected files**: `lib/repositories/watchtower.ts:264-281`
- **Problem**: `updateWatchtowerApproval` reads the full run list, finds the run, applies the approval in-memory, then writes back. There is no `revision` check or optimistic lock. If two users approve different actions on the same run concurrently, the second write overwrites the first.
- **Why it matters**: In a multi-user approval workflow this is the exact scenario the feature is designed for. Losing an approval decision silently is a data integrity violation.
- **Concrete failure scenario**: User A approves "Send Slack report" and User B approves "Create board brief" simultaneously. Both read revision 1. Both write back revision 1 with their single change. The second write wins; the first approval is lost. The run may remain in `waiting_approval` indefinitely.
- **Recommended fix**: For Supabase: use the `revision` column as an optimistic lock. Add `WHERE revision = $expected` to the upsert and retry on conflict. For local store: use file locking or compare-and-swap on the revision field before writing.

### F-02: Evidence graph O(N²) cross-join on every request
- **Severity**: High
- **Affected files**: `lib/graphrag/evidence-graph.ts:299-330`, `lib/repositories/evidence-graph.ts:187-193`
- **Problem**: `buildEvidenceGraph` iterates all signals and for each signal checks all objects via `signalMentionsObject`. This is O(signals × objects). Then `queryRealityEvidenceGraph` calls `buildEvidenceGraph` fresh on every invocation — no caching, no TTL, no memoization. The Huginn cascade calls this, AND the entity page calls `buildEvidenceWorkbench` which calls it once per entity.
- **Why it matters**: At the current fixture scale (~50 objects, ~100 signals) this is fast. At 500×500 (the Supabase query limits) it's 250,000 string comparisons per request. With `buildEvidenceWorkbench` calling it once per entity, a page with 50 entities triggers 50 full graph builds.
- **Concrete failure scenario**: With 500 objects and 500 signals, the entity page load takes several seconds of CPU time. Under concurrent load this starves the Next.js server.
- **Recommended fix**: (1) Cache the built graph per `(orgId, planHash)` with a 30-60 second TTL. (2) In `buildEvidenceWorkbench`, build the graph once and reuse it across entity queries (partially done — the graph is built once, but `queryEvidenceGraph` re-traverses it per entity). (3) Long-term: pre-compute the evidence graph during ingestion.

### F-03: `collectPaths` BFS has unbounded queue growth
- **Severity**: High
- **Affected files**: `lib/graphrag/evidence-graph.ts:514-544`
- **Problem**: The BFS in `collectPaths` starts from up to 4 anchor nodes and fans out to 8 edges per step, up to depth 3. That's 4 × 8³ = 2048 queue entries worst case. However, the early termination checks `paths.length < limit * 4` (max 48), not queue size. The `seen` set deduplicates edge-id paths but not intermediate queue entries. For a dense graph with many edges, the queue can grow to thousands of entries before paths are fully built.
- **Why it matters**: This is a latency and memory concern at scale, not a correctness issue.
- **Concrete failure scenario**: A densely-connected entity (e.g. a major company with 100+ signals and 50+ links) causes the BFS to explore thousands of paths, adding hundreds of milliseconds to response time.
- **Recommended fix**: Add a queue size limit (e.g., 512) and/or reduce the fan-out factor for dense graphs.

### F-04: RLS policy allows `org_id IS NULL` rows to be visible to ALL authenticated users
- **Severity**: High
- **Affected files**: `supabase/migrations/0010_ai_native_workflows.sql:69-78`
- **Problem**: The RLS policy `watchtower_runs_public_or_org` grants read/write access to any authenticated user when `org_id IS NULL`. This means any run created without an org_id is globally visible and editable by any tenant.
- **Why it matters**: If a Watchtower run is accidentally created with `org_id = NULL` (which the code allows — `run.orgId ?? null` in the workflow builder), any authenticated user can approve, reject, or rerun it. The `WITH CHECK` clause also allows any user to write `org_id = NULL` rows.
- **Concrete failure scenario**: An admin starts a Watchtower run without specifying an orgId. A user in a different org sees the run, approves it, and triggers an external dispatch (Slack report, webhook) they shouldn't have access to.
- **Recommended fix**: Either (1) make `org_id NOT NULL` in the migration and require it at the API layer, or (2) restrict the `WITH CHECK` clause to only allow service_role to write NULL org_id rows, or (3) add a separate "public" flag rather than overloading NULL.

### F-05: API route `POST /api/watchtower/runs` allows orgId override without strict check
- **Severity**: High
- **Affected files**: `app/api/watchtower/runs/route.ts:40-44`
- **Problem**: The orgId override check only fires when `auth.mode !== "disabled"`. When auth is disabled (development, or if `AUTH_REQUIRED=false`), any caller can specify any orgId and start Watchtower runs scoped to other tenants.
- **Why it matters**: If a staging or demo environment has auth disabled, the API is completely open to cross-tenant operations.
- **Concrete failure scenario**: A staging environment with `AUTH_REQUIRED=false` allows an external caller to start runs with `orgId` belonging to another customer's org.
- **Recommended fix**: Log a warning when auth is disabled and an orgId override is used. Consider requiring a specific env flag to allow cross-org operations rather than silently allowing it.

### F-06: No `updated_at` trigger on Watchtower tables
- **Severity**: Medium
- **Affected files**: `supabase/migrations/0010_ai_native_workflows.sql`
- **Problem**: The `updated_at` column on `watchtower_runs` defaults to `now()` on insert but has no trigger to auto-update it on subsequent writes. The application code sets `updatedAt` explicitly, but direct Supabase writes (admin console, migration scripts, other services) will leave stale `updated_at` values.
- **Why it matters**: `updated_at` is used for ordering (`ORDER BY updated_at DESC`) — stale values cause runs to appear in wrong positions in the dashboard.
- **Concrete failure scenario**: An admin manually updates a run's status in the Supabase dashboard. The `updated_at` stays at creation time. The run appears buried under newer runs.
- **Recommended fix**: Add a trigger: `CREATE TRIGGER update_watchtower_runs_updated_at BEFORE UPDATE ON watchtower_runs FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);` (if moddatetime extension is available), or a simple function that sets `NEW.updated_at = now()`.

### F-07: Evidence graph repository rebuilds entire graph for every query
- **Severity**: Medium
- **Affected files**: `lib/repositories/evidence-graph.ts:187-193`
- **Problem**: `queryRealityEvidenceGraph` calls `loadEvidencePlan` (5 Supabase queries) then `buildEvidenceGraph` (full materialization) then `queryEvidenceGraph`. This means every Huginn query and every graphrag API call triggers 5 DB reads + full graph build.
- **Why it matters**: The entity page calls `getEvidenceWorkbench` and Huginn calls `queryRealityEvidenceGraph` — both trigger independent full plan loads. A user viewing the entity page and then asking a Huginn question loads the full plan twice.
- **Concrete failure scenario**: Under moderate concurrent load (10 users), this creates 100+ Supabase reads per minute just for evidence graph queries.
- **Recommended fix**: Implement plan-level caching with a 30-60 second TTL keyed by orgId. The data is append-mostly and tolerance for staleness is reasonable.

### F-08: Local file store for Watchtower runs is not safe for concurrent access
- **Severity**: Medium
- **Affected files**: `lib/repositories/watchtower.ts:162-165`
- **Problem**: `writeLocalRuns` does `readFileSync` → modify in memory → `writeFileSync`. In a Next.js server with concurrent requests, two parallel writes will race and one will be lost.
- **Why it matters**: The local store is the fallback when Supabase is not configured. During development with multiple browser tabs, approval decisions can be lost.
- **Concrete failure scenario**: Developer opens two browser tabs, approves different items simultaneously, one approval is silently dropped.
- **Recommended fix**: Use a file lock (`proper-lockfile` or `fs.flock`) or switch to SQLite for local development persistence.

### F-09: `signalMentionsObject` uses substring match with 4-char minimum — false positives
- **Severity**: Medium
- **Affected files**: `lib/graphrag/evidence-graph.ts:248-253`
- **Problem**: The function checks if the first 18 characters of an object label (lowercased) appear anywhere in the signal's search text, with a 4-character minimum. Short generic entity names like "grid", "land", "water", "chip" will match many unrelated signals.
- **Why it matters**: False positive edges dilute the evidence graph — paths will include unrelated signals, reducing the trust value of citation coverage and trace completeness metrics.
- **Concrete failure scenario**: An entity named "Grid Systems Inc" has label prefix "grid" which matches every signal mentioning "power grid", "grid interconnection", etc., creating spurious evidence paths.
- **Recommended fix**: Increase the minimum match length to 6+ characters, or use word-boundary matching, or weight by match quality instead of treating all matches as binary.

### F-10: `loadEvidencePlan` asserts then falls through
- **Severity**: Medium
- **Affected files**: `lib/repositories/evidence-graph.ts:167-177`
- **Problem**: `assertSupabaseReadEnv()` throws in production when env is missing, but the very next line `if (!hasSupabaseReadEnv()) return fallback` would have caught it anyway. In non-production, the assertion is a no-op, and the function silently returns fallback data. This means the assertion has no effect — it either throws before the check would have caught it (production), or does nothing (development).
- **Why it matters**: Dead code that looks like a safety check gives false confidence.
- **Concrete failure scenario**: None directly, but this pattern is confusing for future maintainers.
- **Recommended fix**: Remove `assertSupabaseReadEnv()` and rely on the existing `hasSupabaseReadEnv()` check + `shouldFallbackFromSupabaseError()` logic, or restructure to make the assertion meaningful.

### F-11: Error messages in Watchtower API routes leak internal state
- **Severity**: Medium
- **Affected files**: `app/api/watchtower/approvals/route.ts:34-35`, `app/api/watchtower/rerun/route.ts:21-22`
- **Problem**: The catch block returns `error.message` directly in the response body. While 404 cases are handled, other errors (e.g., Supabase connection failures) will leak internal error messages containing table names, connection strings, or query details.
- **Why it matters**: Information leakage assists attackers in understanding the system architecture.
- **Concrete failure scenario**: A Supabase outage causes the error `connection refused to db-xyz.supabase.co:5432` to be returned in the API response.
- **Recommended fix**: Only return `error.message` for known error types (not found, validation). For all other errors, return a generic "Internal server error" and log the actual error server-side.

### F-12: Watchtower UI component uses optimistic state without rollback
- **Severity**: Medium
- **Affected files**: `components/ui/watchtower-workflows.tsx:111-160`
- **Problem**: `upsertRun` optimistically updates the local state with the server response. However, if a subsequent action fails (network error after the fetch completes but before state update), the UI can show stale data without a way to refresh.
- **Why it matters**: The dashboard shows approval status that may not reflect the actual server state.
- **Concrete failure scenario**: User approves an action, sees "approved" in UI, but the write failed. They navigate away and back, now see "pending" because the server never recorded the approval.
- **Recommended fix**: Add a "refresh" button or periodic polling to re-sync with server state. The error state is handled, but there's no recovery mechanism for stale reads.

### F-13: No index on `watchtower_runs.alert_id`
- **Severity**: Low
- **Affected files**: `supabase/migrations/0010_ai_native_workflows.sql`
- **Problem**: `alert_id` is a foreign key used in filtering (`WHERE alert_id = ?`) when looking up existing runs for a playbook, but has no index.
- **Why it matters**: As the watchtower_runs table grows, lookups by alert_id become full table scans.
- **Recommended fix**: Add `CREATE INDEX IF NOT EXISTS watchtower_runs_alert_id_idx ON watchtower_runs (alert_id);`

### F-14: `buildEvidenceWorkbench` returns entity-level metrics that are actually graph-level
- **Severity**: Low
- **Affected files**: `lib/graphrag/evidence-graph.ts:575-589`
- **Problem**: `buildEvidenceWorkbench` returns per-entity summaries where `metrics` is the result of `queryEvidenceGraph(graph, { entityId }).metrics` — but `queryEvidenceGraph` returns `graph.metrics` (the whole graph's metrics), not entity-scoped metrics.
- **Why it matters**: The UI displays "citation coverage" and "trace completeness" per entity, but these values are identical for all entities (they're the graph-level metrics).
- **Concrete failure scenario**: Users see the same citation coverage for every entity, reducing the informational value of the metric.
- **Recommended fix**: Compute entity-scoped metrics from the entity's specific paths rather than returning the global graph metrics.

### F-15: Browser smoke test doesn't verify new routes
- **Severity**: Low
- **Affected files**: `scripts/browser-smoke.mjs`
- **Problem**: The browser smoke test only adds Watchtower-related API routes implicitly through the page renders. It doesn't directly test `/api/watchtower/runs`, `/api/watchtower/approvals`, `/api/watchtower/rerun`, or `/api/graphrag/query`.
- **Why it matters**: API route regressions (import errors, type mismatches) won't be caught by smoke tests.
- **Recommended fix**: Add fetch calls to the smoke test for the new API routes (at minimum GET `/api/watchtower/runs`).

---

## 3. Future Failure Modes

### FM-01: Supabase schema partially applied (migration 0010 fails midway)
- **Trigger**: Network error during migration; `watchtower_runs` created but `watchtower_approvals` table not.
- **Impact**: Application starts, renders Watchtower UI, but approval actions fail with "relation does not exist". The `shouldFallbackFromSupabaseError` regex catches this for reads but not for writes (writes throw directly).
- **Prevention**: Wrap migration in a transaction (`BEGIN`/`COMMIT`). The current migration uses individual `CREATE TABLE IF NOT EXISTS` statements which are not atomic.

### FM-02: Graph data grows beyond Supabase row limits
- **Trigger**: The `readSupabasePlan` function uses `.limit(500)` for objects and signals, `.limit(250)` for alerts. Once the data exceeds these limits, the evidence graph silently becomes incomplete.
- **Impact**: Evidence paths and citation coverage metrics become unreliable — they reflect only the latest 500 signals, not the full corpus. Users see high citation coverage because only recent, well-cited signals are included.
- **Prevention**: Add cursor-based pagination and aggregate evidence graph incrementally, or raise limits with monitoring. At minimum, surface a warning in the UI when the limit is hit.

### FM-03: Multiple Watchtower playbooks trigger on the same alert simultaneously
- **Trigger**: All three playbooks share overlapping keywords and layers. A single alert about "data center water cooling" could trigger all three.
- **Impact**: Three independent runs with three independent approval flows for the same underlying event. Users must approve/reject 6+ actions.
- **Prevention**: Add deduplication logic — if an alert already has an active run, either skip or link the new run to the existing one.

### FM-04: Evidence graph and Huginn cascade return contradictory data
- **Trigger**: The evidence graph is built from `sourceBackedPlan` (static fixture) while Huginn's munin/gapfill layers query live data. If the fixture is stale relative to live Supabase data, the evidence graph paths will contradict the munin retrieval.
- **Impact**: The model receives conflicting context — evidence graph says X, munin memory says Y. This manifests as inconsistent answers and reduced user trust.
- **Prevention**: Ensure both layers use the same plan source. Currently the cascade calls `queryRealityEvidenceGraph` which loads its own plan — align this with the cascade's own data source.

### FM-05: `current_request_org_id()` function not defined or returns NULL
- **Trigger**: The RLS policies reference `current_request_org_id()`, a custom PostgreSQL function that must be set by the application layer before each request. If Supabase client configuration changes or the function is not set, all RLS policies evaluate `org_id = NULL`, making all NULL-org_id rows visible.
- **Impact**: All cross-org isolation breaks silently.
- **Prevention**: Add a startup check that `current_request_org_id()` is defined and returns the expected value for test requests.

### FM-06: Local `.odim/watchtower-runs.json` grows unbounded
- **Trigger**: Repeated reruns without cleanup. Each rerun adds a new run to the local store.
- **Impact**: File I/O becomes slow; `readFileSync` of a large JSON file blocks the event loop.
- **Prevention**: Add a cap (e.g., keep latest 100 runs) in `writeLocalRuns`.

### FM-07: Future playbook/workflow additions break hardcoded `step_key` CHECK constraint
- **Trigger**: Adding a new step type (e.g., `"enrichment"`) requires a migration to alter the CHECK constraint on `watchtower_run_steps.step_key`.
- **Impact**: Writes fail with constraint violation. The application code adds the step, the DB rejects it.
- **Prevention**: Use a separate `step_types` reference table instead of inline CHECK constraints, or document the migration requirement clearly.

---

## 4. Test Gaps (prioritized)

1. **Missing: Concurrent approval test** — Test that two simultaneous `applyApprovalDecision` calls on the same run produce correct results (currently they silently lose one).
2. **Missing: Cross-org isolation test** — Test that a Watchtower run with `orgId=A` is not visible to a user with `orgId=B` via the repository layer.
3. **Missing: API route integration test** — No test calls the actual HTTP endpoints for `/api/watchtower/runs`, `/api/watchtower/approvals`, `/api/watchtower/rerun`, `/api/graphrag/query`.
4. **Missing: Evidence graph scale test** — Test `buildEvidenceGraph` with 500 objects × 500 signals to verify latency is acceptable.
5. **Missing: Evidence graph with empty/missing data** — Test behavior when `plan.rawSignals` is empty, `plan.alerts` is empty, all source refs are missing.
6. **Missing: Fallback → Supabase transition** — Test that switching from fallback to Supabase doesn't create duplicate runs or lose local state.
7. **Missing: Migration rollback test** — No test verifies the migration can be reversed.
8. **Missing: `signalMentionsObject` false positive rate** — Property test with random strings to verify the substring match doesn't create excessive false edges.
9. **Brittle: Huginn evidence graph test depends on fixture data** — The test `"Huginn injects evidence graph paths"` passes only because `sourceBackedPlan` fixture has enough data to produce paths. If fixture data changes, the test breaks silently.
10. **Missing: UI error state rendering** — No test verifies the Watchtower UI renders correctly when API calls fail.

---

## 5. Operational Recommendations

### Monitoring
- **Add latency metric for `buildEvidenceGraph`** — Track P50/P99 execution time. Alert when P99 exceeds 500ms.
- **Add counter for Watchtower approval decisions** — Track approve/reject/rerun rates per playbook. Alert on rejected-run spikes (may indicate misconfigured playbooks).
- **Add counter for evidence graph cache misses** — Once caching is implemented, track cache hit rate.

### Logging
- **Log orgId on all Watchtower mutations** — Currently errors are logged but orgId is not included in the log context. Add structured logging with `{ runId, orgId, action, actor }`.
- **Log evidence graph path count and build time** — For capacity planning.
- **Log when fallback is used in production** — The `shouldFallbackFromSupabaseError` function silently falls back. In non-production this is fine; add a warning log for production.

### Alerting
- **Alert when `watchtower_runs` has runs stuck in `waiting_approval` for > 48 hours** — These are likely forgotten or misconfigured.
- **Alert when evidence graph build time exceeds 2 seconds** — Indicates data growth beyond the current architecture's capacity.
- **Alert on Watchtower API error rate > 5%** — Catches Supabase outages and schema mismatches.

### Runbook additions
- Document: "How to manually approve/reject a stuck Watchtower run via Supabase dashboard"
- Document: "How to force-rebuild the evidence graph cache"
- Document: "How to diagnose evidence graph false positive paths"

---

## 6. Merge Decision

**Approve with follow-ups**

**Rationale**: The core architecture is sound — the evidence graph algorithm is correct, the state machine is well-tested, RLS policies are properly scoped (with the noted NULL-org_id caveat), and the API routes follow the established auth/validate/execute pattern. The code is well-decomposed and testable.

The critical approval race condition (F-01) should be addressed before the Watchtower feature is used by multiple concurrent users, but does not block merge for single-user/demo usage. The O(N²) evidence graph (F-02) is acceptable at current fixture scale but needs caching before production data load.

**Required follow-ups before production traffic:**
1. Fix approval race condition with optimistic locking (F-01)
2. Add evidence graph caching/memoization (F-02, F-07)
3. Fix entity-level metrics returning graph-level values (F-14)
4. Add error message sanitization to API routes (F-11)

**Recommended follow-ups:**
5. Add `alert_id` index (F-13)
6. Add `updated_at` trigger (F-06)
7. Consider making `org_id NOT NULL` or restricting NULL-org_id writes (F-04)
8. Add concurrent approval and cross-org isolation tests (Test gaps 1-2)
9. Add BFS queue size limit (F-03)
10. Add API route smoke tests (F-15)

# decisions.md

## D-001: Keep context as canonical source material with source-* filenames
- Decision: Rename numbered context files to context/source-XX-*.
- Reason: pm-zero generates docs/vision.md, docs/decisions.md, and related files; source-* prevents future confusion while preserving canonical inputs.

## D-002: Hand-write the Next.js scaffold
- Decision: Create repository files directly instead of running create-next-app.
- Reason: Network access may be restricted. Direct scaffolding keeps progress deterministic.

## D-003: Use mock provider by default
- Decision: AI_PROVIDER defaults to mock; Gemini-compatible fetch is behind env configuration.
- Reason: Cost-zero principle and safe local verification. Production mode requires explicit env values.

## D-004: Keep full roadmap in tasks.md, but mark current implementation as scaffold complete
- Decision: T001-T002 cover repository and product skeleton; real source ingestion remains T004.
- Reason: A commercial product needs external credentials/data and package installation. The repository should be structurally complete before live integrations.

## D-005: Pin current package versions after registry verification
- Decision: Use Next.js 16.2.6, React 19.2.6, Tailwind CSS 4.3.0, and the current npm-published versions recorded in package.json.
- Reason: The user requested current versions, and npm registry lookups succeeded on 2026-05-24.

## D-006: Use stable Gemini model by default and expose latest alias separately
- Decision: Default AI_MODEL remains gemini-2.5-flash; AI_MODEL_LATEST_ALIAS documents gemini-flash-latest as the moving alias.
- Reason: Google documents stable, preview, latest, and experimental naming. Production should prefer stable model strings; latest aliases may be hot-swapped by Google.

## D-007: Use deterministic ingestion IDs and dry-run fixtures
- Decision: Raw signals, ontology drafts, links, and audit events use deterministic fingerprints/UUIDs; scrapers expose parser functions plus a dry-run runner.
- Reason: Daily public-source scraping must be idempotent, source-backed, and testable without live credentials or network access.

## D-008: Treat narrative alerts as triggers only
- Decision: Narrative records may create alert triggers and audit events, but they do not create ontology objects or causal links.
- Reason: Odim's source material defines Narrative as a divergence/trigger layer, not a truth source.

## D-009: Use repository-backed API routes with source-backed fallback
- Decision: API routes read Supabase when configured; local and CI environments without DB env return deterministic fallback data derived from the ingestion fixture pipeline, while production runtime fails closed instead of hiding Supabase read/write failures behind demo data.
- Reason: Local and CI verification must remain cost-zero, but commercial production must surface database/schema incidents rather than returning plausible fixture data.

## D-010: Enforce Huginn org scope in application logic
- Decision: Huginn requires orgId, retrieves only matching Munin memories, and prepares or persists recall memory under the same orgId.
- Reason: RLS is necessary but not sufficient for app-layer reasoning; Huginn must not even place cross-org memories into model context.

## D-011: Add app-layer public-or-org filters for service-role reads
- Decision: Repository reads apply explicit public-or-org filters for tenant-scoped tables, even when Supabase service role is available.
- Reason: Supabase service role can bypass RLS; commercial isolation must not depend on a single control plane.

## D-012: Keep i18n as a typed internal message catalog first
- Decision: Use a typed English/Japanese message catalog driven by NEXT_PUBLIC_DEFAULT_LOCALE before adding URL locale routing.
- Reason: This removes hard-coded UI copy and keeps build verification simple; URL/cookie locale switching can be layered on without rewriting screens.

## D-013: Mobile scope prioritizes Signal Alerts first
- Decision: Make the shell and Signal Alerts fully usable on small screens before attempting full mobile parity for complex map/ontology screens.
- Reason: The product spec says mobile is primarily for alert confirmation; complex Map/Ontology work remains PC-first.

## D-014: Dashboard surfaces must be source-backed, not placeholders
- Decision: Remaining dashboard panels derive visible metrics, flows, timelines, alerts, and traces from the ingestion fixture plan or repositories.
- Reason: Commercial-readiness requires every screen to demonstrate evidence, confidence, or auditability rather than static placeholder copy.

## D-015: Store API keys as hashes with redacted admin metadata
- Decision: API key issuance returns the secret once, stores only an HMAC-SHA256 token hash, requires `API_KEY_PEPPER` whenever API key auth is enforced, and exposes redacted key metadata through admin settings.
- Reason: Commercial admin surfaces need local verification without paid services while preserving a Supabase-backed production migration path and avoiding secret disclosure.

## D-016: Default AI calls stay inside Gemini Flash free-tier ceilings
- Decision: Gemini calls pass through an org-and-model-scoped in-process RPM/RPD/TPM guard, with `AI_RATE_LIMIT_TIER=free` clamping configured values to the Gemini 2.5 Flash free-tier defaults.
- Reason: Phase F requires free-tier operation by default; paid-tier behavior must be an explicit env change, not an accidental quota increase, and one tenant must not consume another tenant's bucket.

## D-017: Commercial source expansion is config-driven
- Decision: Keep custom public-source adapters, but add a `configured-json-csv` adapter for paid JSON/CSV feeds mapped through `config/sources.json`; paid configured feeds require `orgIdEnv` so proprietary raw signals remain RLS-visible only to the intended org.
- Reason: Business migration should require `.env` key changes and source config additions, not source-specific code rewrites, while preserving tenant isolation for proprietary feeds.

## D-018: API key auth is env-gated but wired into commercial routes
- Decision: API routes run open in local fallback mode by default, require scoped API keys when `AUTH_REQUIRED=true`, fail closed when Vercel production env is detected, and rate-limit repeated invalid API key verification attempts by client/prefix.
- Reason: Local zero-cost verification must remain easy, while commercial deployment must not leak tenant data if `AUTH_REQUIRED` is forgotten or expose unbounded API key brute-force attempts.

## D-019: raw_signals uses both RLS and app-layer visibility filters
- Decision: Add `raw_signals.org_id`, enable RLS, and allow reads only when `is_proprietary=false` or the authenticated user's org matches; repository reads apply the same filter before relying on Supabase RLS.
- Reason: Raw proprietary source payloads are the highest-leakage tenant boundary and service-role reads can bypass RLS.

## D-020: Huginn/Munin v2 uses structural separation instead of prompt-only safeguards
- Decision: Add writeGate, physically separate `munin_memory` facts/procedures/seeds from `munin_opinions`, keep `web_narrative` out of memory, and route Huginn through self-assessment plus cascade retrieval.
- Reason: The v2.0 spec treats narrative contamination and past-opinion sycophancy as architectural safety issues; prompt instructions alone are not sufficient for investment-grade reasoning.

## D-021: Canonicalize Huginn/Munin v2 in context
- Decision: Merge the former additional Huginn/Munin v2 spec into `context/source-05-huginn-munin.md` and remove `追加file` as a second source of truth.
- Reason: Implementation agents should read one canonical context folder; split spec locations caused stale v1/v2 references and repo-map ambiguity.

## D-022: Use optional shared AI rate limiting for multi-instance production
- Decision: Keep the in-process limiter as the local/default fail-safe, and add Supabase-backed `consume_ai_rate_limit` for deployments that set `AI_RATE_LIMIT_BACKEND=supabase`.
- Reason: Local verification must remain zero-config, but multi-instance production needs a shared quota counter to preserve Gemini free-tier ceilings across instances.

## D-023: Operate as a single Supabase environment for now
- Decision: Current deployment uses one Supabase project/branch (`main`, production-tagged). `SUPABASE_STAGING_DATABASE_URL` and `SUPABASE_PRODUCTION_DATABASE_URL` may intentionally point to the same database until a dedicated staging project exists.
- Reason: Team currently runs a single-environment operation; documenting this prevents false assumptions about staging/production separation during migrations and smoke tests.

## D-024: Make evidence retrieval graph-native before model-native
- Decision: Add a deterministic Evidence GraphRAG layer that materializes entities, raw signals, alerts, audit events, sources, and ontology links into scored paths before Huginn sends context to a model.
- Reason: Investment-grade AI needs inspectable citations, trace completeness, and org-scoped fallback behavior. A graph layer keeps source support auditable instead of relying on unstructured prompt context.

## D-025: Gate Watchtower automation with human approvals and durable traces
- Decision: Implement Watchtower as predefined source-backed playbooks with run, step, approval, risk, and source-ref records; external dispatch remains blocked until all requested human approvals pass.
- Reason: Agentic workflows can create operational risk. Approval gates, RLS-backed persistence, reruns, and trace metrics align automation with reliability, security, and reviewability requirements.

## D-026: Self-serve onboarding is env-gated with hashed single-use invite tokens
- Decision: Public org signup requires `SELF_SERVE_SIGNUP=true` (fail-closed 503 otherwise); member invites store only peppered HMAC token hashes, are claimed atomically exactly once, and sessions issued by signup/accept use a distinct `selfserve` provider tag. Seat ceilings bind only when `BILLING_ENFORCED=true`.
- Reason: Commercial onboarding must not widen the enterprise SSO/API-key attack surface by default; token-as-credential endpoints stay SSO-exempt but rate-limited (spoof-resistant client key + global buckets) and indistinguishable-on-failure.

## D-027: Observability is SDK-free, env-gated, and in-process
- Decision: Structured JSON request logs (secret-name and token-shape redaction, `REQUEST_LOGGING=false` opt-out), a Sentry-protocol error reporter over plain fetch gated on `SENTRY_DSN` (3s timeout, never throws, local log always emitted), and bounded in-process per-route counters surfaced as aggregates on public `/api/health` and in full behind admin:read `/api/observability`. The v1 API surface is wrapped by `instrumentApiRoute`.
- Reason: No new dependencies or vendor lock; fail-visible external delivery; per-instance counters are an accepted bound for a pre-launch product. Route names and error messages stay behind admin scope while the public health probe exposes only booleans, latencies, and totals.

## D-028: Operator gates executed by agent on operator instruction (practice product)
- Decision: The operator delegated LP-004 human gates (2026-07-06). Migration 0013 application was attempted but is blocked: both staging and production DSNs point at Supabase tenant `xyvioekqwmbgrwlinzxe`, which the pooler reports as not found (project deleted or paused). `SELF_SERVE_SIGNUP` stays `false` in `.env.example` (fail-closed template); it should be set `true` per deployed environment once one exists — no linked deployment (no `.vercel`/`vercel.json`) exists today.
- Reason: This is a non-launching practice product; the operator granted decision authority. Restoring or recreating the Supabase project requires dashboard authentication, which remains a human task.

## D-029: Rebuild the UI as a continuous evidence workspace
- What: Replace the black/gold, rounded-panel presentation with the six-color Field/Surface/Text/Signal/Evidence/Critical system and the layout, typography, motion, and surface contracts in `DESIGN.md`. Organize each route as one working canvas plus at most one contextual inspector; the Evidence Thread is the shared Source-to-Action visual primitive.
- Why: The target analyst's job is a continuous detect-to-verify-to-act flow. Nested cards, globally interrupting notification permission, disconnected map styling, and stacked mobile panes increase cognitive and interaction cost while making the product read as a generic generated dashboard.
- Evidence: Repository/browser audits across all five routes and public landing; Palantir Blueprint's dark neutral strata, blue operational intent, compact geometry, and focus treatment; Palantir's object-aware application guidance that centers object views, linked objects, discovery, analysis, and workflow-specific actions.
- Trade-off: This is a broad presentation-layer change and requires visual regression review. Server/data contracts and persisted state are deliberately preserved, so map demo data and repository-backed entity/alert projections remain separate until a later contract task.

## D-030: Add fewer, verifiable primary sources instead of counting configured feeds
- What: Add SEC Form D as a live, tested `cash`-layer source that emits an honest `capital_raise_candidate`; keep it distinct from proven physical investment until corroborated. Source-health language must distinguish configured, live-verified, fixture-only, skipped, and failed states where available.
- Why: The 37 configured sources overstate operational coverage: several enabled fetchers return an empty live result, and many high-value physical sources depend on optional feed URLs. Form D adds a distinct upstream capital-commitment signal without presenting narrative data as reality evidence.
- Evidence: Source audit of `config/sources.json`, `scrapers/run.ts`, fetcher dispatch, fixtures, workflow inputs, and official SEC Form D/developer policy. NYISO load interconnection data is the next justified addition after existing RTO feeds become operational.
- Trade-off: One source does not make coverage comprehensive. SEC fair-access requirements and filing-shape drift require conservative parsing, rate limits, fixtures, and explicit provenance; existing RTO live connectivity remains follow-up work.

## D-031: Make Huginn bounded and grounded; make Muninn temporal and review-gated
- What: Run Huginn as a typed, deadline-bounded state machine with parallel fault-isolated retrieval, reciprocal-rank fusion, claim-level citation accounting, one bounded repair, and explicit abstention. Run provider calls through a bounded singleflight/cache/circuit/rate-limit runtime whose native request shapes are contract-tested. Store Muninn knowledge as append-only, org-scoped temporal records; Dream and gap fill may create immutable proposals only, and an org administrator must approve a proposal before it can create active memory or supersede earlier records.
- Why: Investment research cannot treat a fluent answer, an expired memory, or an autonomous consolidation as truth. A hard 15-second ceiling, evidence ledger, fail-closed production readers, temporal validity (`valid_from <= as_of < valid_to`), and database compare-and-swap review transitions turn latency, provenance, and human approval into enforceable boundaries rather than prompt instructions.
- Evidence: `lib/huginn/orchestrator/`, `lib/ai/runtime/`, `lib/munin/{memory,proposals,dream}.ts`, the admin review route/actions, migration `0015_huginn_muninn_v3.sql`, and focused provider/orchestrator/temporal tests. Production reads use the authenticated organization and Supabase temporal/hybrid search; deterministic fixtures remain local/CI-only.
- Trade-off: Provider, database, or citation failures now produce a visible safe failure or abstention instead of a plausible fallback answer. Review adds operator work, but rejected proposals stay rejected across retries and no autonomous job can silently activate or retire memory.

## D-032: Treat motion, brand assets, and latency as product contracts
- What: Adopt the six-color Palantir-informed operational palette, compact geometry, and continuous workspace rules in `DESIGN.md`; avoid nested card grids, glow, glass, and decorative gradients. Use generated Odim/Huginn marks optimized for 16px recognition, and an attributed MIT three-dot fade for Huginn's fixed-height thinking state. Keep motion to opacity/transform with reduced-motion equivalents, preserve composer drafting during inference, prefetch high-intent routes, and lazy-load map-heavy code.
- Why: Trust is shaped by navigation continuity, predictable focus, honest wait states, and response speed as much as by visual polish. Fixed geometry prevents layout shift; restrained 120/180/280ms motion preserves context; explicit source attribution and a non-blocking composer keep long AI work from feeling frozen.
- Evidence: `DESIGN.md`, `styles/tokens.css`, shared shell/dialog/thinking components, generated assets in `public/brand/`, `THIRD_PARTY_NOTICES.md`, browser reviews at desktop and 390px, and UI/performance contract tests.
- Trade-off: The product intentionally favors dense operational clarity over ornamental variety. Raster marks require explicit alpha-bounds/color/size checks, and browser interaction review remains necessary because source-string tests cannot prove computed layout, focus trapping, or perceived motion.

## D-033: Bound initial information and author Japanese as a first-class product language
- What: Apply the cognitive-load contract in `DESIGN.md`: no more than four attention groups or four row facts before drill-down, one selected detail surface, summary-before-evidence-before-operations, and list/detail progression on mobile. Reframe Huginn around the familiar history/conversation/composer pattern and make Map direction explicit through source-to-destination motion with a static reduced-motion cue. Treat Japanese as authored interface copy across visible and accessible product strings rather than a partial literal translation.
- Why: Entity and Alert density currently obscures priority, dash motion does not communicate edge direction, Settings opens on a non-actionable checklist, and English literals break the Japanese experience. Working-memory evidence and established platform guidance favor stable hierarchy and progressive disclosure; familiar chat structure lowers relearning cost without weakening Odim's grounded-evidence contract.
- Evidence: Cowan (2001), NN/g cognitive-load and complex-application guidance, Apple HIG design/disclosure/list guidance, official ChatGPT and Claude documentation showing persistent chat histories/projects around a central conversation, and MapLibre's line/point animation and line-placement specifications. Implementation and browser evidence are tracked by PUX-002.
- Trade-off: Secondary detail requires one extra explicit action, and Japanese UI strings require continued parity checks. Original source titles, entity names, identifiers, and user content remain untranslated to preserve provenance.

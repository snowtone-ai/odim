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

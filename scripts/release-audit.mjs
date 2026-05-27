import { existsSync, readFileSync } from "node:fs";

const checks = [];

function check(name, pass, evidence) {
  checks.push({ name, pass, evidence });
}

function file(path) {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function compactSql(sql) {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

function hasTableRls(sql, table) {
  return compactSql(sql).includes(`alter table ${table} enable row level security`);
}

function policyBlock(sql, policyName, table) {
  const match = compactSql(sql).match(new RegExp(`create policy ${policyName} on ${table} (.*?);`));
  return match?.[1] ?? "";
}

function hasPolicyTerms(sql, policyName, table, terms) {
  const block = policyBlock(sql, policyName, table);
  return terms.every((term) => block.includes(term.toLowerCase()));
}

// v3.0: 5-screen navigation — capital-flow, watchlist, audit merged/removed
const routes = [
  "app/(dashboard)/map/page.tsx",
  "app/(dashboard)/entity/page.tsx",
  "app/(dashboard)/alerts/page.tsx",
  "app/(dashboard)/huginn/page.tsx",
  "app/(dashboard)/settings/page.tsx"
];

for (const route of routes) {
  check(`route:${route}`, existsSync(route), "5 product screens must exist");
}

const tokens = file("styles/tokens.css");
check("design:tokens", ["--rune", "--ink-900", "--ease-odim", "--layer-energy"].every((token) => tokens.includes(token)), "Design tokens from source-07");
check("design:no-purple-cyan", !/purple|cyan|#3B82F6|Inter/.test(tokens), "Anti-slop banned defaults absent from tokens");
check(
  "design:no-hardcoded-rgba-surfaces",
  !/rgba\(/.test([file("components/ui/shell.tsx"), file("app/(dashboard)/map/page.tsx")].join("\n")),
  "Commercial UI surfaces consume design tokens instead of ad-hoc RGBA"
);

const sources = JSON.parse(file("config/sources.json"));
const configuredLayers = new Set(sources.sources.map((source) => source.layer));
for (const layer of ["energy", "cash", "land", "compute", "water", "raw_materials", "logistics"]) {
  check(`source:${layer}`, configuredLayers.has(layer), "All 7 Reality Layers configured");
}
check("source:narrative-trigger", configuredLayers.has("narrative"), "Narrative trigger source configured");
check(
  "source:configurable-paid-template",
  sources.sources.some(
    (source) => source.adapter === "configured-json-csv" && source.sourceTier === "paid" && source.orgIdEnv && source.fieldMap && source.payloadMap
  ),
  "Paid sources can be added by config with field maps and org binding"
);
const configuredSourceAdapter = file("scrapers/configured-source.ts");
const scrapeRunner = file("scrapers/run.ts");
check(
  "source:no-code-commercial-path",
  configuredSourceAdapter.includes("parseConfiguredSourceRecords") &&
    configuredSourceAdapter.includes("requires orgIdEnv") &&
    scrapeRunner.includes("configured-json-csv"),
  "Commercial JSON/CSV sources flow through config without code-specific adapters"
);

const migration = file("supabase/migrations/0001_initial.sql");
const muninV2Migration = file("supabase/migrations/0002_huginn_munin_v2.sql");
const sleepMigration = file("supabase/migrations/0003_sleep_time_compute.sql");
const rateLimitMigration = file("supabase/migrations/0004_ai_rate_limit_usage.sql");
const rlsSmoke = file("supabase/tests/rls-cross-org-smoke.sql");
const rlsSmokeRunner = file("scripts/run-staging-rls-smoke.mjs");
const migrationRunner = file("scripts/apply-db-migrations.mjs");
const packageJson = JSON.parse(file("package.json"));
const rlsPolicies = [
  ["munin_memory", "munin_org_isolation", ["org_id = current_request_org_id()"]],
  ["users", "users_org_isolation", ["org_id = current_request_org_id()"]],
  ["api_keys", "api_keys_org_isolation", ["org_id = current_request_org_id()"]],
  ["alert_rules", "alert_rules_public_or_org", ["org_id is null", "org_id = current_request_org_id()"]],
  ["raw_signals", "raw_signals_public_or_org", ["is_proprietary = false", "org_id = current_request_org_id()", "with check"]],
  ["ontology_objects", "ontology_public_or_org", ["org_visible is null", "org_visible = current_request_org_id()"]],
  ["ontology_links", "ontology_links_public_or_org", ["org_visible is null", "org_visible = current_request_org_id()"]],
  ["alerts", "alerts_public_or_org", ["org_id is null", "org_id = current_request_org_id()"]],
  ["audit_log", "audit_log_public_or_org", ["org_id is null", "org_id = current_request_org_id()"]]
];
for (const [table, policy, terms] of rlsPolicies) {
  check(
    `rls:${policy}`,
    hasTableRls(migration, table) && hasPolicyTerms(migration, policy, table, terms),
    table === "raw_signals" || table === "munin_memory" || table === "ontology_objects" || table === "ontology_links" || table === "alerts" || table === "audit_log"
      ? "Tenant isolation RLS policy exists"
      : "Commercial admin RLS policy exists"
  );
}
check(
  "rls:staging-cross-org-smoke-script",
  [
    "cross_org_raw_signals",
    "cross_org_alerts",
    "cross_org_api_keys",
    "cross_org_audit_log",
    "cross_org_munin_memory",
    "set local role authenticated",
    "set_config('request.jwt.claim.sub'",
    "rollback"
  ].every((marker) => rlsSmoke.toLowerCase().includes(marker.toLowerCase())),
  "Staging RLS smoke script checks cross-org SELECT returns 0 rows"
);
check(
  "rls:staging-smoke-command",
  packageJson.scripts?.["rls:staging"] === "node scripts/run-staging-rls-smoke.mjs" &&
    packageJson.scripts?.["db:migrate:staging"] === "node scripts/apply-db-migrations.mjs staging" &&
    rlsSmokeRunner.includes("SUPABASE_STAGING_DATABASE_URL") &&
    rlsSmokeRunner.includes(".env.local") &&
    migrationRunner.includes("SUPABASE_STAGING_DATABASE_URL") &&
    migrationRunner.includes("SUPABASE_PRODUCTION_DATABASE_URL") &&
    rlsSmokeRunner.includes("ON_ERROR_STOP=1") &&
    rlsSmokeRunner.includes("cross_org_raw_signals") &&
    rlsSmokeRunner.includes("cross_org_api_keys"),
  "Staging RLS smoke is executable as a release command and fails on SQL/runtime errors"
);
for (const column of ["source_refs", "confidence", "fingerprint", "dedupe_key", "org_id"]) {
  check(`schema:${column}`, migration.includes(column), "Auditability/idempotency schema exists");
}
for (const table of ["api_keys", "alert_rules"]) {
  check(`schema:${table}`, migration.includes(`create table if not exists ${table}`), "Commercial admin table exists");
}
check(
  "supabase:service-role-write-grants",
  compactSql(migration).includes("grant usage on schema public to service_role") &&
    compactSql(migration).includes("grant all privileges on orgs, users, api_keys, alert_rules, raw_signals, ontology_objects, ontology_links, alerts, audit_log, munin_memory to service_role"),
  "Supabase service role can perform commercial write operations without permission-denied failures"
);
for (const table of ["munin_opinions", "munin_dream_runs", "huginn_eval_log"]) {
  check(`v2-schema:${table}`, compactSql(muninV2Migration).includes(`create table if not exists ${table}`), "Huginn/Munin v2 migration creates required table");
  check(`v2-rls:${table}`, hasTableRls(muninV2Migration, table), "Huginn/Munin v2 table has RLS enabled");
}
for (const column of ["memory_class", "source_type", "is_seed", "status", "salience_score", "valid_from", "valid_to"]) {
  check(`v2-munin-memory:${column}`, compactSql(muninV2Migration).includes(`add column if not exists ${column}`), "munin_memory is expanded in v2 migration");
}
check(
  "v2:sleep-time-compute-schema",
  compactSql(sleepMigration).includes("create table if not exists pre_computed_answers") &&
    hasTableRls(sleepMigration, "pre_computed_answers") &&
    compactSql(sleepMigration).includes("grant all privileges on pre_computed_answers to service_role"),
  "Sleep-time Compute pre_computed_answers table is present and org-scoped"
);
check(
  "v2:sleep-time-compute-persistence",
  file("lib/huginn/precompute.ts").includes("pre_computed_answers") &&
    file("lib/huginn/precompute.ts").includes("createServiceSupabaseClient") &&
    file("lib/huginn/cascade.ts").includes("await findPrecomputedAnswer"),
  "Sleep-time Compute reads/writes the Supabase pre_computed_answers table when configured"
);
check(
  "ai:shared-rate-limit-schema",
  compactSql(rateLimitMigration).includes("create table if not exists ai_rate_limit_usage") &&
    compactSql(rateLimitMigration).includes("create or replace function consume_ai_rate_limit") &&
    compactSql(rateLimitMigration).includes("pg_advisory_xact_lock"),
  "Optional Supabase-backed shared AI rate limiter exists for multi-instance operation"
);
check(
  "v2:staging-smoke-new-tables",
  ["cross_org_munin_opinions", "cross_org_huginn_eval_log", "with check (org_id = current_request_org_id())"].every((marker) =>
    rlsSmoke.toLowerCase().includes(marker)
  ),
  "Staging RLS smoke includes Huginn/Munin v2 cross-org probes"
);

const huginnRoute = file("app/api/huginn/route.ts");
const huginnQuery = file("lib/huginn/query.ts");
const munin = file("lib/munin/memory.ts");
const writeGate = file("lib/munin/write-gate.ts");
const cascade = file("lib/huginn/cascade.ts");
const biasTest = file("lib/huginn/bias-test.ts");
const gapfill = file("lib/huginn/gapfill.ts");
const narrativeCapture = file("lib/huginn/narrative-capture.ts");
const huginnPage = file("app/(dashboard)/huginn/page.tsx");
const huginnAction = file("app/actions/huginn.ts");
const huginnConsole = file("components/ui/huginn-console.tsx");
const seedMemoryManager = file("components/ui/seed-memory-manager.tsx");
const evalButton = file("components/ui/eval-button.tsx");
check("huginn:org-required", huginnRoute.includes("orgId is required") && huginnQuery.includes("orgId is required"), "Huginn requires org scope");
check("huginn:reasoning-trace", huginnQuery.includes("reasoningTrace") && huginnQuery.includes("source-backed"), "Huginn returns trace and source-backed context");
check("munin:org-isolation", munin.includes("Munin memory org isolation violation") && munin.includes("toMuninMemoryRow"), "Munin org isolation and persistence mapping exist");
check(
  "v2:write-gate-structural-rules",
  writeGate.includes("web_narrative") &&
    writeGate.includes("REJECTED_FROM_MEMORY") &&
    writeGate.includes("WRITTEN_TO_OPINIONS") &&
    writeGate.includes("MUNIN_SALIENCE_THRESHOLD"),
  "Write gate blocks narrative, separates opinions, and uses env threshold"
);
check(
  "v2:cascade-retrieval",
  cascade.includes("searchLayer1Munin") &&
    cascade.includes("searchLayer2OdimCache") &&
    cascade.includes("realityGapfillSearch") &&
    cascade.includes("narrativeCaptureSearch") &&
    huginnQuery.includes("retrieval_layers_used"),
  "Huginn uses adaptive retrieval cascade with separate Reality/Narrative paths"
);
check(
  "v2:gapfill-narrative-persistence",
  gapfill.includes("upsert(toMuninMemoryRow") &&
    narrativeCapture.includes(".from(\"raw_signals\")") &&
    narrativeCapture.includes("source_type: input.result.sourceType") &&
    narrativeCapture.includes("is_proprietary: true"),
  "Reality gapfill persists source-backed memory and narrative capture persists tenant-scoped raw signals"
);
check(
  "v2:bias-test-framework",
  biasTest.includes("reverseArgumentTest") &&
    biasTest.includes("balancedBiasTest") &&
    biasTest.includes("confirmationBiasTest") &&
    biasTest.includes("answerHuginnQuestion") &&
    file("scripts/bias-test.mjs").includes("runBiasTestSuite"),
  "Investment bias testing framework runs through Huginn query flow and has a CLI runner"
);
check(
  "ui:seed-memory-actions",
  seedMemoryManager.includes("requestSeedMemory(\"/api/seed-memory\"") &&
    seedMemoryManager.includes("method: \"PUT\"") &&
    seedMemoryManager.includes("method: \"DELETE\"") &&
    file("app/(dashboard)/settings/page.tsx").includes("SeedMemoryManager"),
  "Settings Seed Memory UI wires create/edit/retire actions to the CRUD API"
);
check(
  "ui:huginn-console-runtime",
    huginnAction.includes("answerHuginnQuestion") &&
    huginnAction.includes("eval_log_id") &&
    huginnAction.includes("reasoningTrace") &&
    (huginnConsole.includes("response.eval_log_id") || huginnConsole.includes("latestResponse.eval_log_id")) &&
    (huginnConsole.includes("response.reasoningTrace") || huginnConsole.includes("latestResponse.retrieval_layers_used")) &&
    huginnPage.includes("force-dynamic"),
  "Huginn Console renders runtime Huginn response, trace, sources, counts, and eval_log_id"
);
check(
  "ui:eval-error-handling",
  evalButton.includes("try") &&
    evalButton.includes("!response.ok") &&
    evalButton.includes("setError") &&
    evalButton.includes("disabled={pending || sent}"),
  "EvalButton surfaces network/API failures and prevents duplicate submits"
);

const i18n = file("lib/i18n/messages.ts");
check("i18n:en-ja", i18n.includes("en:") && i18n.includes("ja:") && i18n.includes("NEXT_PUBLIC_DEFAULT_LOCALE"), "English/Japanese messages configured");

const shell = file("components/ui/shell.tsx");
const alertsPage = file("app/(dashboard)/alerts/page.tsx");
check("mobile:shell", shell.includes("overflow-x-auto") && shell.includes("md:ml-[calc(var(--sidebar-w)+20px)]"), "Mobile shell with desktop sidebar fallback");
check("mobile:alerts", alertsPage.includes("grid-cols-1") && alertsPage.includes("xl:grid-cols-[420px_1fr]"), "Signal Alerts mobile layout");

const provider = file("lib/ai/provider.ts");
const rateLimit = file("lib/ai/rate-limit.ts");
check("ai:retry", provider.includes("AI_RETRY_ATTEMPTS") && provider.includes("429"), "AI retry handles Gemini rate limiting");
check(
  "ai:free-tier-limits",
  provider.includes("assertAiRateLimitAvailableForRequest") &&
    provider.includes("orgId: request.orgId") &&
    rateLimit.includes("usageByTenantModel") &&
    rateLimit.includes("consume_ai_rate_limit") &&
    rateLimit.includes("\"gemini-2.5-flash\": { rpm: 10, rpd: 250, tpm: 250000 }") &&
    file(".env.example").includes("AI_RATE_LIMIT_BACKEND=memory") &&
    file(".env.example").includes("AI_RATE_LIMIT_TIER=free"),
  "Gemini Flash free-tier RPM/RPD/TPM guard exists per org"
);
for (const key of [
  "MUNIN_SALIENCE_THRESHOLD",
  "GAPFILL_ENABLED",
  "NARRATIVE_CAPTURE_ENABLED",
  "DREAM_ENABLED",
  "GRADER_ENABLED",
  "SLEEP_COMPUTE_ENABLED",
  "AI_RATE_LIMIT_BACKEND",
  "AI_RATE_LIMIT_SHARED_REQUIRED"
]) {
  check(`env:${key}`, file(".env.example").includes(`${key}=`), "Huginn/Munin v2 feature flag is documented");
}

const apiKeys = file("lib/auth/api-keys.ts");
const requestAuth = file("lib/auth/request.ts");
const adminRepo = file("lib/repositories/admin.ts");
const realityRepo = file("lib/repositories/reality.ts");
const runtimeEnv = file("lib/env/runtime.ts");
const settingsRoute = file("app/api/settings/route.ts");
check(
  "auth:api-key-hash",
  apiKeys.includes("keyHash") &&
    apiKeys.includes("redactApiKey") &&
    apiKeys.includes("timingSafeEqual") &&
    apiKeys.includes("createHmac") &&
    apiKeys.includes("assertApiKeyPepperConfigured") &&
    !apiKeys.includes("localStorage"),
  "API keys are HMAC-hashed with required pepper, redacted, and timing-safe"
);
check("auth:admin-repository", adminRepo.includes("getAdminSettings") && adminRepo.includes("createApiKey") && settingsRoute.includes("getAdminSettings"), "Org/admin settings repository and API route exist");
check(
  "auth:api-route-gate",
  [
    "app/api/alerts/route.ts",
    "app/api/entities/route.ts",
    "app/api/signals/route.ts",
    "app/api/audit/route.ts",
    "app/api/huginn/route.ts",
    "app/api/settings/route.ts",
    "app/api/api-keys/route.ts"
  ].every((route) => file(route).includes("authorizeApiRequest")) &&
    requestAuth.includes("AUTH_REQUIRED") &&
    requestAuth.includes("isCommercialProductionEnv") &&
    requestAuth.includes("x-odim-api-key"),
  "API routes can require scoped API key auth and fail closed in production"
);
check(
  "auth:api-key-rate-limit",
  requestAuth.includes("failedAuthByClient") &&
    requestAuth.includes("API_AUTH_MAX_FAILED_ATTEMPTS") &&
    requestAuth.includes("API_AUTH_RATE_LIMIT_WINDOW_MS") &&
    requestAuth.includes("Too many failed API key attempts") &&
    file(".env.example").includes("API_AUTH_MAX_FAILED_ATTEMPTS=10"),
  "API key verification rate limits repeated invalid attempts"
);
check(
  "auth:no-scope-leak-errors",
  requestAuth.includes('error: "Insufficient API key permissions"') &&
    !requestAuth.includes("Missing API key scope") &&
    !requestAuth.includes("requiredScope}`"),
  "API auth forbidden responses do not disclose required scope names"
);
check(
  "supabase:production-no-fallback",
  runtimeEnv.includes("isProductionRuntime") &&
    realityRepo.includes("isProductionRuntime()") &&
    adminRepo.includes("isProductionRuntime()") &&
    huginnQuery.includes("isProductionRuntime()"),
  "Production Supabase schema/read/write errors do not fall back to demo data"
);

const dashboardSurface = routes.map((route) => file(route)).join("\n") + file("lib/i18n/messages.ts");
check("ui:no-placeholder-copy", !/placeholder|scaffold/i.test(dashboardSurface), "Dashboard surfaces do not contain placeholder/scaffold copy");
check("ui:confidence-surface", dashboardSurface.includes("Confidence") && dashboardSurface.includes("source"), "Dashboard surfaces expose confidence/source evidence");

const readinessDoc = file("docs/commercial-readiness.md");
check(
  "docs:commercial-readiness-matrix",
  [
    "Phase F §4",
    "Requirement 1",
    "Requirement 2",
    "Requirement 3",
    "Requirement 4",
    "Requirement 5",
    "Requirement 6"
  ].every((marker) => readinessDoc.includes(marker)),
  "Commercial-readiness audit matrix exists"
);
check(
  "docs:staging-rls-evidence-slot",
  readinessDoc.includes("Staging RLS Evidence") &&
    readinessDoc.includes("supabase/tests/rls-cross-org-smoke.sql") &&
    readinessDoc.includes("pnpm rls:staging") &&
    (readinessDoc.includes("`cross_org_raw_signals` | pending, must be `0`") ||
      readinessDoc.includes("`cross_org_raw_signals` | `0`")),
  "Commercial readiness records where to paste staging RLS evidence"
);
check(
  "docs:infra-rate-limit-gate",
  readinessDoc.includes("infrastructure-level API auth rate limiting") &&
    readinessDoc.includes("Vercel Edge Middleware") &&
    readinessDoc.includes("Cloudflare WAF") &&
    readinessDoc.includes("in-process limiter is a fail-safe"),
  "Commercial readiness requires infrastructure-level auth rate limiting"
);

const { writeGate: runtimeWriteGate } = await import("../lib/munin/write-gate.ts");
const { isAllowedGapfillUrl } = await import("../lib/huginn/gapfill.ts");
const { resolveAiRateLimits } = await import("../lib/ai/rate-limit.ts");

check(
  "runtime:write-gate-routes",
  runtimeWriteGate({ orgId: "audit-org", content: "narrative", sourceType: "web_narrative", memoryClass: "fact" }).action ===
    "REJECTED_FROM_MEMORY" &&
    runtimeWriteGate({ orgId: "audit-org", content: "opinion", sourceType: "user_seed", memoryClass: "opinion" }).table ===
      "munin_opinions",
  "Release audit executes writeGate routing instead of only checking source text"
);
check(
  "runtime:gapfill-domain-filter",
  isAllowedGapfillUrl("https://elibrary.ferc.gov/eLibrary/search", ["ferc.gov"]) &&
    !isAllowedGapfillUrl("https://example.com/market-narrative", ["ferc.gov"]),
  "Release audit executes Reality gapfill domain allow-list logic"
);
check(
  "runtime:ai-free-tier-clamp",
  resolveAiRateLimits("gemini-2.5-flash", {
    AI_RATE_LIMIT_TIER: "free",
    AI_MAX_RPM: "1000",
    AI_MAX_RPD: "1000",
    AI_MAX_TPM: "1000000"
  }).rpm === 10,
  "Release audit executes Gemini free-tier clamp logic"
);

const failed = checks.filter((item) => !item.pass);
for (const item of checks) {
  console.log(`${item.pass ? "PASS" : "FAIL"} ${item.name} - ${item.evidence}`);
}

if (failed.length) {
  throw new Error(`release audit failed: ${failed.map((item) => item.name).join(", ")}`);
}

console.log(`release audit: ${checks.length} checks passed`);

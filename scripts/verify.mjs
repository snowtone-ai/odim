import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "HANDOFF-JA.md",
  "docs/vision.md",
  "tasks.md",
  "docs/state.md",
  "docs/decisions.md",
  "docs/issues.md",
  "docs/repo-map.md",
  "docs/commercial-readiness.md",
  "scripts/setup.mjs",
  "scripts/verify.mjs",
  "scripts/release-audit.mjs",
  "scripts/issue-bootstrap-api-key.mjs",
  "scripts/run-staging-rls-smoke.mjs",
  ".env.example",
  ".gitignore",
  "package.json",
  "app/layout.tsx",
  "app/api/alerts/route.ts",
  "app/api/api-keys/route.ts",
  "app/api/audit/route.ts",
  "app/api/entities/route.ts",
  "app/api/huginn/route.ts",
  "app/api/signals/route.ts",
  "app/api/settings/route.ts",
  "app/(dashboard)/map/page.tsx",
  "app/(dashboard)/entity/page.tsx",
  "app/(dashboard)/alerts/page.tsx",
  "app/(dashboard)/huginn/page.tsx",
  "app/(dashboard)/settings/page.tsx",
  "styles/tokens.css",
  "supabase/migrations/0001_initial.sql",
  "supabase/tests/rls-cross-org-smoke.sql",
  "supabase/tests/service-role-write-grants.sql",
  "config/sources.json",
  "scrapers/sec-edgar.ts",
  "scrapers/ferc.ts",
  "scrapers/building-permits.ts",
  "scrapers/cloud-regions.ts",
  "scrapers/water-districts.ts",
  "scrapers/usgs-minerals.ts",
  "scrapers/port-statistics.ts",
  "scrapers/narrative.ts",
  "scrapers/configured-source.ts",
  "scrapers/run.ts",
  "lib/pipeline/normalize.ts",
  "lib/pipeline/ontologize.ts",
  "lib/pipeline/alert.ts",
  "lib/pipeline/ingest.ts",
  "lib/repositories/reality.ts",
  "lib/repositories/admin.ts",
  "lib/api/org.ts",
  "lib/env/runtime.ts",
  "lib/auth/api-keys.ts",
  "lib/auth/request.ts",
  "lib/i18n/messages.ts",
  "lib/huginn/query.ts",
  "lib/munin/memory.ts"
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) throw new Error(`Missing required files:\n${missing.join("\n")}`);

const tokens = readFileSync("styles/tokens.css", "utf8");
for (const token of ["--ink-900", "--rune", "--layer-energy", "--ease-odim"]) {
  if (!tokens.includes(token)) throw new Error(`Missing design token: ${token}`);
}

const tasks = readFileSync("tasks.md", "utf8");
for (const field of ["Owner", "Depends On", "Write Scope", "Acceptance", "Verification", "Evidence"]) {
  if (!tasks.includes(field)) throw new Error(`tasks.md missing ready-task field: ${field}`);
}

const env = readFileSync(".env.example", "utf8");
for (const key of [
  "AI_PROVIDER",
  "AI_MODEL",
  "ODIM_RUNTIME_ENV",
  "NEXT_PUBLIC_DEFAULT_LOCALE",
  "AUTH_REQUIRED",
  "AI_MAX_RPM",
  "AI_MAX_RPD",
  "AI_MAX_TPM",
  "AI_RATE_LIMIT_TIER",
  "AI_RETRY_ATTEMPTS",
  "API_KEY_PEPPER",
  "API_AUTH_MAX_FAILED_ATTEMPTS",
  "API_AUTH_RATE_LIMIT_WINDOW_MS",
  "REPOSITORY_SUPABASE_STRICT",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SEC_EDGAR_CIKS",
  "FERC_FEED_URL",
  "CLOUD_REGION_FEED_URL",
  "WATER_DISTRICT_FEED_URL",
  "USGS_MINERALS_FEED_URL",
  "PORT_STATISTICS_FEED_URL",
  "NARRATIVE_FEED_URL",
  "PAID_SOURCE_URL",
  "PAID_SOURCE_ORG_ID",
  "PAID_SOURCE_API_KEY"
]) {
  if (!env.includes(key)) throw new Error(`.env.example missing ${key}`);
}

const migration = readFileSync("supabase/migrations/0001_initial.sql", "utf8");
for (const column of ["fingerprint", "external_id", "source_refs", "dedupe_key", "org_id"]) {
  if (!migration.includes(column)) throw new Error(`migration missing ${column}`);
}
for (const table of ["api_keys", "alert_rules"]) {
  if (!migration.includes(`create table if not exists ${table}`)) throw new Error(`migration missing ${table}`);
}

const sources = JSON.parse(readFileSync("config/sources.json", "utf8"));
const configuredLayers = new Set(sources.sources.map((source) => source.layer));
for (const layer of ["energy", "cash", "land", "compute", "water", "raw_materials", "logistics"]) {
  if (!configuredLayers.has(layer)) throw new Error(`config/sources.json missing ${layer} layer`);
}
if (!configuredLayers.has("narrative")) throw new Error("config/sources.json missing narrative layer");

console.log("verify: structural checks passed");

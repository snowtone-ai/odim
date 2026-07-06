import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"|"$/g, "");
  }
}

loadDotEnv(".env.local");
loadDotEnv(".env");

const target = process.argv[2] ?? "staging";
const databaseEnv =
  target === "production"
    ? "SUPABASE_PRODUCTION_DATABASE_URL"
    : target === "staging"
      ? "SUPABASE_STAGING_DATABASE_URL"
      : undefined;

if (!databaseEnv) {
  throw new Error("Usage: node scripts/apply-db-migrations.mjs <staging|production> [migration.sql ...]");
}

const databaseUrl = process.env[databaseEnv];
if (!databaseUrl) {
  throw new Error(`${databaseEnv} is required`);
}

const migrations = process.argv.slice(3);
const files = migrations.length
  ? migrations
  : [
      "supabase/migrations/0001_initial.sql",
      "supabase/migrations/0002_huginn_munin_v2.sql",
      "supabase/migrations/0003_sleep_time_compute.sql",
      "supabase/migrations/0004_ai_rate_limit_usage.sql",
      "supabase/migrations/0005_ingestion_operations.sql",
      "supabase/migrations/0006_ingest_transaction.sql",
      "supabase/migrations/0007_performance_indexes.sql",
      "supabase/migrations/0008_entity_score_history.sql",
      "supabase/migrations/0009_push_subscriptions.sql",
      "supabase/migrations/0010_ai_native_workflows.sql",
      "supabase/migrations/0011_watchtower_hardening.sql",
      "supabase/migrations/0012_billing_entitlements.sql",
      "supabase/migrations/0013_org_onboarding.sql",
      "supabase/migrations/0014_service_role_grants.sql"
    ];

// On Windows, PostgreSQL tools may not be on PATH; try common install locations.
const PSQL_FALLBACKS = [
  "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
  "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
  "C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe",
];

function resolvePsql() {
  const probe = spawnSync("psql", ["--version"], { encoding: "utf8", windowsHide: true });
  if (!probe.error) return "psql";
  for (const candidate of PSQL_FALLBACKS) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const psqlBin = resolvePsql();
if (!psqlBin) {
  throw new Error(
    "psql not found. Add PostgreSQL bin to PATH or install PostgreSQL client tools.\n" +
    "Checked: " + PSQL_FALLBACKS.join(", ")
  );
}

for (const file of files) {
  if (!existsSync(file)) throw new Error(`${file} is missing`);
  const result = spawnSync(psqlBin, ["-X", "-v", "ON_ERROR_STOP=1", databaseUrl, "-f", file], {
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error) {
    throw new Error(`Failed to start psql: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`${target} migration failed at ${file} with exit code ${result.status}`);
  }
  console.log(JSON.stringify({ target, migration: file, result: "applied" }));
}

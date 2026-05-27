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
      "supabase/migrations/0005_ingestion_operations.sql"
    ];

for (const file of files) {
  if (!existsSync(file)) throw new Error(`${file} is missing`);
  const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", databaseUrl, "-f", file], {
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error) {
    throw new Error(`Failed to start psql. Install PostgreSQL client tools first. ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`${target} migration failed at ${file} with exit code ${result.status}`);
  }
  console.log(JSON.stringify({ target, migration: file, result: "applied" }));
}

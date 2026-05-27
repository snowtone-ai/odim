import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("daily scrape workflow performs dry-run smoke and live Supabase write", () => {
  const workflow = readFileSync(".github/workflows/daily-scrape.yml", "utf8");

  assert.match(workflow, /pnpm scrape:dry-run/);
  assert.match(workflow, /pnpm scrape/);
  assert.match(workflow, /SCRAPE_ENABLED:\s*"true"/);
  assert.match(workflow, /SCRAPE_DRY_RUN:\s*"false"/);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("automation scripts expose backfill and daily dream entry points", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const dreamWorkflow = readFileSync(".github/workflows/daily-dream.yml", "utf8");
  const migrationRunner = readFileSync("scripts/apply-db-migrations.mjs", "utf8");

  assert.equal(packageJson.scripts["scrape:backfill"], "node scrapers/run.ts --backfill");
  assert.equal(packageJson.scripts["dream:daily"], "node scripts/run-daily-dream.mjs");
  assert.match(dreamWorkflow, /node-version:\s*24/);
  assert.match(dreamWorkflow, /pnpm dream:daily/);
  assert.match(dreamWorkflow, /DEFAULT_ORG_ID/);
  assert.match(migrationRunner, /0001_initial\.sql/);
  assert.match(migrationRunner, /0005_ingestion_operations\.sql/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveScrapeOptions } from "../scrapers/run.ts";

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
  assert.match(migrationRunner, /0006_ingest_transaction\.sql/);
  assert.match(migrationRunner, /0007_performance_indexes\.sql/);
  assert.match(migrationRunner, /0010_ai_native_workflows\.sql/);
});

test("backfill options support source selection, date windows, and paging controls", () => {
  const previous = {
    SCRAPE_BACKFILL_END: process.env.SCRAPE_BACKFILL_END,
    SCRAPE_BACKFILL_LIMIT: process.env.SCRAPE_BACKFILL_LIMIT,
    SCRAPE_BACKFILL_START: process.env.SCRAPE_BACKFILL_START,
    SCRAPE_DRY_RUN: process.env.SCRAPE_DRY_RUN,
    SCRAPE_MAX_PAGES: process.env.SCRAPE_MAX_PAGES,
    SCRAPE_PAGE_SIZE: process.env.SCRAPE_PAGE_SIZE,
    SCRAPE_SOURCE_IDS: process.env.SCRAPE_SOURCE_IDS,
    SCRAPE_WARN_ON_SOURCE_FAILURE: process.env.SCRAPE_WARN_ON_SOURCE_FAILURE
  };
  process.env.SCRAPE_DRY_RUN = "false";
  process.env.SCRAPE_BACKFILL_LIMIT = "250";
  process.env.SCRAPE_BACKFILL_START = "2020-01-01";
  process.env.SCRAPE_BACKFILL_END = "2024-12-31";
  process.env.SCRAPE_PAGE_SIZE = "75";
  process.env.SCRAPE_MAX_PAGES = "4";
  process.env.SCRAPE_SOURCE_IDS = "eia-electricity,uspto-patents";

  try {
    const options = resolveScrapeOptions(["--backfill", "--no-write"]);
    assert.equal(options.mode, "backfill");
    assert.equal(options.noWrite, true);
    assert.equal(options.sourceLimit, 250);
    assert.equal(options.pageSize, 75);
    assert.equal(options.maxPages, 4);
    assert.equal(options.warnOnSourceFailure, true);
    assert.deepEqual(options.sourceIds, ["eia-electricity", "uspto-patents"]);
    assert.equal(options.backfillStart, "2020-01-01T00:00:00.000Z");
    assert.equal(options.backfillEnd, "2024-12-31T00:00:00.000Z");

    process.env.SCRAPE_DRY_RUN = "true";
    const explicitBackfill = resolveScrapeOptions(["--backfill"]);
    assert.equal(explicitBackfill.dryRun, false);
    assert.equal(explicitBackfill.noWrite, false);
    process.env.SCRAPE_WARN_ON_SOURCE_FAILURE = "false";
    assert.equal(resolveScrapeOptions(["--backfill", "--no-write"]).warnOnSourceFailure, false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

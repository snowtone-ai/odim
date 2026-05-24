import { readFileSync } from "node:fs";
import { buildIngestionPlan } from "../lib/pipeline/ontologize.ts";
import { buildFixtureRawSignals } from "../lib/pipeline/fixtures.ts";
import type { RawSignal } from "../lib/pipeline/types.ts";
import { createServiceSupabaseClient } from "../lib/supabase/client.ts";
import { upsertIngestionPlan } from "../lib/pipeline/ingest.ts";
import { fetchBuildingPermitSignals } from "./building-permits.ts";
import { fetchCloudRegionSignals } from "./cloud-regions.ts";
import { fetchFercSignals } from "./ferc.ts";
import { fetchNarrativeSignals } from "./narrative.ts";
import { fetchPortStatisticSignals } from "./port-statistics.ts";
import { fetchSecEdgarSignals } from "./sec-edgar.ts";
import { fetchUsgsMineralSignals } from "./usgs-minerals.ts";
import { fetchWaterDistrictSignals } from "./water-districts.ts";
import { fetchConfiguredSourceSignals, type ConfiguredSourceDefinition } from "./configured-source.ts";

type SourceConfig = {
  sources: ConfiguredSourceDefinition[];
};

function envList(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadSourceConfig(): SourceConfig {
  return JSON.parse(readFileSync("config/sources.json", "utf8")) as SourceConfig;
}

async function collectLiveSignals() {
  if (process.env.SCRAPE_ENABLED !== "true") {
    throw new Error("SCRAPE_ENABLED=true is required for live scraping. Use --dry-run for local verification.");
  }

  const signals: RawSignal[] = [];
  const ciks = envList("SEC_EDGAR_CIKS");
  if (ciks.length) {
    signals.push(
      ...(await fetchSecEdgarSignals({
        ciks,
        userAgent: process.env.SEC_EDGAR_USER_AGENT,
        baseUrl: process.env.SEC_EDGAR_BASE_URL,
        limit: Number(process.env.SCRAPE_LIMIT ?? 50)
      }))
    );
  }
  if (process.env.FERC_FEED_URL) {
    signals.push(
      ...(await fetchFercSignals({
        feedUrl: process.env.FERC_FEED_URL,
        limit: Number(process.env.SCRAPE_LIMIT ?? 50)
      }))
    );
  }
  if (process.env.BUILDING_PERMITS_URL) {
    signals.push(
      ...(await fetchBuildingPermitSignals({
        feedUrl: process.env.BUILDING_PERMITS_URL,
        jurisdiction: process.env.BUILDING_PERMITS_JURISDICTION,
        limit: Number(process.env.SCRAPE_LIMIT ?? 50)
      }))
    );
  }
  if (process.env.CLOUD_REGION_FEED_URL) {
    signals.push(
      ...(await fetchCloudRegionSignals({
        feedUrl: process.env.CLOUD_REGION_FEED_URL,
        limit: Number(process.env.SCRAPE_LIMIT ?? 50)
      }))
    );
  }
  if (process.env.WATER_DISTRICT_FEED_URL) {
    signals.push(
      ...(await fetchWaterDistrictSignals({
        feedUrl: process.env.WATER_DISTRICT_FEED_URL,
        jurisdiction: process.env.WATER_DISTRICT_JURISDICTION,
        limit: Number(process.env.SCRAPE_LIMIT ?? 50)
      }))
    );
  }
  if (process.env.USGS_MINERALS_FEED_URL) {
    signals.push(
      ...(await fetchUsgsMineralSignals({
        feedUrl: process.env.USGS_MINERALS_FEED_URL,
        limit: Number(process.env.SCRAPE_LIMIT ?? 50)
      }))
    );
  }
  if (process.env.PORT_STATISTICS_FEED_URL) {
    signals.push(
      ...(await fetchPortStatisticSignals({
        feedUrl: process.env.PORT_STATISTICS_FEED_URL,
        limit: Number(process.env.SCRAPE_LIMIT ?? 50)
      }))
    );
  }
  if (process.env.NARRATIVE_FEED_URL) {
    signals.push(
      ...(await fetchNarrativeSignals({
        feedUrl: process.env.NARRATIVE_FEED_URL,
        limit: Number(process.env.SCRAPE_LIMIT ?? 50)
      }))
    );
  }
  for (const source of loadSourceConfig().sources.filter((item) => item.enabled && item.adapter === "configured-json-csv")) {
    if (!source.urlEnv) continue;
    const feedUrl = process.env[source.urlEnv];
    if (!feedUrl) continue;
    signals.push(
      ...(await fetchConfiguredSourceSignals({
        source,
        feedUrl,
        limit: Number(process.env.SCRAPE_LIMIT ?? 50)
      }))
    );
  }

  return signals;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run") || process.env.SCRAPE_DRY_RUN === "true";
  const noWrite = args.has("--no-write") || dryRun;
  const signals = dryRun ? buildFixtureRawSignals() : await collectLiveSignals();
  const plan = buildIngestionPlan(signals);

  if (!noWrite) {
    await upsertIngestionPlan(createServiceSupabaseClient(), plan);
  }

  console.log(
    JSON.stringify({
      auditEvents: plan.auditEvents.length,
      alerts: plan.alerts.length,
      dryRun,
      ontologyLinks: plan.ontologyLinks.length,
      ontologyObjects: plan.ontologyObjects.length,
      rawSignals: plan.rawSignals.length,
      wroteDatabase: !noWrite
    })
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

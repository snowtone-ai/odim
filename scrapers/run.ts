import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildIngestionPlan } from "../lib/pipeline/ontologize.ts";
import { buildFixtureRawSignals } from "../lib/pipeline/fixtures.ts";
import type { IngestionPlan, RawSignal } from "../lib/pipeline/types.ts";
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
import { fetchEiaSignals } from "./eia.ts";
import { fetchStatePucSignals } from "./state-puc.ts";
import { fetchPatentSignals } from "./patent.ts";
import { fetchEpaEchoSignals } from "./epa-echo.ts";
import { fetchFaaObstructionSignals } from "./faa-obstructions.ts";

type SourceConfig = {
  sources: ConfiguredSourceDefinition[];
};

type ScrapeMode = "daily" | "backfill" | "dry-run";

type ScrapeOptions = {
  dryRun: boolean;
  failOnSourceError: boolean;
  minSignals: number;
  mode: ScrapeMode;
  noWrite: boolean;
  sourceLimit: number;
};

type SourceReport = {
  id: string;
  ok: boolean;
  count: number;
  lastObservedAt?: string;
  error?: string;
  skipped?: string;
};

type ScrapeResult = {
  auditEvents: number;
  alerts: number;
  dryRun: boolean;
  ingestionRunId?: string;
  mode: ScrapeMode;
  ontologyLinks: number;
  ontologyObjects: number;
  rawSignals: number;
  sourceLimit: number;
  sources: SourceReport[];
  wroteDatabase: boolean;
};

type PreparedScrape = {
  options: ScrapeOptions;
  plan: IngestionPlan;
  result: ScrapeResult;
};

function envList(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function loadSourceConfig(): SourceConfig {
  return JSON.parse(readFileSync("config/sources.json", "utf8")) as SourceConfig;
}

function sourceLimitFor(mode: ScrapeMode) {
  if (mode === "backfill") return envNumber("SCRAPE_BACKFILL_LIMIT", 500);
  return envNumber("SCRAPE_LIMIT", 50);
}

export function resolveScrapeOptions(args = process.argv.slice(2)): ScrapeOptions {
  const flags = new Set(args);
  const requestedMode = flags.has("--backfill") ? "backfill" : process.env.SCRAPE_MODE;
  const dryRun = flags.has("--dry-run") || process.env.SCRAPE_DRY_RUN === "true" || requestedMode === "dry-run";
  const mode: ScrapeMode = dryRun ? "dry-run" : requestedMode === "backfill" ? "backfill" : "daily";
  const noWrite = flags.has("--no-write") || dryRun;
  return {
    dryRun,
    failOnSourceError: process.env.SCRAPE_FAIL_ON_SOURCE_ERROR === "true" || mode === "backfill",
    minSignals: envNumber("SCRAPE_MIN_SIGNALS", mode === "dry-run" ? 1 : 1),
    mode,
    noWrite,
    sourceLimit: sourceLimitFor(mode)
  };
}

async function runSource(report: SourceReport[], id: string, task: () => Promise<RawSignal[]>) {
  try {
    const signals = await task();
    const lastObservedAt = signals
      .map((signal) => signal.observedAt)
      .sort()
      .at(-1);
    report.push({ id, ok: true, count: signals.length, lastObservedAt });
    return signals;
  } catch (error) {
    report.push({ id, ok: false, count: 0, error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

async function recordIngestionRunStart(client: ReturnType<typeof createServiceSupabaseClient>, options: ScrapeOptions) {
  const id = randomUUID();
  const { error } = await client.from("ingestion_runs").insert({
    id,
    mode: options.mode,
    status: "running",
    source_limit: options.sourceLimit,
    started_at: new Date().toISOString()
  });
  if (error) throw new Error(`ingestion run start failed: ${error.message}`);
  return id;
}

async function recordIngestionRunSuccess(
  client: ReturnType<typeof createServiceSupabaseClient>,
  runId: string,
  result: ScrapeResult
) {
  const { error } = await client
    .from("ingestion_runs")
    .update({
      audit_event_count: result.auditEvents,
      alert_count: result.alerts,
      finished_at: new Date().toISOString(),
      ontology_link_count: result.ontologyLinks,
      ontology_object_count: result.ontologyObjects,
      raw_signal_count: result.rawSignals,
      source_report: result.sources,
      status: "succeeded"
    })
    .eq("id", runId);
  if (error) throw new Error(`ingestion run success update failed: ${error.message}`);
}

async function recordIngestionRunFailure(client: ReturnType<typeof createServiceSupabaseClient>, runId: string, errorMessage: string) {
  const { error } = await client
    .from("ingestion_runs")
    .update({
      error: errorMessage,
      finished_at: new Date().toISOString(),
      status: "failed"
    })
    .eq("id", runId);
  if (error) throw new Error(`ingestion run failure update failed: ${error.message}`);
}

async function updateSourceWatermarks(client: ReturnType<typeof createServiceSupabaseClient>, options: ScrapeOptions, sources: SourceReport[]) {
  const rows = sources
    .filter((source) => source.ok && source.count > 0)
    .map((source) => ({
      last_observed_at: source.lastObservedAt ?? null,
      last_success_at: new Date().toISOString(),
      mode: options.mode,
      raw_signal_count: source.count,
      source_id: source.id,
      updated_at: new Date().toISOString()
    }));
  if (!rows.length) return;
  const { error } = await client.from("source_watermarks").upsert(rows, { onConflict: "source_id" });
  if (error) throw new Error(`source watermark update failed: ${error.message}`);
}

function skipSource(report: SourceReport[], id: string, skipped: string) {
  report.push({ id, ok: true, count: 0, skipped });
}

export async function collectLiveSignals(options: ScrapeOptions) {
  if (process.env.SCRAPE_ENABLED !== "true") {
    throw new Error("SCRAPE_ENABLED=true is required for live scraping. Use --dry-run for local verification.");
  }

  const signals: RawSignal[] = [];
  const sourceReport: SourceReport[] = [];
  const limit = options.sourceLimit;
  const ciks = envList("SEC_EDGAR_CIKS");
  if (ciks.length) {
    signals.push(...(await runSource(sourceReport, "sec-edgar", () =>
      fetchSecEdgarSignals({
        ciks,
        userAgent: process.env.SEC_EDGAR_USER_AGENT,
        baseUrl: process.env.SEC_EDGAR_BASE_URL,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "sec-edgar", "SEC_EDGAR_CIKS is empty");
  }
  const fercFeedUrl = process.env.FERC_FEED_URL;
  if (fercFeedUrl) {
    signals.push(...(await runSource(sourceReport, "ferc-elibrary", () =>
      fetchFercSignals({
        feedUrl: fercFeedUrl,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "ferc-elibrary", "FERC_FEED_URL is not set");
  }
  const buildingPermitsUrl = process.env.BUILDING_PERMITS_URL;
  if (buildingPermitsUrl) {
    signals.push(...(await runSource(sourceReport, "county-building-permits", () =>
      fetchBuildingPermitSignals({
        feedUrl: buildingPermitsUrl,
        jurisdiction: process.env.BUILDING_PERMITS_JURISDICTION,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "county-building-permits", "BUILDING_PERMITS_URL is not set");
  }
  const cloudRegionFeedUrl = process.env.CLOUD_REGION_FEED_URL;
  if (cloudRegionFeedUrl) {
    signals.push(...(await runSource(sourceReport, "public-cloud-regions", () =>
      fetchCloudRegionSignals({
        feedUrl: cloudRegionFeedUrl,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "public-cloud-regions", "CLOUD_REGION_FEED_URL is not set");
  }
  const waterDistrictFeedUrl = process.env.WATER_DISTRICT_FEED_URL;
  if (waterDistrictFeedUrl) {
    signals.push(...(await runSource(sourceReport, "water-district-permits", () =>
      fetchWaterDistrictSignals({
        feedUrl: waterDistrictFeedUrl,
        jurisdiction: process.env.WATER_DISTRICT_JURISDICTION,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "water-district-permits", "WATER_DISTRICT_FEED_URL is not set");
  }
  const usgsMineralsFeedUrl = process.env.USGS_MINERALS_FEED_URL;
  if (usgsMineralsFeedUrl) {
    signals.push(...(await runSource(sourceReport, "usgs-minerals", () =>
      fetchUsgsMineralSignals({
        feedUrl: usgsMineralsFeedUrl,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "usgs-minerals", "USGS_MINERALS_FEED_URL is not set");
  }
  const portStatisticsFeedUrl = process.env.PORT_STATISTICS_FEED_URL;
  if (portStatisticsFeedUrl) {
    signals.push(...(await runSource(sourceReport, "port-statistics", () =>
      fetchPortStatisticSignals({
        feedUrl: portStatisticsFeedUrl,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "port-statistics", "PORT_STATISTICS_FEED_URL is not set");
  }
  const narrativeFeedUrl = process.env.NARRATIVE_FEED_URL;
  if (narrativeFeedUrl) {
    signals.push(...(await runSource(sourceReport, "narrative-rss", () =>
      fetchNarrativeSignals({
        feedUrl: narrativeFeedUrl,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "narrative-rss", "NARRATIVE_FEED_URL is not set");
  }
  const eiaApiKey = process.env.EIA_API_KEY;
  const eiaFeedUrl = process.env.EIA_FEED_URL;
  if (eiaApiKey && eiaFeedUrl) {
    signals.push(...(await runSource(sourceReport, "eia-electricity", () =>
      fetchEiaSignals({
        baseUrl: eiaFeedUrl,
        apiKey: eiaApiKey,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "eia-electricity", "EIA_API_KEY or EIA_FEED_URL is not set");
  }
  const statePucFeedUrl = process.env.STATE_PUC_FEED_URL;
  if (statePucFeedUrl) {
    signals.push(...(await runSource(sourceReport, "state-puc-filings", () =>
      fetchStatePucSignals({
        feedUrl: statePucFeedUrl,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "state-puc-filings", "STATE_PUC_FEED_URL is not set");
  }
  signals.push(...(await runSource(sourceReport, "uspto-patents", () =>
    fetchPatentSignals({
      baseUrl: process.env.USPTO_PATENTS_FEED_URL ?? process.env.PATENT_FEED_URL,
      assignee: process.env.PATENT_ASSIGNEE,
      cpcGroup: process.env.PATENT_CPC_GROUP,
      limit
    })
  )));
  signals.push(...(await runSource(sourceReport, "epa-echo-npdes", () =>
    fetchEpaEchoSignals({
        baseUrl: process.env.EPA_ECHO_FEED_URL,
        state: process.env.EPA_ECHO_STATE,
        limit
      })
  )));
  const faaOasFeedUrl = process.env.FAA_OAS_FEED_URL;
  if (faaOasFeedUrl) {
    signals.push(...(await runSource(sourceReport, "faa-oas", () =>
      fetchFaaObstructionSignals({
        feedUrl: faaOasFeedUrl,
        limit
      })
    )));
  } else {
    skipSource(sourceReport, "faa-oas", "FAA_OAS_FEED_URL is not set");
  }
  for (const source of loadSourceConfig().sources.filter((item) => item.enabled && item.adapter === "configured-json-csv")) {
    if (!source.urlEnv) {
      skipSource(sourceReport, source.id, "configured source has no urlEnv");
      continue;
    }
    const feedUrl = process.env[source.urlEnv];
    if (!feedUrl) {
      skipSource(sourceReport, source.id, `${source.urlEnv} is not set`);
      continue;
    }
    signals.push(...(await runSource(sourceReport, source.id, () =>
      fetchConfiguredSourceSignals({
        source,
        feedUrl,
        limit
      })
    )));
  }

  const failedSources = sourceReport.filter((source) => !source.ok);
  if (options.failOnSourceError && failedSources.length) {
    throw new Error(`Live scrape failed for required source(s): ${failedSources.map((source) => `${source.id}: ${source.error}`).join("; ")}`);
  }

  return { signals, sourceReport };
}

async function prepareScrape(args = process.argv.slice(2)): Promise<PreparedScrape> {
  const options = resolveScrapeOptions(args);
  const live = options.dryRun ? { signals: buildFixtureRawSignals(), sourceReport: [] } : await collectLiveSignals(options);
  const signals = live.signals;
  if (signals.length < options.minSignals) {
    throw new Error(`Scrape produced ${signals.length} raw signals, below SCRAPE_MIN_SIGNALS=${options.minSignals}`);
  }
  const plan = buildIngestionPlan(signals);

  return {
    options,
    plan,
    result: {
      auditEvents: plan.auditEvents.length,
      alerts: plan.alerts.length,
      dryRun: options.dryRun,
      mode: options.mode,
      ontologyLinks: plan.ontologyLinks.length,
      ontologyObjects: plan.ontologyObjects.length,
      rawSignals: plan.rawSignals.length,
      sourceLimit: options.sourceLimit,
      sources: live.sourceReport,
      wroteDatabase: !options.noWrite
    }
  };
}

async function runScrapeWithoutPersistence(args = process.argv.slice(2)) {
  return (await prepareScrape(args)).result;
}

export async function runScrape(args = process.argv.slice(2)) {
  const options = resolveScrapeOptions(args);
  if (options.noWrite) return runScrapeWithoutPersistence(args);

  const client = createServiceSupabaseClient();
  const runId = await recordIngestionRunStart(client, options);
  try {
    const prepared = await prepareScrape(args);
    const result = prepared.result;
    await upsertIngestionPlan(client, prepared.plan);
    await updateSourceWatermarks(client, options, result.sources);
    await recordIngestionRunSuccess(client, runId, result);
    return { ...result, ingestionRunId: runId };
  } catch (error) {
    await recordIngestionRunFailure(client, runId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function main() {
  console.log(JSON.stringify(await runScrape()));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildIngestionPlan } from "../lib/pipeline/ontologize.ts";
import { buildFixtureRawSignals } from "../lib/pipeline/fixtures.ts";
import type { IngestionPlan, RawSignal } from "../lib/pipeline/types.ts";
import { createServiceSupabaseClient } from "../lib/supabase/client.ts";
import { upsertIngestionPlan } from "../lib/pipeline/ingest.ts";
import { recordEntityScoreSnapshots } from "../lib/pipeline/score-snapshot.ts";
import { fetchBuildingPermitSignals } from "./building-permits.ts";
import { fetchCloudRegionSignals } from "./cloud-regions.ts";
import { fetchFercSignals } from "./ferc.ts";
import { fetchNarrativeSignals } from "./narrative.ts";
import { fetchPortStatisticSignals } from "./port-statistics.ts";
import { fetchSecEdgarSignalsBatch } from "./sec-edgar.ts";
import { fetchSubsidiaryLinksBatch } from "./sec-edgar-subsidiaries.ts";
import { fetchGleifRelationshipsBatch } from "./gleif.ts";
import { fetchWikidataRelationships } from "./wikidata.ts";
import { fetchUsgsMineralSignals } from "./usgs-minerals.ts";
import { fetchWaterDistrictSignals } from "./water-districts.ts";
import { fetchConfiguredSourceSignals, type ConfiguredSourceDefinition } from "./configured-source.ts";
import { fetchEiaSignals } from "./eia.ts";
import { fetchStatePucSignals } from "./state-puc.ts";
import { fetchPatentSignals } from "./patent.ts";
import { fetchEpaEchoSignals } from "./epa-echo.ts";
import { fetchFaaObstructionSignals } from "./faa-obstructions.ts";
import { sendSlackAlert } from "../lib/notifications/slack.ts";
import { fetchFredSignals } from "./fred.ts";
import { fetchFederalRegisterSignals } from "./federal-register.ts";
import { fetchEdinetSignals } from "./edinet.ts";
import { fetchCompaniesHouseSignals } from "./companies-house.ts";
import { fetchUsaspendingSignals } from "./usaspending.ts";
import { fetchForm4SignalsBatch } from "./sec-edgar-form4.ts";
import { fetch8KSignalsBatch } from "./sec-edgar-8k.ts";
import { fetch13DGSignals } from "./sec-edgar-13dg.ts";
import { fetch13FHoldings } from "./sec-edgar-13f.ts";
import { checkFreshness } from "../lib/pipeline/freshness.ts";
import { broadcastPushAlert } from "../lib/notifications/push.ts";
import { fetchOpenSanctionsSignals } from "./opensanctions.ts";
import { fetchFemaSignals } from "./fema.ts";
import { fetchSamGovSignals } from "./sam-gov.ts";
import { fetchNrcSignals } from "./nrc.ts";

type SourceConfig = {
  sources: ConfiguredSourceDefinition[];
};

type EntitySeed = {
  name?: string;
  cik?: string | null;
  lei?: string | null;
  wikidata_id?: string | null;
  region?: string;
};

type ScrapeMode = "daily" | "backfill" | "dry-run";

type ScrapeOptions = {
  backfillEnd?: string;
  backfillStart?: string;
  dryRun: boolean;
  failOnSourceError: boolean;
  maxPages: number;
  minSignals: number;
  mode: ScrapeMode;
  noWrite: boolean;
  pageSize: number;
  sourceIds: string[];
  sourceLimit: number;
  warnOnSourceFailure: boolean;
};

type SourceReport = {
  id: string;
  ok: boolean;
  count: number;
  pages?: number;
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

function loadEntitySeeds(): EntitySeed[] {
  try {
    return JSON.parse(readFileSync("config/entity-seeds.json", "utf8")) as EntitySeed[];
  } catch {
    return [];
  }
}

function loadSeedCiks(): string[] {
  return loadEntitySeeds()
    .map((s) => s.cik)
    .filter((cik): cik is string => typeof cik === "string" && cik.length > 0);
}

function sourceLimitFor(mode: ScrapeMode) {
  if (mode === "backfill") return envNumber("SCRAPE_BACKFILL_LIMIT", 500);
  return envNumber("SCRAPE_LIMIT", 50);
}

function envDate(name: string) {
  const value = process.env[name];
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${name} must be an ISO date or datetime`);
  return parsed.toISOString();
}

export function resolveScrapeOptions(args = process.argv.slice(2)): ScrapeOptions {
  const flags = new Set(args);
  const requestedMode = flags.has("--backfill") ? "backfill" : process.env.SCRAPE_MODE;
  const dryRun = flags.has("--dry-run") || (process.env.SCRAPE_DRY_RUN === "true" && !flags.has("--backfill")) || requestedMode === "dry-run";
  const mode: ScrapeMode = dryRun ? "dry-run" : requestedMode === "backfill" ? "backfill" : "daily";
  const noWrite = flags.has("--no-write") || dryRun;
  const sourceLimit = sourceLimitFor(mode);
  const pageSize = Math.max(1, Math.min(sourceLimit, envNumber("SCRAPE_PAGE_SIZE", mode === "backfill" ? 100 : sourceLimit)));
  return {
    backfillEnd: envDate("SCRAPE_BACKFILL_END"),
    backfillStart: envDate("SCRAPE_BACKFILL_START"),
    dryRun,
    failOnSourceError: process.env.SCRAPE_FAIL_ON_SOURCE_ERROR === "true" || mode === "backfill",
    maxPages: Math.max(1, envNumber("SCRAPE_MAX_PAGES", Math.ceil(sourceLimit / pageSize))),
    minSignals: envNumber("SCRAPE_MIN_SIGNALS", mode === "dry-run" ? 1 : 1),
    mode,
    noWrite,
    pageSize,
    sourceIds: envList("SCRAPE_SOURCE_IDS"),
    sourceLimit,
    warnOnSourceFailure: process.env.SCRAPE_WARN_ON_SOURCE_FAILURE !== "false"
  };
}

function sourceSelected(options: ScrapeOptions, id: string) {
  return !options.sourceIds.length || options.sourceIds.includes(id);
}

function filterSignalsForWindow(signals: RawSignal[], options: ScrapeOptions) {
  const start = options.backfillStart ? Date.parse(options.backfillStart) : undefined;
  const end = options.backfillEnd ? Date.parse(options.backfillEnd) : undefined;
  return signals.filter((signal) => {
    const observedAt = Date.parse(signal.observedAt);
    if (Number.isNaN(observedAt)) return false;
    if (start !== undefined && observedAt < start) return false;
    if (end !== undefined && observedAt > end) return false;
    return true;
  });
}

async function runSource(report: SourceReport[], id: string, options: ScrapeOptions, task: () => Promise<RawSignal[]>) {
  if (!sourceSelected(options, id)) {
    skipSource(report, id, "source not selected by SCRAPE_SOURCE_IDS");
    return [];
  }
  try {
    const signals = filterSignalsForWindow(await task(), options).slice(0, options.sourceLimit);
    const lastObservedAt = signals
      .map((signal) => signal.observedAt)
      .sort()
      .at(-1);
    report.push({ id, ok: true, count: signals.length, lastObservedAt, pages: 1 });
    return signals;
  } catch (error) {
    report.push({ id, ok: false, count: 0, error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

async function runPagedSource(
  report: SourceReport[],
  id: string,
  options: ScrapeOptions,
  task: (page: { limit: number; offset: number; page: number }) => Promise<RawSignal[]>
) {
  if (!sourceSelected(options, id)) {
    skipSource(report, id, "source not selected by SCRAPE_SOURCE_IDS");
    return [];
  }
  if (options.mode !== "backfill") {
    return runSource(report, id, options, () => task({ limit: options.sourceLimit, offset: 0, page: 1 }));
  }

  try {
    const signals: RawSignal[] = [];
    let pages = 0;
    for (let index = 0; index < options.maxPages && signals.length < options.sourceLimit; index += 1) {
      const rawPage = await task({ limit: options.pageSize, offset: index * options.pageSize, page: index + 1 });
      pages += 1;
      const pageSignals = filterSignalsForWindow(rawPage, options);
      signals.push(...pageSignals);
      if (rawPage.length < options.pageSize) break;
    }
    const limited = signals.slice(0, options.sourceLimit);
    const lastObservedAt = limited
      .map((signal) => signal.observedAt)
      .sort()
      .at(-1);
    report.push({ id, ok: true, count: limited.length, lastObservedAt, pages });
    return limited;
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
      error: null,
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

function warnSourceFailures(failedSources: SourceReport[]) {
  if (!failedSources.length) return;
  console.warn(
    `Source scrape failure(s): ${failedSources.map((source) => `${source.id}: ${source.error ?? "unknown error"}`).join("; ")}`
  );
}

export async function collectLiveSignals(options: ScrapeOptions) {
  if (options.dryRun) {
    const signals = buildFixtureRawSignals();
    const sourceReport = Array.from(
      signals.reduce((map, signal) => {
        const current = map.get(signal.source) ?? { id: signal.source, ok: true, count: 0, lastObservedAt: signal.observedAt };
        current.count += 1;
        current.lastObservedAt = current.lastObservedAt && current.lastObservedAt > signal.observedAt ? current.lastObservedAt : signal.observedAt;
        map.set(signal.source, current);
        return map;
      }, new Map<string, SourceReport>())
    ).map(([, value]) => value);
    return { signals, sourceReport };
  }
  if (process.env.SCRAPE_ENABLED !== "true") {
    throw new Error("SCRAPE_ENABLED=true is required for live scraping. Use --dry-run for local verification.");
  }

  const signals: RawSignal[] = [];
  const sourceReport: SourceReport[] = [];
  const limit = options.sourceLimit;
  // SEC_EDGAR_CIKS env var overrides the seed file (useful for targeted testing)
  const overrideCiks = envList("SEC_EDGAR_CIKS");
  const seedCiks = loadSeedCiks();
  const ciks = overrideCiks.length ? overrideCiks : seedCiks;
  if (ciks.length) {
    signals.push(...(await runSource(sourceReport, "sec-edgar", options, () =>
      fetchSecEdgarSignalsBatch({
        ciks,
        historicalFileLimit: options.maxPages,
        includeHistorical: options.mode === "backfill",
        userAgent: process.env.SEC_EDGAR_USER_AGENT,
        baseUrl: process.env.SEC_EDGAR_BASE_URL,
        limit
      })
    )));
    signals.push(...(await runSource(sourceReport, "sec-edgar-form4", options, () =>
      fetchForm4SignalsBatch(ciks, {
        userAgent: process.env.SEC_EDGAR_USER_AGENT,
        baseUrl: process.env.SEC_EDGAR_BASE_URL
      })
    )));
    signals.push(...(await runSource(sourceReport, "sec-edgar-8k", options, () =>
      fetch8KSignalsBatch(ciks, {
        userAgent: process.env.SEC_EDGAR_USER_AGENT,
        baseUrl: process.env.SEC_EDGAR_BASE_URL
      })
    )));
  } else {
    skipSource(sourceReport, "sec-edgar", "no CIKs configured (seed file empty and SEC_EDGAR_CIKS not set)");
  }
  signals.push(...(await runSource(sourceReport, "sec-edgar-13dg", options, () => fetch13DGSignals({ dryRun: options.dryRun }))));
  signals.push(...(await runSource(sourceReport, "sec-edgar-13f", options, async () => (await fetch13FHoldings({ dryRun: options.dryRun })).signals)));
  const fercFeedUrl = process.env.FERC_FEED_URL;
  if (fercFeedUrl) {
    signals.push(...(await runPagedSource(sourceReport, "ferc-elibrary", options, (page) =>
      fetchFercSignals({
        feedUrl: fercFeedUrl,
        limit: page.limit,
        offset: page.offset,
        page: page.page
      })
    )));
  } else {
    skipSource(sourceReport, "ferc-elibrary", "FERC_FEED_URL is not set");
  }
  const buildingPermitsUrl = process.env.BUILDING_PERMITS_URL;
  if (buildingPermitsUrl) {
    signals.push(...(await runPagedSource(sourceReport, "county-building-permits", options, (page) =>
      fetchBuildingPermitSignals({
        feedUrl: buildingPermitsUrl,
        jurisdiction: process.env.BUILDING_PERMITS_JURISDICTION,
        limit: page.limit,
        offset: page.offset,
        page: page.page
      })
    )));
  } else {
    skipSource(sourceReport, "county-building-permits", "BUILDING_PERMITS_URL is not set");
  }
  const cloudRegionFeedUrl = process.env.CLOUD_REGION_FEED_URL;
  if (cloudRegionFeedUrl) {
    signals.push(...(await runPagedSource(sourceReport, "public-cloud-regions", options, (page) =>
      fetchCloudRegionSignals({
        feedUrl: cloudRegionFeedUrl,
        limit: page.limit,
        offset: page.offset,
        page: page.page
      })
    )));
  } else {
    skipSource(sourceReport, "public-cloud-regions", "CLOUD_REGION_FEED_URL is not set");
  }
  const waterDistrictFeedUrl = process.env.WATER_DISTRICT_FEED_URL;
  if (waterDistrictFeedUrl) {
    signals.push(...(await runPagedSource(sourceReport, "water-district-permits", options, (page) =>
      fetchWaterDistrictSignals({
        feedUrl: waterDistrictFeedUrl,
        jurisdiction: process.env.WATER_DISTRICT_JURISDICTION,
        limit: page.limit,
        offset: page.offset,
        page: page.page
      })
    )));
  } else {
    skipSource(sourceReport, "water-district-permits", "WATER_DISTRICT_FEED_URL is not set");
  }
  const usgsMineralsFeedUrl = process.env.USGS_MINERALS_FEED_URL;
  if (usgsMineralsFeedUrl) {
    signals.push(...(await runPagedSource(sourceReport, "usgs-minerals", options, (page) =>
      fetchUsgsMineralSignals({
        feedUrl: usgsMineralsFeedUrl,
        limit: page.limit,
        offset: page.offset,
        page: page.page
      })
    )));
  } else {
    skipSource(sourceReport, "usgs-minerals", "USGS_MINERALS_FEED_URL is not set");
  }
  const portStatisticsFeedUrl = process.env.PORT_STATISTICS_FEED_URL;
  if (portStatisticsFeedUrl) {
    signals.push(...(await runPagedSource(sourceReport, "port-statistics", options, (page) =>
      fetchPortStatisticSignals({
        feedUrl: portStatisticsFeedUrl,
        limit: page.limit,
        offset: page.offset,
        page: page.page
      })
    )));
  } else {
    skipSource(sourceReport, "port-statistics", "PORT_STATISTICS_FEED_URL is not set");
  }
  const narrativeFeedUrl = process.env.NARRATIVE_FEED_URL;
  if (narrativeFeedUrl) {
    signals.push(...(await runPagedSource(sourceReport, "narrative-rss", options, (page) =>
      fetchNarrativeSignals({
        feedUrl: narrativeFeedUrl,
        limit: page.limit,
        offset: page.offset,
        page: page.page
      })
    )));
  } else {
    skipSource(sourceReport, "narrative-rss", "NARRATIVE_FEED_URL is not set");
  }
  const eiaApiKey = process.env.EIA_API_KEY;
  const eiaFeedUrl = process.env.EIA_FEED_URL;
  if (eiaApiKey && eiaFeedUrl) {
    signals.push(...(await runPagedSource(sourceReport, "eia-electricity", options, (page) =>
      fetchEiaSignals({
        baseUrl: eiaFeedUrl,
        apiKey: eiaApiKey,
        limit: page.limit,
        offset: page.offset
      })
    )));
  } else {
    skipSource(sourceReport, "eia-electricity", "EIA_API_KEY or EIA_FEED_URL is not set");
  }
  const statePucFeedUrl = process.env.STATE_PUC_FEED_URL;
  if (statePucFeedUrl) {
    signals.push(...(await runPagedSource(sourceReport, "state-puc-filings", options, (page) =>
      fetchStatePucSignals({
        feedUrl: statePucFeedUrl,
        limit: page.limit,
        offset: page.offset,
        page: page.page
      })
    )));
  } else {
    skipSource(sourceReport, "state-puc-filings", "STATE_PUC_FEED_URL is not set");
  }
  signals.push(...(await runPagedSource(sourceReport, "uspto-patents", options, (page) =>
    fetchPatentSignals({
      baseUrl: process.env.USPTO_PATENTS_FEED_URL ?? process.env.PATENT_FEED_URL,
      assignee: process.env.PATENT_ASSIGNEE,
      cpcGroup: process.env.PATENT_CPC_GROUP,
      limit: page.limit,
      page: page.page
    })
  )));
  signals.push(...(await runSource(sourceReport, "epa-echo-npdes", options, () =>
    fetchEpaEchoSignals({
        baseUrl: process.env.EPA_ECHO_FEED_URL,
        state: process.env.EPA_ECHO_STATE,
        limit
      })
  )));
  const faaOasFeedUrl = process.env.FAA_OAS_FEED_URL;
  if (faaOasFeedUrl) {
    signals.push(...(await runPagedSource(sourceReport, "faa-oas", options, (page) =>
      fetchFaaObstructionSignals({
        feedUrl: faaOasFeedUrl,
        limit: page.limit,
        offset: page.offset,
        page: page.page
      })
    )));
  } else {
    skipSource(sourceReport, "faa-oas", "FAA_OAS_FEED_URL is not set");
  }
  signals.push(...(await runSource(sourceReport, "fred-economic", options, () =>
    fetchFredSignals({ apiKey: process.env.FRED_API_KEY, dryRun: options.dryRun })
  )));
  signals.push(...(await runSource(sourceReport, "federal-register", options, () =>
    fetchFederalRegisterSignals({ dryRun: options.dryRun })
  )));
  signals.push(...(await runSource(sourceReport, "edinet", options, () =>
    fetchEdinetSignals({ apiKey: process.env.EDINET_API_KEY, dryRun: options.dryRun })
  )));
  signals.push(...(await runSource(sourceReport, "companies-house", options, () =>
    fetchCompaniesHouseSignals({ dryRun: options.dryRun })
  )));
  signals.push(...(await runSource(sourceReport, "usaspending", options, () =>
    fetchUsaspendingSignals({ dryRun: options.dryRun })
  )));
  signals.push(...(await runSource(sourceReport, "opensanctions", options, () =>
    fetchOpenSanctionsSignals({ dryRun: options.dryRun, seedNames: loadEntitySeeds().map((seed) => seed.name ?? "").filter(Boolean) })
  )));
  signals.push(...(await runSource(sourceReport, "fema", options, () =>
    fetchFemaSignals({
      dryRun: options.dryRun,
      entityLocations: loadEntitySeeds().slice(0, 50).map((seed) => ({ name: seed.name ?? "", state: seed.region === "US" ? "TX" : undefined }))
    })
  )));
  signals.push(...(await runSource(sourceReport, "sam-gov", options, () =>
    fetchSamGovSignals({
      dryRun: options.dryRun,
      apiKey: process.env.SAM_GOV_API_KEY,
      seedNames: loadEntitySeeds().map((seed) => seed.name ?? "").filter(Boolean)
    })
  )));
  signals.push(...(await runSource(sourceReport, "nrc", options, () =>
    fetchNrcSignals({ dryRun: options.dryRun })
  )));
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
    signals.push(...(await runPagedSource(sourceReport, source.id, options, (page) =>
      fetchConfiguredSourceSignals({
        source,
        feedUrl,
        limit: page.limit,
        offset: page.offset,
        page: page.page
      })
    )));
  }

  const failedSources = sourceReport.filter((source) => !source.ok);
  if (options.warnOnSourceFailure) warnSourceFailures(failedSources);
  if (options.failOnSourceError && failedSources.length) {
    throw new Error(`Live scrape failed for required source(s): ${failedSources.map((source) => `${source.id}: ${source.error}`).join("; ")}`);
  }

  return { signals, sourceReport };
}

async function collectRelationshipLinks(options: ScrapeOptions) {
  if (options.dryRun) return { ontologyLinks: [], ontologyObjects: [] };

  const seeds = loadEntitySeeds();
  const userAgent = process.env.SEC_EDGAR_USER_AGENT;
  const gleifBaseUrl = process.env.GLEIF_API_URL;
  const wikidataUserAgent = process.env.WIKIDATA_USER_AGENT;

  const allLinks: import("../lib/pipeline/types.ts").OntologyLinkDraft[] = [];
  const allObjects: import("../lib/pipeline/types.ts").OntologyObjectDraft[] = [];

  // T112: SEC EDGAR Exhibit 21 subsidiary links (US seeds with CIKs)
  if (userAgent && sourceSelected(options, "sec-edgar-ex21")) {
    const usCiks = seeds
      .filter((s) => s.region === "US" && typeof s.cik === "string" && s.cik.length > 0)
      .map((s) => s.cik as string);
    if (usCiks.length) {
      try {
        const subsidiaryLinks = await fetchSubsidiaryLinksBatch(usCiks, {
          userAgent,
          baseUrl: process.env.SEC_EDGAR_BASE_URL
        });
        allLinks.push(...subsidiaryLinks);
        console.log(`sec-edgar-ex21: collected ${subsidiaryLinks.length} subsidiary links`);
      } catch (err) {
        console.warn(`sec-edgar-ex21 collection failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // T113: GLEIF LEI parent-child relationships
  if (sourceSelected(options, "gleif")) {
    const leis = seeds
      .filter((s) => typeof s.lei === "string" && s.lei.length > 0)
      .map((s) => s.lei as string);
    if (leis.length) {
      try {
        const gleifLinks = await fetchGleifRelationshipsBatch(leis, { baseUrl: gleifBaseUrl });
        allLinks.push(...gleifLinks);
        console.log(`gleif: collected ${gleifLinks.length} relationship links`);
      } catch (err) {
        console.warn(`gleif collection failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // T114: Wikidata SPARQL supplementary relationships
  if (sourceSelected(options, "wikidata")) {
    const wikidataIds = seeds
      .filter((s) => typeof s.wikidata_id === "string" && s.wikidata_id.length > 0)
      .map((s) => s.wikidata_id as string);
    if (wikidataIds.length) {
      try {
        const wikidataResult = await fetchWikidataRelationships(wikidataIds, {
          userAgent: wikidataUserAgent
        });
        allLinks.push(...wikidataResult.links);
        allObjects.push(...wikidataResult.objects);
        console.log(
          `wikidata: collected ${wikidataResult.links.length} links, ${wikidataResult.objects.length} objects`
        );
      } catch (err) {
        console.warn(`wikidata collection failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { ontologyLinks: allLinks, ontologyObjects: allObjects };
}

async function sendSlackNotifications(plan: import("../lib/pipeline/types.ts").IngestionPlan) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const minPriority = (process.env.SLACK_NOTIFY_MIN_PRIORITY ?? "CRITICAL").toLowerCase();
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const minLevel = priorityOrder[minPriority] ?? 0;

  const qualifyingAlerts = plan.alerts.filter((alert) => {
    const level = priorityOrder[alert.priority.toLowerCase()] ?? 99;
    return level <= minLevel;
  });

  let sentCount = 0;
  for (const alert of qualifyingAlerts) {
    await sendSlackAlert({
      title: alert.title,
      priority: alert.priority,
      confidence: alert.confidence,
      description: alert.description,
      source: alert.evidence[0]?.sourceId ?? "odim"
    });
    sentCount++;
  }

  if (sentCount > 0) {
    console.log(`Slack notification sent for ${sentCount} alert(s)`);
  }
}

async function sendBrowserPushNotifications(plan: import("../lib/pipeline/types.ts").IngestionPlan) {
  const criticalAlerts = plan.alerts.filter((alert) => alert.priority === "critical");
  for (const alert of criticalAlerts) {
    await broadcastPushAlert({
      id: alert.id,
      title: alert.title,
      priority: alert.priority,
      description: alert.description
    });
  }
}

async function prepareScrape(args = process.argv.slice(2)): Promise<PreparedScrape> {
  const options = resolveScrapeOptions(args);
  const live = await collectLiveSignals(options);
  const signals = live.signals;
  if (signals.length < options.minSignals) {
    throw new Error(`Scrape produced ${signals.length} raw signals, below SCRAPE_MIN_SIGNALS=${options.minSignals}`);
  }
  const plan = buildIngestionPlan(signals);

  // Collect relationship links (T112/T113/T114) — merged into the plan
  if (!options.dryRun) {
    const relationshipData = await collectRelationshipLinks(options);
    plan.ontologyLinks.push(...relationshipData.ontologyLinks);
    plan.ontologyObjects.push(...relationshipData.ontologyObjects);
  }

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
    await recordEntityScoreSnapshots(client, prepared.plan.ontologyObjects);
    await updateSourceWatermarks(client, options, result.sources);
    const freshness = checkFreshness(
      result.sources.map((source) => ({
        sourceId: source.id,
        lastSuccessAt: source.lastObservedAt ?? null,
        lastObservedAt: source.lastObservedAt ?? null,
        rawSignalCount: source.count
      }))
    );
    const stale = freshness.filter((entry) => entry.status === "critical");
    if (stale.length) {
      console.warn(`freshness SLA violated: ${stale.map((entry) => entry.sourceId).join(", ")}`);
    }
    await recordIngestionRunSuccess(client, runId, result);
    await sendSlackNotifications(prepared.plan);
    await sendBrowserPushNotifications(prepared.plan);
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

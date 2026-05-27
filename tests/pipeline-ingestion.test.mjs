import assert from "node:assert/strict";
import test from "node:test";
import { buildIngestionPlan } from "../lib/pipeline/ontologize.ts";
import { normalizeSignal } from "../lib/pipeline/normalize.ts";
import { toDatabaseRows, upsertIngestionPlan } from "../lib/pipeline/ingest.ts";
import { parseBuildingPermitRecords } from "../scrapers/building-permits.ts";
import { fetchConfiguredSourceSignals, parseConfiguredSourceRecords } from "../scrapers/configured-source.ts";
import { parseCloudRegionRecords } from "../scrapers/cloud-regions.ts";
import { parseFercRecords } from "../scrapers/ferc.ts";
import { fetchEiaSignals } from "../scrapers/eia.ts";
import { parseNarrativeRecords } from "../scrapers/narrative.ts";
import { fetchPatentSignals } from "../scrapers/patent.ts";
import { parsePortStatisticRecords } from "../scrapers/port-statistics.ts";
import { parseSecSubmissions } from "../scrapers/sec-edgar.ts";
import { parseUsgsMineralRecords } from "../scrapers/usgs-minerals.ts";
import { parseWaterDistrictRecords } from "../scrapers/water-districts.ts";

test("SEC EDGAR submissions become source-backed cash signals", () => {
  const signals = parseSecSubmissions({
    cik: "1326801",
    name: "Meta Platforms, Inc.",
    tickers: ["META"],
    filings: {
      recent: {
        accessionNumber: ["0001326801-26-000042", "0001326801-26-000041"],
        filingDate: ["2026-05-20", "2026-05-19"],
        form: ["8-K", "10-Q"],
        primaryDocument: ["meta-8k.htm", "meta-10q.htm"]
      }
    }
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0].layer, "cash");
  assert.equal(signals[0].sourceRefs[0].sourceId, "sec-edgar");
  assert.match(signals[0].sourceRefs[0].url, /Archives\/edgar\/data/);
});

test("FERC and building permit records parse into Reality Layer signals", () => {
  const fercSignals = parseFercRecords(
    [
      {
        applicant: "Entergy Louisiana, LLC",
        capacityMw: "2200",
        docketNumber: "ER26-2042",
        filingDate: "2026-05-19",
        projectName: "Richland Parish large load"
      }
    ],
    "https://elibrary.ferc.gov/eLibrary/search"
  );
  const permitSignals = parseBuildingPermitRecords(
    [
      {
        applicant: "Laidley LLC",
        issuedAt: "2026-05-18",
        latitude: "32.418",
        longitude: "-91.746",
        permitNumber: "RP-DC-2026-0518"
      }
    ],
    "https://example.local/permits",
    "Richland Parish, LA"
  );

  assert.equal(fercSignals[0].layer, "energy");
  assert.equal(permitSignals[0].layer, "land");
  assert.equal(permitSignals[0].payload.jurisdiction, "Richland Parish, LA");
});

test("remaining Reality Layer adapters emit source-backed signals", () => {
  const cloud = parseCloudRegionRecords(
    [{ announcedAt: "2026-05-17", provider: "Microsoft", regionName: "US Southeast AI region" }],
    "https://example.local/cloud"
  );
  const water = parseWaterDistrictRecords(
    [{ applicant: "Laidley LLC", application_id: "WTR-42", date: "2026-05-16" }],
    "https://example.local/water"
  );
  const minerals = parseUsgsMineralRecords(
    [{ commodity: "copper", mine_name: "Resolution Copper", operator: "Rio Tinto", year: "2026" }],
    "https://example.local/usgs"
  );
  const logistics = parsePortStatisticRecords(
    [{ period_end: "2026-05-15", port: "Port Houston", teu: "352000" }],
    "https://example.local/ports"
  );

  assert.deepEqual(
    [cloud[0].layer, water[0].layer, minerals[0].layer, logistics[0].layer],
    ["compute", "water", "raw_materials", "logistics"]
  );
  assert.ok([cloud, water, minerals, logistics].flat().every((signal) => signal.sourceRefs.length === 1));
});

test("normalization enforces source refs and deterministic fingerprints", () => {
  const rawSignal = {
    layer: "Cash",
    source: "sec-edgar",
    externalId: "0001326801-26-000042",
    observedAt: "2026-05-20",
    sourceRefs: [
      {
        sourceId: "sec-edgar",
        url: "https://www.sec.gov/example",
        title: "Meta 8-K"
      }
    ],
    payload: { form: "8-K" }
  };
  const first = normalizeSignal(rawSignal);
  const second = normalizeSignal(rawSignal);

  assert.equal(first.layer, "cash");
  assert.equal(first.id, second.id);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.throws(() => normalizeSignal({ ...rawSignal, sourceRefs: [] }), /sourceRefs/);
});

test("ingestion plan is idempotent and carries audit evidence", () => {
  const signals = [
    ...parseSecSubmissions({
      cik: "1326801",
      name: "Meta Platforms, Inc.",
      tickers: ["META"],
      filings: {
        recent: {
          accessionNumber: ["0001326801-26-000042"],
          filingDate: ["2026-05-20"],
          form: ["8-K"],
          primaryDocument: ["meta-8k.htm"]
        }
      }
    }),
    ...parseFercRecords(
      [
        {
          applicant: "Entergy Louisiana, LLC",
          capacityMw: "2200",
          docketNumber: "ER26-2042",
          filingDate: "2026-05-19",
          projectName: "Richland Parish large load"
        }
      ],
      "https://elibrary.ferc.gov/eLibrary/search"
    )
  ];
  const plan = buildIngestionPlan([...signals, ...signals]);
  const rows = toDatabaseRows(plan);

  assert.equal(plan.rawSignals.length, 2);
  assert.ok(plan.ontologyObjects.some((object) => object.objectType === "permit_filing"));
  assert.ok(plan.ontologyLinks.every((link) => link.sourceRefs.length > 0 && link.confidence > 0));
  assert.ok(plan.alerts.some((alert) => alert.priority === "critical"));
  assert.ok(plan.auditEvents.every((event) => event.sourceRefs.length > 0 && event.dedupeKey));
  assert.equal(rows.rawSignals.length, 2);
  assert.equal(rows.rawSignals[0].org_id, null);
  assert.equal(rows.alerts.length, plan.alerts.length);
  assert.ok("fingerprint" in rows.rawSignals[0]);
  assert.ok("source_refs" in rows.auditEvents[0]);
});

test("database upsert uses durable conflict keys for replays", async () => {
  const signals = parseFercRecords(
    [
      {
        applicant: "Entergy Louisiana, LLC",
        capacityMw: "2200",
        docketNumber: "ER26-2042",
        filingDate: "2026-05-19",
        projectName: "Richland Parish large load"
      }
    ],
    "https://elibrary.ferc.gov/eLibrary/search"
  );
  const plan = buildIngestionPlan(signals);
  const calls = [];
  const client = {
    from(table) {
      return {
        async upsert(rows, options) {
          calls.push({ table, count: rows.length, onConflict: options?.onConflict });
          return { error: null };
        }
      };
    }
  };

  await upsertIngestionPlan(client, plan);

  assert.deepEqual(
    calls.map((call) => [call.table, call.onConflict]),
    [
      ["raw_signals", "fingerprint"],
      ["ontology_objects", "id"],
      ["ontology_links", "id"],
      ["alerts", "dedupe_key"],
      ["audit_log", "dedupe_key"]
    ]
  );
});

test("narrative signals are audited but not promoted into ontology truth", () => {
  const narrative = parseNarrativeRecords(
    [
      {
        company: "Meta Platforms",
        date: "2026-05-21",
        headline: "Meta says no near-term Louisiana data center announcement is planned",
        outlet: "Public IR feed",
        url: "https://example.local/narrative/meta"
      }
    ],
    "https://example.local/narrative"
  );
  const plan = buildIngestionPlan(narrative);

  assert.equal(plan.rawSignals.length, 1);
  assert.equal(plan.rawSignals[0].layer, "narrative");
  assert.equal(plan.ontologyObjects.length, 0);
  assert.equal(plan.ontologyLinks.length, 0);
  assert.equal(plan.alerts.length, 1);
  assert.equal(plan.auditEvents[0].eventType, "raw_signal_ingested");
});

test("configured paid sources can enter the pipeline without code-specific adapters", () => {
  const source = {
    id: "paid-grid-feed",
    layer: "energy",
    region: "us",
    enabled: true,
    sourceTier: "paid",
    adapter: "configured-json-csv",
    urlEnv: "PAID_GRID_URL",
    confidence: 0.77,
    fieldMap: {
      externalId: ["record_id"],
      observedAt: ["date"],
      title: ["project_name"],
      url: ["document_url"]
    },
    payloadMap: {
      applicantRaw: ["company"],
      projectName: ["project_name"],
      capacityMw: ["mw"],
      description: ["description"]
    }
  };
  const signals = parseConfiguredSourceRecords(
    source,
    [
      {
        company: "GridCo LLC",
        date: "2026-05-23",
        description: "Substation interconnect for large compute load",
        document_url: "https://vendor.local/grid/42",
        mw: "180",
        project_name: "Arc Load Interconnect",
        record_id: "GRID-42"
      }
    ],
    "https://vendor.local/grid"
  );
  const plan = buildIngestionPlan(signals);

  assert.equal(signals[0].isProprietary, true);
  assert.equal(signals[0].sourceRefs[0].sourceId, "paid-grid-feed");
  assert.ok(plan.ontologyObjects.some((object) => object.objectType === "permit_filing"));
  assert.ok(plan.ontologyLinks.every((link) => link.sourceRefs.length > 0));
});

test("paid configured source fetch requires org binding for RLS visibility", async () => {
  const source = {
    id: "paid-grid-feed",
    layer: "energy",
    sourceTier: "paid",
    adapter: "configured-json-csv",
    orgIdEnv: "TEST_PAID_SOURCE_ORG_ID",
    fieldMap: {
      externalId: ["id"],
      observedAt: ["date"]
    }
  };
  const previous = process.env.TEST_PAID_SOURCE_ORG_ID;
  delete process.env.TEST_PAID_SOURCE_ORG_ID;
  await assert.rejects(
    () => fetchConfiguredSourceSignals({ source, feedUrl: "https://vendor.local/grid", fetchImpl: async () => new Response("[]") }),
    /TEST_PAID_SOURCE_ORG_ID/
  );

  process.env.TEST_PAID_SOURCE_ORG_ID = "11111111-1111-4111-8111-111111111111";
  try {
    const signals = await fetchConfiguredSourceSignals({
      source,
      feedUrl: "https://vendor.local/grid",
      fetchImpl: async () =>
        new Response(JSON.stringify([{ id: "GRID-43", date: "2026-05-24" }]), {
          headers: { "content-type": "application/json" }
        })
    });
    assert.equal(signals[0].orgId, "11111111-1111-4111-8111-111111111111");
  } finally {
    if (previous === undefined) delete process.env.TEST_PAID_SOURCE_ORG_ID;
    else process.env.TEST_PAID_SOURCE_ORG_ID = previous;
  }
});

test("paged public-source fetchers emit stable backfill requests", async () => {
  const eiaUrls = [];
  const eiaSignals = await fetchEiaSignals({
    apiKey: "test-key",
    baseUrl: "https://api.eia.gov/v2",
    limit: 25,
    offset: 50,
    fetchImpl: async (url) => {
      eiaUrls.push(String(url));
      return new Response(JSON.stringify({ response: { data: [{ plantid: "42", period: "2024-01", plantName: "Grid Plant" }] } }), {
        headers: { "content-type": "application/json" }
      });
    }
  });
  assert.match(eiaUrls[0], /offset=50/);
  assert.match(eiaUrls[0], /length=25/);
  assert.equal(eiaSignals[0].externalId, "eia:42:2024-01");

  const patentUrls = [];
  const patentSignals = await fetchPatentSignals({
    baseUrl: "https://search.patentsview.org/api/v1/patent/",
    limit: 20,
    page: 3,
    fetchImpl: async (url) => {
      patentUrls.push(String(url));
      return new Response(JSON.stringify({ patents: [{ patent_id: "1234567", patent_date: "2024-02-03", patent_title: "Cooling system" }] }), {
        headers: { "content-type": "application/json" }
      });
    }
  });
  assert.match(patentUrls[0], /page=3/);
  assert.match(patentUrls[0], /per_page=20/);
  assert.equal(patentSignals[0].externalId, "patent:1234567");
});

test("configured JSON/CSV sources support paging placeholders and query parameters", async () => {
  const source = {
    id: "public-feed",
    layer: "energy",
    adapter: "configured-json-csv",
    fieldMap: {
      externalId: ["id"],
      observedAt: ["date"]
    }
  };
  const requestedUrls = [];
  const signals = await fetchConfiguredSourceSignals({
    source,
    feedUrl: "https://example.local/feed?batch={page}&from={offset}&size={limit}",
    limit: 10,
    offset: 20,
    page: 3,
    fetchImpl: async (url) => {
      requestedUrls.push(String(url));
      return new Response(JSON.stringify([{ id: "A-1", date: "2024-03-04" }]), {
        headers: { "content-type": "application/json" }
      });
    }
  });

  assert.equal(requestedUrls[0], "https://example.local/feed?batch=3&from=20&size=10");
  assert.equal(signals[0].externalId, "A-1");
});

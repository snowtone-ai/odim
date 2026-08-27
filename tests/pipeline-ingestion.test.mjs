import assert from "node:assert/strict";
import test from "node:test";
import { buildIngestionPlan } from "../lib/pipeline/ontologize.ts";
import { normalizeSignal } from "../lib/pipeline/normalize.ts";
import { toDatabaseRows, upsertIngestionPlan } from "../lib/pipeline/ingest.ts";
import { fetchBuildingPermitSignals, parseBuildingPermitRecords } from "../scrapers/building-permits.ts";
import { parseCsvRows } from "../scrapers/common.ts";
import { fetchConfiguredSourceSignals, parseConfiguredSourceRecords } from "../scrapers/configured-source.ts";
import { fetchCloudRegionSignals, parseCloudRegionRecords } from "../scrapers/cloud-regions.ts";
import { fetchFercSignals, parseFercRecords } from "../scrapers/ferc.ts";
import { fetchEiaSignals } from "../scrapers/eia.ts";
import { parseEpaEchoRecords } from "../scrapers/epa-echo.ts";
import { parseFaaObstructionRecords } from "../scrapers/faa-obstructions.ts";
import { fetchNarrativeSignals, parseNarrativeRecords } from "../scrapers/narrative.ts";
import { fetchPatentSignals } from "../scrapers/patent.ts";
import { parsePortStatisticRecords } from "../scrapers/port-statistics.ts";
import { fetchSecEdgarSignals, parseSecSubmissions } from "../scrapers/sec-edgar.ts";
import { fetchSecFormDSignals, parseSecFormDIndex, parseSecFormDXml } from "../scrapers/sec-form-d.ts";
import { collectLiveSignals } from "../scrapers/run.ts";
import { parsePucRecords } from "../scrapers/state-puc.ts";
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

test("SEC EDGAR backfill follows historical submission files", async () => {
  const requestedUrls = [];
  const signals = await fetchSecEdgarSignals({
    ciks: ["1326801"],
    baseUrl: "https://data.sec.gov/submissions",
    includeHistorical: true,
    historicalFileLimit: 2,
    limit: 3,
    userAgent: "Odim test contact@example.com",
    fetchImpl: async (url) => {
      requestedUrls.push(String(url));
      if (String(url).endsWith("CIK0001326801.json")) {
        return new Response(
          JSON.stringify({
            cik: "1326801",
            name: "Meta Platforms, Inc.",
            tickers: ["META"],
            filings: {
              recent: {
                accessionNumber: ["0001326801-26-000042"],
                filingDate: ["2026-05-20"],
                form: ["8-K"],
                primaryDocument: ["meta-8k.htm"]
              },
              files: [{ name: "CIK0001326801-submissions-001.json" }]
            }
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          accessionNumber: ["0001326801-20-000001", "0001326801-19-000002"],
          filingDate: ["2020-01-02", "2019-05-03"],
          form: ["S-1", "10-K"],
          primaryDocument: ["meta-s1.htm", "meta-10k.htm"]
        }),
        { headers: { "content-type": "application/json" } }
      );
    }
  });

  assert.deepEqual(requestedUrls, [
    "https://data.sec.gov/submissions/CIK0001326801.json",
    "https://data.sec.gov/submissions/CIK0001326801-submissions-001.json"
  ]);
  assert.equal(signals.length, 2);
  assert.equal(signals[1].externalId, "0001326801-20-000001");
  assert.equal(signals[1].payload.companyName, "Meta Platforms, Inc.");
});

test("SEC Form D parses a primary XML filing as an unconfirmed capital raise candidate", () => {
  const signal = parseSecFormDXml(
    "<edgarSubmission><primaryIssuer><cik>0001999999</cik><entityName>Example Raise LLC</entityName><entityType>Limited Liability Company</entityType><issuerAddress><street1>100 Example Way</street1><city>Austin</city><stateOrCountry>TX</stateOrCountry><zipCode>78701</zipCode></issuerAddress></primaryIssuer><relatedPersonsList><relatedPersonInfo><relatedPersonName><firstName>Ada</firstName><lastName>Lovelace</lastName></relatedPersonName><relatedPersonAddress><city>Austin</city><stateOrCountry>TX</stateOrCountry></relatedPersonAddress></relatedPersonInfo></relatedPersonsList><offeringData><industryGroup><industryGroupType>Other Technology</industryGroupType></industryGroup><dateOfFirstSale><value>2026-05-20</value></dateOfFirstSale><offeringSalesAmounts><totalOfferingAmount>25000000</totalOfferingAmount><totalAmountSold>7500000</totalAmountSold><totalRemaining>17500000</totalRemaining></offeringSalesAmounts></offeringData></edgarSubmission>",
    {
      accessionNumber: "0001999999-26-000001",
      cik: "0001999999",
      filingDate: "2026-05-21",
      sourceUrl: "https://www.sec.gov/Archives/edgar/data/1999999/000199999926000001/primary_doc.xml"
    }
  );
  const plan = buildIngestionPlan([signal]);

  assert.equal(signal.layer, "cash");
  assert.equal(signal.payload.classification, "capital_raise_candidate");
  assert.equal(signal.payload.physicalInvestmentStatus, "not_proven");
  assert.equal(signal.payload.evidenceScope, "single_sec_form_d_filing");
  assert.equal(signal.payload.offeringAmountUsd, 25000000);
  assert.equal(signal.payload.amountSoldUsd, 7500000);
  assert.equal(signal.payload.remainingAmountUsd, 17500000);
  assert.equal(signal.payload.industry, "Other Technology");
  assert.equal(signal.payload.firstSaleDate, "2026-05-20");
  assert.equal(signal.payload.entityType, "Limited Liability Company");
  assert.deepEqual(signal.payload.issuerAddress, {
    city: "Austin",
    stateOrCountry: "TX",
    street1: "100 Example Way",
    zipCode: "78701"
  });
  assert.equal(signal.payload.relatedPeople[0].name, "Ada Lovelace");
  assert.deepEqual(signal.payload.relatedPeople[0].address, { city: "Austin", stateOrCountry: "TX" });
  assert.equal(signal.sourceRefs[0].externalId, "0001999999-26-000001");
  assert.ok(plan.ontologyObjects.some((object) => object.objectType === "capital_raise_candidate"));
  assert.ok(!plan.ontologyLinks.some((link) => link.linkType === "commits_capital_to"));
});

test("SEC Form D excludes unrelated forms and degrades amendments or missing values to low priority", () => {
  const index = [
    "D            Example Raise LLC                  0001999999     2026-05-21  edgar/data/1999999/000199999926000001/primary_doc.xml",
    "D/A          Example Raise LLC                  0001999999     2026-05-21  edgar/data/1999999/000199999926000002/primary_doc.xml",
    "8-K          Example Raise LLC                  0001999999     2026-05-21  edgar/data/1999999/000199999926000003/report.htm"
  ].join("\n");
  const filings = parseSecFormDIndex(index);
  const incompleteAmendment = parseSecFormDXml(
    "<edgarSubmission><primaryIssuer><entityName>Example Raise LLC</entityName></primaryIssuer><offeringData><industryGroup><industryGroupType>Other</industryGroupType></industryGroup></offeringData>",
    {
      accessionNumber: "0001999999-26-000002",
      cik: "0001999999",
      filingDate: "2026-05-21",
      form: "D/A",
      sourceUrl: "https://www.sec.gov/Archives/edgar/data/1999999/000199999926000002/primary_doc.xml"
    }
  );

  assert.deepEqual(filings.map((filing) => filing.form), ["D", "D/A"]);
  assert.equal(incompleteAmendment.payload.priority, "low");
  assert.equal(incompleteAmendment.payload.offeringAmountUsd, undefined);
  assert.deepEqual(incompleteAmendment.payload.relatedPeople, []);
});

test("SEC Form D live fetch follows daily indexes, sends an identifying User-Agent, and requests primary XML", async () => {
  const requested = [];
  const index = "D            Example Raise LLC                  0001999999     2026-05-21  edgar/data/1999999/000199999926000001/0001999999-26-000001.txt\n";
  const submission = "<SEC-DOCUMENT><DOCUMENT>\n<TYPE>D\n<FILENAME>primary_doc.xml\n<TEXT><XML></XML></TEXT></DOCUMENT></SEC-DOCUMENT>";
  const primaryXml = "<edgarSubmission><primaryIssuer><cik>0001999999</cik><entityName>Example Raise LLC</entityName></primaryIssuer><offeringData><offeringSalesAmounts><totalOfferingAmount>25000000</totalOfferingAmount></offeringSalesAmounts></offeringData></edgarSubmission>";
  const signals = await fetchSecFormDSignals({
    archivesBaseUrl: "https://sec.example/Archives/",
    dailyIndexBaseUrl: "https://sec.example/daily-index",
    fetchImpl: async (url, init) => {
      requested.push({ headers: init?.headers, url: String(url) });
      if (String(url).endsWith("form.20260521.idx")) return new Response(index);
      if (String(url).endsWith("0001999999-26-000001.txt")) return new Response(submission);
      if (String(url).endsWith("primary_doc.xml")) return new Response(primaryXml, { headers: { "content-type": "application/xml" } });
      return new Response("not found", { status: 404 });
    },
    indexLookbackDays: 1,
    limit: 1,
    now: "2026-05-21T12:00:00.000Z",
    userAgent: "Odim test contact@example.com"
  });

  assert.deepEqual(requested.map((request) => request.url), [
    "https://sec.example/daily-index/2026/QTR2/form.20260521.idx",
    "https://sec.example/Archives/edgar/data/1999999/000199999926000001/0001999999-26-000001.txt",
    "https://sec.example/Archives/edgar/data/1999999/000199999926000001/primary_doc.xml"
  ]);
  assert.ok(requested.every((request) => request.headers["user-agent"] === "Odim test contact@example.com"));
  assert.equal(signals.length, 1);
  assert.equal(signals[0].sourceRefs[0].url, requested[2].url);
  await assert.rejects(() => fetchSecFormDSignals({ indexLookbackDays: 1, now: "2026-05-21" }), /SEC_EDGAR_USER_AGENT/);
});

test("dry-run source report includes the deterministic SEC Form D fixture", async () => {
  const dryRun = await collectLiveSignals({
    dryRun: true,
    failOnSourceError: false,
    maxPages: 1,
    minSignals: 1,
    mode: "dry-run",
    noWrite: true,
    pageSize: 1,
    sourceIds: [],
    sourceLimit: 50,
    warnOnSourceFailure: true
  });

  assert.ok(dryRun.signals.some((signal) => signal.source === "sec-form-d"));
  assert.ok(dryRun.sourceReport.some((source) => source.id === "sec-form-d" && source.count > 0));
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

test("EPA, FAA, and State PUC parsers emit deterministic source-backed signals", () => {
  const epa = parseEpaEchoRecords(
    [{ SourceID: "NPDES-1", CWPIssueDate: "2026-05-11", CWPName: "Water Facility", FacState: "LA" }],
    "https://example.local/epa"
  );
  const faa = parseFaaObstructionRecords(
    [{ caseNumber: "ASN-1", determinationDate: "2026-05-12", structureType: "Tower", applicant: "GridCo" }],
    "https://example.local/faa"
  );
  const puc = parsePucRecords(
    [{ docketNumber: "PUC-1", filingDate: "2026-05-13", applicant: "UtilityCo", capacityMw: "200" }],
    "https://example.local/puc",
    "TX"
  );
  const firstNormalized = normalizeSignal(epa[0]);
  const secondNormalized = normalizeSignal(epa[0]);

  assert.deepEqual([epa[0].layer, faa[0].layer, puc[0].layer], ["water", "land", "energy"]);
  assert.deepEqual([epa[0].source, faa[0].source, puc[0].source], ["epa-echo-npdes", "faa-oas", "state-puc-filings"]);
  assert.ok([epa, faa, puc].flat().every((signal) => signal.sourceRefs.length === 1));
  assert.equal(firstNormalized.fingerprint, secondNormalized.fingerprint);
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

test("database upsert prefers ingest_batch RPC transaction", async () => {
  const signals = parseFercRecords(
    [{ queue_id: "Q-2", utility: "ERCOT", requested_mw: "150", status: "active", posted_at: "2026-05-20" }],
    "https://example.local/ferc"
  );
  const plan = buildIngestionPlan(signals);
  const calls = [];
  const client = {
    async rpc(functionName, args) {
      calls.push({ functionName, args });
      return { error: null };
    },
    from() {
      throw new Error("sequential fallback should not run when RPC exists");
    }
  };

  await upsertIngestionPlan(client, plan);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].functionName, "ingest_batch");
  assert.equal(calls[0].args.p_signals.length, plan.rawSignals.length);
  assert.equal(calls[0].args.p_objects.length, plan.ontologyObjects.length);
  assert.equal(calls[0].args.p_links.length, plan.ontologyLinks.length);
  assert.equal(calls[0].args.p_alerts.length, plan.alerts.length);
  assert.equal(calls[0].args.p_audit.length, plan.auditEvents.length);
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

test("CSV parser preserves quoted fields with commas and escaped quotes", () => {
  const rows = parseCsvRows('name,description,amount\n"Meta, Inc.","filed ""AI"" capex update",42\n');
  assert.deepEqual(rows, [
    {
      name: "Meta, Inc.",
      description: 'filed "AI" capex update',
      amount: "42"
    }
  ]);
});

test("public JSON/CSV feed adapters pass paging controls through feed URLs", async () => {
  const cases = [
    {
      run: () =>
        fetchFercSignals({
          feedUrl: "https://example.local/ferc?offset={offset}&limit={limit}&page={page}",
          limit: 5,
          offset: 10,
          page: 3,
          fetchImpl: async (url) => {
            requestedUrls.push(String(url));
            return new Response(JSON.stringify([{ docketNumber: "ER24-1", filingDate: "2024-01-02" }]), {
              headers: { "content-type": "application/json" }
            });
          }
        })
    },
    {
      run: () =>
        fetchBuildingPermitSignals({
          feedUrl: "https://example.local/permits",
          limit: 5,
          offset: 10,
          page: 3,
          fetchImpl: async (url) => {
            requestedUrls.push(String(url));
            return new Response(JSON.stringify([{ permitNumber: "P-1", issuedAt: "2024-01-03" }]), {
              headers: { "content-type": "application/json" }
            });
          }
        })
    },
    {
      run: () =>
        fetchCloudRegionSignals({
          feedUrl: "https://example.local/cloud",
          limit: 5,
          offset: 10,
          page: 3,
          fetchImpl: async (url) => {
            requestedUrls.push(String(url));
            return new Response(JSON.stringify([{ announcedAt: "2024-01-04", provider: "AWS", regionName: "us-test-1" }]), {
              headers: { "content-type": "application/json" }
            });
          }
        })
    },
    {
      run: () =>
        fetchNarrativeSignals({
          feedUrl: "https://example.local/news",
          limit: 5,
          offset: 10,
          page: 3,
          fetchImpl: async (url) => {
            requestedUrls.push(String(url));
            return new Response(JSON.stringify([{ date: "2024-01-05", headline: "Utility files interconnect plan" }]), {
              headers: { "content-type": "application/json" }
            });
          }
        })
    }
  ];
  const requestedUrls = [];

  for (const item of cases) {
    const signals = await item.run();
    assert.equal(signals.length, 1);
  }

  assert.equal(requestedUrls[0], "https://example.local/ferc?offset=10&limit=5&page=3");
  for (const url of requestedUrls.slice(1)) {
    assert.match(url, /limit=5/);
    assert.match(url, /offset=10/);
    assert.match(url, /page=3/);
  }
});

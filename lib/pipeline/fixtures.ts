import type { RawSignal } from "./types.ts";
import { parseBuildingPermitRecords } from "../../scrapers/building-permits.ts";
import { parseCloudRegionRecords } from "../../scrapers/cloud-regions.ts";
import { parseFercRecords } from "../../scrapers/ferc.ts";
import { parseNarrativeRecords } from "../../scrapers/narrative.ts";
import { parsePortStatisticRecords } from "../../scrapers/port-statistics.ts";
import { parseSecSubmissions } from "../../scrapers/sec-edgar.ts";
import { parseUsgsMineralRecords } from "../../scrapers/usgs-minerals.ts";
import { parseWaterDistrictRecords } from "../../scrapers/water-districts.ts";
import { parseEiaRecords } from "../../scrapers/eia.ts";
import { parsePucRecords } from "../../scrapers/state-puc.ts";
import { parsePatentRecords } from "../../scrapers/patent.ts";
import { parseEpaEchoRecords } from "../../scrapers/epa-echo.ts";
import { parseFaaObstructionRecords } from "../../scrapers/faa-obstructions.ts";
import { parseFredSeriesObservations } from "../../scrapers/fred.ts";
import { parseFederalRegisterResults } from "../../scrapers/federal-register.ts";
import { parseEdinetDocuments } from "../../scrapers/edinet.ts";
import { parseCompaniesHouseFilings } from "../../scrapers/companies-house.ts";
import { parseUsaspendingAwards } from "../../scrapers/usaspending.ts";
import { parseForm4Xml } from "../../scrapers/sec-edgar-form4.ts";
import { parse8KSubmission } from "../../scrapers/sec-edgar-8k.ts";
import { parse13DGDocument } from "../../scrapers/sec-edgar-13dg.ts";
import { parse13FInformationTable } from "../../scrapers/sec-edgar-13f.ts";
import { parseOpenSanctionsMatches } from "../../scrapers/opensanctions.ts";
import { parseFemaDeclarations } from "../../scrapers/fema.ts";
import { parseSamOpportunities } from "../../scrapers/sam-gov.ts";
import { parseNrcActions } from "../../scrapers/nrc.ts";

export function buildFixtureRawSignals(): RawSignal[] {
  const secSignals = parseSecSubmissions(
    {
      cik: "1326801",
      name: "Meta Platforms, Inc.",
      tickers: ["META"],
      filings: {
        recent: {
          accessionNumber: ["0001326801-26-000042"],
          filingDate: ["2026-05-20"],
          form: ["8-K"],
          primaryDocument: ["meta-20260520.htm"],
          reportDate: ["2026-05-20"],
          items: ["1.01"]
        }
      }
    },
    10
  );
  const fercSignals = parseFercRecords(
    [
      {
        applicant: "Entergy Louisiana, LLC",
        capacityMw: "2200",
        description: "Large-load interconnection service agreement for data center campus",
        docketNumber: "ER26-2042",
        filingDate: "2026-05-19",
        projectName: "Richland Parish large load"
      }
    ],
    "https://elibrary.ferc.gov/eLibrary/search",
    10
  );
  const permitSignals = parseBuildingPermitRecords(
    [
      {
        address: "Richland Parish, LA",
        applicant: "Laidley LLC",
        description: "Shell building and electrical yard for data center campus",
        issuedAt: "2026-05-18",
        latitude: "32.418",
        longitude: "-91.746",
        permitNumber: "RP-DC-2026-0518",
        status: "approved"
      }
    ],
    "https://example.local/permits",
    "Richland Parish, LA",
    10
  );
  const cloudSignals = parseCloudRegionRecords(
    [
      {
        announcedAt: "2026-05-17",
        latitude: "35.7796",
        longitude: "-78.6382",
        location: "North Carolina",
        provider: "Microsoft",
        regionName: "US Southeast AI region",
        status: "announced"
      }
    ],
    "https://example.local/cloud-regions",
    10
  );
  const waterSignals = parseWaterDistrictRecords(
    [
      {
        applicant: "Laidley LLC",
        application_id: "WTR-2026-0042",
        date: "2026-05-16",
        gallons_per_day: "4800000",
        status: "submitted",
        water_district: "Richland Parish Water District"
      }
    ],
    "https://example.local/water",
    "Richland Parish Water District",
    10
  );
  const mineralSignals = parseUsgsMineralRecords(
    [
      {
        commodity: "copper",
        country: "United States",
        mine_name: "Resolution Copper",
        operator: "Rio Tinto",
        production_tonnes: "120000",
        year: "2026"
      }
    ],
    "https://example.local/usgs-minerals",
    10
  );
  const portSignals = parsePortStatisticRecords(
    [
      {
        latitude: "29.7604",
        longitude: "-95.3698",
        metric: "container_throughput",
        period_end: "2026-05-15",
        port: "Port Houston",
        teu: "352000",
        unit: "TEU"
      }
    ],
    "https://example.local/ports",
    10
  );
  const narrativeSignals = parseNarrativeRecords(
    [
      {
        company: "Meta Platforms",
        date: "2026-05-21",
        headline: "Meta says no near-term Louisiana data center announcement is planned",
        outlet: "Public IR feed",
        topic: "data center capex",
        url: "https://example.local/narrative/meta"
      }
    ],
    "https://example.local/narrative",
    10
  );

  const eiaSignals = parseEiaRecords(
    [
      {
        plantId: "GEN-2026-0142",
        plantName: "Moss Landing Energy Storage",
        state: "CA",
        capacityMw: "400",
        fuelType: "battery_storage",
        status: "under_construction",
        balancingAuthority: "CAISO",
        reportPeriod: "2026-Q2"
      }
    ],
    "https://api.eia.gov/v2/electricity/facility",
    10
  );
  const statePucSignals = parsePucRecords(
    [
      {
        applicant: "Vistra Corp",
        docketNumber: "PUC-52847",
        jurisdiction: "TX PUC",
        projectName: "Odessa Solar + Storage",
        capacityMw: "350",
        status: "approved",
        filingDate: "2026-05-10"
      }
    ],
    "https://example.local/state-puc",
    "TX PUC",
    10
  );
  const patentSignals = parsePatentRecords(
    [
      {
        patentNumber: "US12345678B2",
        title: "Method for Liquid Immersion Cooling of High-Density GPU Clusters",
        assigneeName: "NVIDIA Corporation",
        filingDate: "2024-11-15",
        grantDate: "2026-05-22",
        cpcGroup: "H05K7/20"
      }
    ],
    "https://api.patentsview.org/patents/query",
    10
  );
  const epaEchoSignals = parseEpaEchoRecords(
    [
      {
        facilityName: "Laidley LLC Data Center Campus",
        permitNumber: "LA0123456",
        issueDate: "2026-05-12",
        expirationDate: "2031-05-12",
        facilityType: "Industrial",
        lat: "32.418",
        lng: "-91.746",
        state: "LA"
      }
    ],
    "https://echo.epa.gov/detailed-facility-report",
    10
  );
  const faaSignals = parseFaaObstructionRecords(
    [
      {
        caseNumber: "2026-ASW-12847",
        structureType: "Building",
        height: "120",
        lat: "32.42",
        lng: "-91.75",
        city: "Rayville",
        state: "LA",
        applicant: "Laidley LLC",
        determinationDate: "2026-05-08",
        status: "Determined - No Hazard"
      }
    ],
    "https://oeaaa.faa.gov/oeaaa/external/searchAction.jsp",
    10
  );
  const fredSignals = parseFredSeriesObservations(
    { id: "T10Y2Y", layer: "cash", label: "Yield Curve Spread" },
    { date: "2026-05-20", value: "-0.42" }
  );
  const federalRegisterSignals = parseFederalRegisterResults([
    { document_number: "2026-12345", publication_date: "2026-05-20", title: "EPA industrial water rule", type: "RULE", html_url: "https://example.local/fr", agencies: [{ name: "EPA" }] }
  ]);
  const edinetSignals = parseEdinetDocuments([
    { docID: "S100FIX1", submitDateTime: "2026-05-20T02:10:00+09:00", filerName: "Toyota Motor Corporation", edinetCode: "E02144", docTypeCode: "120" }
  ]);
  const companiesHouseSignals = parseCompaniesHouseFilings("01234567", "ASML Holding UK Ltd", [
    { date: "2026-05-20", type: "tm01", description: "director resigned", links: { self: "https://example.local/ch" } }
  ]);
  const usaspendingSignals = parseUsaspendingAwards("Palantir Technologies", [
    { generated_internal_id: "USA-42", action_date: "2026-05-20", award_amount: 150000000, awarding_agency: "Department of Defense" }
  ]);
  const form4Signals = parseForm4Xml(
    "<ownershipDocument><rptOwnerName>Satya Nadella</rptOwnerName><transactionCode>P</transactionCode><transactionShares>12000</transactionShares><transactionPricePerShare>420.15</transactionPricePerShare><sharesOwnedFollowingTransaction>180000</sharesOwnedFollowingTransaction></ownershipDocument>",
    { cik: "0000789019", accessionNumber: "0000789019-26-000010", filingDate: "2026-05-20", companyName: "Microsoft Corporation" }
  );
  const sec8kSignals = parse8KSubmission({
    cik: "1326801",
    name: "Meta Platforms, Inc.",
    filings: { recent: { accessionNumber: ["0001326801-26-000050"], filingDate: ["2026-05-20"], form: ["8-K"], items: ["2.01"], primaryDocument: ["meta-8k.htm"] } }
  });
  const sec13dgSignals = parse13DGDocument({
    filerName: "ValueAct Capital",
    subjectCompany: "Meta Platforms, Inc.",
    ownershipPercent: 7.2,
    purpose: "Strategic review",
    observedAt: "2026-05-20T00:00:00.000Z",
    url: "https://www.sec.gov/example/13d"
  });
  const sec13fSignals = parse13FInformationTable({
    filerName: "Citadel Advisors LLC",
    issuerName: "NVIDIA Corporation",
    valueThousands: 250000,
    shares: 1250000,
    observedAt: "2026-05-15T00:00:00.000Z"
  });
  const openSanctionsSignals = parseOpenSanctionsMatches(
    [{ id: "os-fixture-1", caption: "Meta Platforms, Inc.", datasets: ["sanctions"] }],
    ["Meta Platforms, Inc.", "Palantir Technologies"]
  );
  const femaSignals = parseFemaDeclarations(
    [{ disasterNumber: "FEMA-1", declarationTitle: "Texas Severe Storms", incidentBeginDate: "2026-05-21", state: "TX" }],
    [{ name: "Vistra Corp", state: "TX" }]
  );
  const samSignals = parseSamOpportunities(
    [{ noticeId: "SAM-1", title: "Federal analytics support for Palantir Technologies", postedDate: "2026-05-21" }],
    ["Palantir Technologies", "Meta Platforms, Inc."]
  );
  const nrcSignals = parseNrcActions([
    { accessionNumber: "ML26140A001", docketNumber: "50-001", documentDate: "2026-05-21", title: "License amendment review" }
  ]);

  return [
    ...secSignals,
    ...fercSignals,
    ...permitSignals,
    ...cloudSignals,
    ...waterSignals,
    ...mineralSignals,
    ...portSignals,
    ...narrativeSignals,
    ...eiaSignals,
    ...statePucSignals,
    ...patentSignals,
    ...epaEchoSignals,
    ...faaSignals,
    ...fredSignals,
    ...federalRegisterSignals,
    ...edinetSignals,
    ...companiesHouseSignals,
    ...usaspendingSignals,
    ...form4Signals,
    ...sec8kSignals,
    ...sec13dgSignals,
    ...sec13fSignals,
    ...openSanctionsSignals,
    ...femaSignals,
    ...samSignals,
    ...nrcSignals
  ];
}

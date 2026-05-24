import type { RawSignal } from "./types.ts";
import { parseBuildingPermitRecords } from "../../scrapers/building-permits.ts";
import { parseCloudRegionRecords } from "../../scrapers/cloud-regions.ts";
import { parseFercRecords } from "../../scrapers/ferc.ts";
import { parseNarrativeRecords } from "../../scrapers/narrative.ts";
import { parsePortStatisticRecords } from "../../scrapers/port-statistics.ts";
import { parseSecSubmissions } from "../../scrapers/sec-edgar.ts";
import { parseUsgsMineralRecords } from "../../scrapers/usgs-minerals.ts";
import { parseWaterDistrictRecords } from "../../scrapers/water-districts.ts";

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

  return [
    ...secSignals,
    ...fercSignals,
    ...permitSignals,
    ...cloudSignals,
    ...waterSignals,
    ...mineralSignals,
    ...portSignals,
    ...narrativeSignals
  ];
}

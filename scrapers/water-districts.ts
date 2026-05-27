import type { RawSignal } from "../lib/pipeline/types.ts";
import { applyPagingToUrl, fetchJsonOrCsvRecords, getString, parseDate, type PublicRecord } from "./common.ts";

export type WaterDistrictOptions = {
  feedUrl: string;
  jurisdiction?: string;
  limit?: number;
  offset?: number;
  page?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  agency: ["agency", "district", "water_district"],
  applicant: ["applicant", "applicantRaw", "owner", "company"],
  filingDate: ["filingDate", "filing_date", "submitted_at", "date"],
  permitNumber: ["permitNumber", "permit_number", "application_id", "record_id"],
  requestedGpd: ["requestedGpd", "requested_gpd", "gallons_per_day", "water_gpd"],
  sourceUrl: ["sourceUrl", "source_url", "url"],
  status: ["status", "application_status"]
} as const;

export function parseWaterDistrictRecords(
  records: PublicRecord[],
  sourceUrl: string,
  jurisdiction = "US water district",
  limit = 50
): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const permitNumber = getString(record, fieldAliases.permitNumber);
    const observedAt = parseDate(getString(record, fieldAliases.filingDate));
    if (!permitNumber || !observedAt) return [];

    const applicant = getString(record, fieldAliases.applicant) ?? "Unknown water applicant";
    const url = getString(record, fieldAliases.sourceUrl) ?? sourceUrl;
    return [
      {
        layer: "water",
        source: "water-district-permits",
        externalId: permitNumber,
        observedAt,
        confidence: 0.66,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "water-district-permits",
            url,
            title: `${jurisdiction} water filing ${permitNumber}`,
            externalId: permitNumber,
            observedAt
          }
        ],
        payload: {
          agency: getString(record, fieldAliases.agency),
          applicantRaw: applicant,
          filingDate: observedAt.slice(0, 10),
          jurisdiction,
          permitNumber,
          requestedGpd: getString(record, fieldAliases.requestedGpd),
          status: getString(record, fieldAliases.status) ?? "submitted",
          raw: record
        }
      }
    ];
  });
}

export async function fetchWaterDistrictSignals(options: WaterDistrictOptions): Promise<RawSignal[]> {
  const pagedUrl = applyPagingToUrl(options.feedUrl, options);
  return parseWaterDistrictRecords(
    await fetchJsonOrCsvRecords(options.fetchImpl ?? fetch, pagedUrl),
    pagedUrl,
    options.jurisdiction,
    options.limit
  );
}

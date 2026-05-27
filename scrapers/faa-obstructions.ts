import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchJsonOrCsvRecords, getString, parseDate, type PublicRecord } from "./common.ts";

export type FaaObstructionOptions = {
  feedUrl: string;
  limit?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  applicant: ["applicant", "applicantRaw", "company", "sponsor"],
  caseNumber: ["caseNumber", "case_number", "oas_number", "aeronautical_study_number"],
  city: ["city", "nearest_city"],
  determinationDate: ["determinationDate", "determination_date", "decision_date", "date"],
  height: ["height", "structure_height", "height_agl", "agl"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "longitude"],
  state: ["state", "state_code"],
  status: ["status", "determination", "case_status"],
  structureType: ["structureType", "structure_type", "type", "marking_type"]
} as const;

export function parseFaaObstructionRecords(records: PublicRecord[], sourceUrl: string, limit = 50): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const caseNumber = getString(record, fieldAliases.caseNumber);
    const observedAt = parseDate(getString(record, fieldAliases.determinationDate));
    if (!caseNumber || !observedAt) return [];

    const structureType = getString(record, fieldAliases.structureType) ?? "Unknown structure";
    const externalId = `faa:${caseNumber}`;

    return [
      {
        layer: "land",
        source: "faa-oas",
        externalId,
        observedAt,
        confidence: 0.74,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "faa-oas",
            url: sourceUrl,
            title: `FAA OAS case ${caseNumber}: ${structureType}`,
            externalId,
            observedAt
          }
        ],
        payload: {
          applicant: getString(record, fieldAliases.applicant),
          caseNumber,
          city: getString(record, fieldAliases.city),
          determinationDate: observedAt.slice(0, 10),
          height: getString(record, fieldAliases.height),
          lat: getString(record, fieldAliases.lat),
          lng: getString(record, fieldAliases.lng),
          state: getString(record, fieldAliases.state),
          status: getString(record, fieldAliases.status) ?? "pending",
          structureType,
          raw: record
        }
      }
    ];
  });
}

export async function fetchFaaObstructionSignals(options: FaaObstructionOptions): Promise<RawSignal[]> {
  return parseFaaObstructionRecords(
    await fetchJsonOrCsvRecords(options.fetchImpl ?? fetch, options.feedUrl),
    options.feedUrl,
    options.limit
  );
}

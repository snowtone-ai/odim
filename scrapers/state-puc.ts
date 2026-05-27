import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchJsonOrCsvRecords, getString, parseDate, type PublicRecord } from "./common.ts";

export type StatePucOptions = {
  feedUrl: string;
  jurisdiction?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  applicant: ["applicant", "applicantRaw", "company", "utility", "petitioner"],
  capacityMw: ["capacityMw", "capacity_mw", "mw", "megawatts"],
  docketNumber: ["docketNumber", "docket_number", "docket", "case_number", "filing_id"],
  filingDate: ["filingDate", "filing_date", "date", "submitted_at", "filed_date"],
  jurisdiction: ["jurisdiction", "state", "commission"],
  projectName: ["projectName", "project_name", "title", "project", "facility"],
  status: ["status", "case_status", "disposition"]
} as const;

export function parsePucRecords(
  records: PublicRecord[],
  sourceUrl: string,
  jurisdiction = "US",
  limit = 50
): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const docketNumber = getString(record, fieldAliases.docketNumber);
    const observedAt = parseDate(getString(record, fieldAliases.filingDate));
    if (!docketNumber || !observedAt) return [];

    const recordJurisdiction = getString(record, fieldAliases.jurisdiction) ?? jurisdiction;
    const applicant = getString(record, fieldAliases.applicant) ?? "Unknown PUC applicant";
    const externalId = `puc:${recordJurisdiction}:${docketNumber}`;

    return [
      {
        layer: "energy",
        source: "state-puc-filings",
        externalId,
        observedAt,
        confidence: 0.78,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "state-puc-filings",
            url: sourceUrl,
            title: `PUC ${recordJurisdiction} docket ${docketNumber}`,
            externalId,
            observedAt
          }
        ],
        payload: {
          applicantRaw: applicant,
          capacityMw: getString(record, fieldAliases.capacityMw),
          docketNumber,
          filingDate: observedAt.slice(0, 10),
          jurisdiction: recordJurisdiction,
          projectName: getString(record, fieldAliases.projectName),
          status: getString(record, fieldAliases.status) ?? "pending",
          raw: record
        }
      }
    ];
  });
}

export async function fetchStatePucSignals(options: StatePucOptions): Promise<RawSignal[]> {
  return parsePucRecords(
    await fetchJsonOrCsvRecords(options.fetchImpl ?? fetch, options.feedUrl),
    options.feedUrl,
    options.jurisdiction,
    options.limit
  );
}

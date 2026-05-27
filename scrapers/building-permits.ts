import type { RawSignal } from "../lib/pipeline/types.ts";
import { applyPagingToUrl } from "./common.ts";

type PermitRecord = Record<string, unknown>;

export type BuildingPermitOptions = {
  feedUrl: string;
  jurisdiction?: string;
  limit?: number;
  offset?: number;
  page?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  address: ["address", "full_address", "site_address", "location"],
  applicant: ["applicant", "applicantRaw", "owner", "owner_name", "contractor_name"],
  description: ["description", "work_description", "permit_description", "work_class"],
  issuedAt: ["issuedAt", "issue_date", "issued_date", "filingDate", "applied_date"],
  lat: ["lat", "latitude", "y"],
  lng: ["lng", "lon", "longitude", "x"],
  permitNumber: ["permitNumber", "permit_number", "permit_id", "record_id"],
  status: ["status", "permit_status"]
} as const;

function getString(record: PermitRecord, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = record[alias];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  return parsed.toISOString();
}

export function parseBuildingPermitRecords(
  records: PermitRecord[],
  sourceUrl: string,
  jurisdiction = "US local",
  limit = 50
): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const permitNumber = getString(record, fieldAliases.permitNumber);
    const observedAt = parseDate(getString(record, fieldAliases.issuedAt));
    if (!permitNumber || !observedAt) return [];

    const applicant = getString(record, fieldAliases.applicant) ?? "Unknown permit applicant";
    const description = getString(record, fieldAliases.description);

    return [
      {
        layer: "land",
        source: "county-building-permits",
        externalId: permitNumber,
        observedAt,
        confidence: 0.68,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "county-building-permits",
            url: sourceUrl,
            title: `${jurisdiction} building permit ${permitNumber}`,
            externalId: permitNumber,
            observedAt
          }
        ],
        payload: {
          address: getString(record, fieldAliases.address),
          applicantRaw: applicant,
          description,
          issuedAt: observedAt.slice(0, 10),
          jurisdiction,
          lat: getString(record, fieldAliases.lat),
          lng: getString(record, fieldAliases.lng),
          permitNumber,
          status: getString(record, fieldAliases.status) ?? "submitted",
          raw: record
        }
      }
    ];
  });
}

export async function fetchBuildingPermitSignals(options: BuildingPermitOptions): Promise<RawSignal[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const pagedUrl = applyPagingToUrl(options.feedUrl, options);
  const response = await fetchImpl(pagedUrl, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Building permit feed request failed: ${response.status}`);
  const payload = (await response.json()) as PermitRecord[] | { results?: PermitRecord[]; data?: PermitRecord[] };
  const records = Array.isArray(payload) ? payload : (payload.results ?? payload.data ?? []);
  return parseBuildingPermitRecords(records, pagedUrl, options.jurisdiction, options.limit);
}

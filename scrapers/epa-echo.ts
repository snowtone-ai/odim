import type { RawSignal } from "../lib/pipeline/types.ts";
import { getString, parseDate, type PublicRecord } from "./common.ts";

export type EpaEchoOptions = {
  baseUrl?: string;
  state?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  expirationDate: ["CWPExpirationDate", "expirationDate", "expiration_date"],
  facilityName: ["CWPName", "facilityName", "facility_name", "name"],
  facilityType: ["CWPFacilityTypeIndicator", "facilityType", "facility_type"],
  issueDate: ["CWPIssueDate", "issueDate", "issue_date"],
  lat: ["FacLat", "lat", "latitude"],
  lng: ["FacLong", "lng", "lon", "longitude"],
  permitNumber: ["SourceID", "permitNumber", "permit_number", "npdes_id"],
  state: ["FacState", "state"]
} as const;

export function parseEpaEchoRecords(records: PublicRecord[], sourceUrl: string, limit = 50): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const permitNumber = getString(record, fieldAliases.permitNumber);
    const observedAt = parseDate(getString(record, fieldAliases.issueDate));
    if (!permitNumber || !observedAt) return [];

    const facilityName = getString(record, fieldAliases.facilityName) ?? "Unknown facility";
    const externalId = `npdes:${permitNumber}`;

    return [
      {
        layer: "water",
        source: "epa-echo-npdes",
        externalId,
        observedAt,
        confidence: 0.80,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "epa-echo-npdes",
            url: `https://echo.epa.gov/detailed-facility-report?fid=${permitNumber}`,
            title: `EPA ECHO NPDES ${permitNumber}: ${facilityName}`,
            externalId,
            observedAt
          }
        ],
        payload: {
          expirationDate: parseDate(getString(record, fieldAliases.expirationDate))?.slice(0, 10),
          facilityName,
          facilityType: getString(record, fieldAliases.facilityType),
          issueDate: observedAt.slice(0, 10),
          lat: getString(record, fieldAliases.lat),
          lng: getString(record, fieldAliases.lng),
          permitNumber,
          state: getString(record, fieldAliases.state),
          raw: record
        }
      }
    ];
  });
}

export async function fetchEpaEchoSignals(options: EpaEchoOptions): Promise<RawSignal[]> {
  const baseUrl = options.baseUrl ?? "https://echodata.epa.gov/echo";
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.limit ?? 50;

  const params = new URLSearchParams({ output: "JSON", p_ptype: "NPD", responseset: String(limit) });
  if (options.state) params.set("p_st", options.state);

  const url = `${baseUrl}/cwa_rest_services.get_facilities?${params.toString()}`;
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`EPA ECHO API request failed: ${response.status}`);

  const payload = (await response.json()) as { Results?: { Facilities?: PublicRecord[] } };
  const records = payload.Results?.Facilities ?? [];
  return parseEpaEchoRecords(records, `${baseUrl}/cwa_rest_services.get_facilities`, limit);
}

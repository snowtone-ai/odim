import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchJsonOrCsvRecords, getString, parseDate, type PublicRecord } from "./common.ts";

export type CloudRegionOptions = {
  feedUrl: string;
  limit?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  announcedAt: ["announcedAt", "announced_at", "published_at", "date"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "longitude"],
  location: ["location", "metro", "region", "state"],
  provider: ["provider", "company", "hyperscaler"],
  regionName: ["regionName", "region_name", "name", "title"],
  sourceUrl: ["sourceUrl", "source_url", "url"],
  status: ["status", "stage"]
} as const;

export function parseCloudRegionRecords(records: PublicRecord[], sourceUrl: string, limit = 50): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const provider = getString(record, fieldAliases.provider);
    const regionName = getString(record, fieldAliases.regionName);
    const observedAt = parseDate(getString(record, fieldAliases.announcedAt));
    if (!provider || !regionName || !observedAt) return [];

    const url = getString(record, fieldAliases.sourceUrl) ?? sourceUrl;
    const externalId = `${provider}:${regionName}:${observedAt.slice(0, 10)}`;
    return [
      {
        layer: "compute",
        source: "public-cloud-regions",
        externalId,
        observedAt,
        confidence: 0.64,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "public-cloud-regions",
            url,
            title: `${provider} compute region ${regionName}`,
            externalId,
            observedAt
          }
        ],
        payload: {
          lat: getString(record, fieldAliases.lat),
          lng: getString(record, fieldAliases.lng),
          location: getString(record, fieldAliases.location),
          provider,
          regionName,
          status: getString(record, fieldAliases.status) ?? "announced",
          raw: record
        }
      }
    ];
  });
}

export async function fetchCloudRegionSignals(options: CloudRegionOptions): Promise<RawSignal[]> {
  return parseCloudRegionRecords(
    await fetchJsonOrCsvRecords(options.fetchImpl ?? fetch, options.feedUrl),
    options.feedUrl,
    options.limit
  );
}

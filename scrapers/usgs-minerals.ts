import type { RawSignal } from "../lib/pipeline/types.ts";
import { applyPagingToUrl, fetchJsonOrCsvRecords, getString, parseDate, type PublicRecord } from "./common.ts";

export type UsgsMineralsOptions = {
  feedUrl: string;
  limit?: number;
  offset?: number;
  page?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  commodity: ["commodity", "material", "mineral"],
  country: ["country", "jurisdiction"],
  mineName: ["mineName", "mine_name", "site", "facility"],
  observedAt: ["observedAt", "period_end", "date", "year"],
  operator: ["operator", "company", "owner"],
  productionTonnes: ["productionTonnes", "production_tonnes", "tonnes", "metric_tons"],
  sourceUrl: ["sourceUrl", "source_url", "url"]
} as const;

function observedDate(record: PublicRecord) {
  const raw = getString(record, fieldAliases.observedAt);
  if (/^\d{4}$/.test(raw ?? "")) return `${raw}-12-31T00:00:00.000Z`;
  return parseDate(raw);
}

export function parseUsgsMineralRecords(records: PublicRecord[], sourceUrl: string, limit = 50): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const commodity = getString(record, fieldAliases.commodity);
    const observedAt = observedDate(record);
    if (!commodity || !observedAt) return [];

    const mineName = getString(record, fieldAliases.mineName) ?? `${commodity} production`;
    const operator = getString(record, fieldAliases.operator) ?? "Unknown operator";
    const externalId = `${commodity}:${mineName}:${observedAt.slice(0, 10)}`;
    const url = getString(record, fieldAliases.sourceUrl) ?? sourceUrl;

    return [
      {
        layer: "raw_materials",
        source: "usgs-minerals",
        externalId,
        observedAt,
        confidence: 0.62,
        freshness: 0.8,
        sourceRefs: [
          {
            sourceId: "usgs-minerals",
            url,
            title: `${commodity} production signal for ${mineName}`,
            externalId,
            observedAt
          }
        ],
        payload: {
          commodity,
          country: getString(record, fieldAliases.country),
          mineName,
          operator,
          productionTonnes: getString(record, fieldAliases.productionTonnes),
          raw: record
        }
      }
    ];
  });
}

export async function fetchUsgsMineralSignals(options: UsgsMineralsOptions): Promise<RawSignal[]> {
  const pagedUrl = applyPagingToUrl(options.feedUrl, options);
  return parseUsgsMineralRecords(
    await fetchJsonOrCsvRecords(options.fetchImpl ?? fetch, pagedUrl),
    pagedUrl,
    options.limit
  );
}

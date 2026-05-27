import type { RawSignal } from "../lib/pipeline/types.ts";
import { applyPagingToUrl, fetchJsonOrCsvRecords, getString, parseDate, type PublicRecord } from "./common.ts";

export type NarrativeOptions = {
  feedUrl: string;
  limit?: number;
  offset?: number;
  page?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  entityName: ["entityName", "entity", "company", "ticker"],
  publishedAt: ["publishedAt", "published_at", "date"],
  publisher: ["publisher", "source", "outlet"],
  title: ["title", "headline"],
  topic: ["topic", "category"],
  url: ["url", "link"]
} as const;

export function parseNarrativeRecords(records: PublicRecord[], sourceUrl: string, limit = 50): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const title = getString(record, fieldAliases.title);
    const observedAt = parseDate(getString(record, fieldAliases.publishedAt));
    if (!title || !observedAt) return [];

    const url = getString(record, fieldAliases.url) ?? sourceUrl;
    const publisher = getString(record, fieldAliases.publisher) ?? "public narrative source";
    const externalId = `${publisher}:${title}:${observedAt.slice(0, 10)}`;
    return [
      {
        layer: "narrative",
        source: "narrative-rss",
        externalId,
        observedAt,
        confidence: 0.45,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "narrative-rss",
            url,
            title,
            externalId,
            observedAt
          }
        ],
        payload: {
          entityName: getString(record, fieldAliases.entityName),
          publisher,
          title,
          topic: getString(record, fieldAliases.topic),
          url,
          raw: record
        }
      }
    ];
  });
}

export async function fetchNarrativeSignals(options: NarrativeOptions): Promise<RawSignal[]> {
  const pagedUrl = applyPagingToUrl(options.feedUrl, options);
  return parseNarrativeRecords(
    await fetchJsonOrCsvRecords(options.fetchImpl ?? fetch, pagedUrl),
    pagedUrl,
    options.limit
  );
}

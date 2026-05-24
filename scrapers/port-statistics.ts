import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchJsonOrCsvRecords, getString, parseDate, type PublicRecord } from "./common.ts";

export type PortStatisticsOptions = {
  feedUrl: string;
  limit?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "longitude"],
  metric: ["metric", "measure", "cargo_type"],
  observedAt: ["observedAt", "period_end", "date"],
  portName: ["portName", "port_name", "port", "facility"],
  sourceUrl: ["sourceUrl", "source_url", "url"],
  volume: ["volume", "teu", "tonnes", "short_tons"],
  volumeUnit: ["volumeUnit", "volume_unit", "unit"]
} as const;

export function parsePortStatisticRecords(records: PublicRecord[], sourceUrl: string, limit = 50): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const portName = getString(record, fieldAliases.portName);
    const observedAt = parseDate(getString(record, fieldAliases.observedAt));
    if (!portName || !observedAt) return [];

    const metric = getString(record, fieldAliases.metric) ?? "throughput";
    const externalId = `${portName}:${metric}:${observedAt.slice(0, 10)}`;
    const url = getString(record, fieldAliases.sourceUrl) ?? sourceUrl;
    return [
      {
        layer: "logistics",
        source: "port-statistics",
        externalId,
        observedAt,
        confidence: 0.63,
        freshness: 0.85,
        sourceRefs: [
          {
            sourceId: "port-statistics",
            url,
            title: `${portName} ${metric} logistics signal`,
            externalId,
            observedAt
          }
        ],
        payload: {
          lat: getString(record, fieldAliases.lat),
          lng: getString(record, fieldAliases.lng),
          metric,
          portName,
          volume: getString(record, fieldAliases.volume),
          volumeUnit: getString(record, fieldAliases.volumeUnit),
          raw: record
        }
      }
    ];
  });
}

export async function fetchPortStatisticSignals(options: PortStatisticsOptions): Promise<RawSignal[]> {
  return parsePortStatisticRecords(
    await fetchJsonOrCsvRecords(options.fetchImpl ?? fetch, options.feedUrl),
    options.feedUrl,
    options.limit
  );
}

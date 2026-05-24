import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchJsonOrCsvRecords, getString, parseDate, type PublicRecord } from "./common.ts";

type AliasList = string | string[];

export type ConfiguredSourceDefinition = {
  id: string;
  layer: string;
  region?: string;
  type?: string;
  enabled?: boolean;
  urlEnv?: string;
  adapter: string;
  sourceTier?: "free" | "paid";
  orgIdEnv?: string;
  confidence?: number;
  authHeaderEnv?: string;
  authHeaderName?: string;
  authHeaderPrefix?: string;
  fieldMap?: {
    externalId?: AliasList;
    observedAt?: AliasList;
    title?: AliasList;
    url?: AliasList;
    confidence?: AliasList;
  };
  payloadMap?: Record<string, AliasList>;
};

export type ConfiguredSourceOptions = {
  source: ConfiguredSourceDefinition;
  feedUrl: string;
  limit?: number;
  fetchImpl?: typeof fetch;
};

function aliases(value: AliasList | undefined, fallback: string[]) {
  if (!value) return fallback;
  return Array.isArray(value) ? value : [value];
}

function numberValue(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function authHeaders(source: ConfiguredSourceDefinition) {
  if (!source.authHeaderEnv) return {};
  const value = process.env[source.authHeaderEnv];
  if (!value) return {};
  const headerName = source.authHeaderName ?? "authorization";
  const prefix = source.authHeaderPrefix ?? "Bearer ";
  return { [headerName]: `${prefix}${value}` };
}

export function parseConfiguredSourceRecords(
  source: ConfiguredSourceDefinition,
  records: PublicRecord[],
  sourceUrl: string,
  limit = 50
): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const externalId = getString(record, aliases(source.fieldMap?.externalId, ["id", "external_id", "externalId", "record_id"]));
    const observedAt = parseDate(getString(record, aliases(source.fieldMap?.observedAt, ["observed_at", "observedAt", "date", "updated_at"])));
    if (!externalId || !observedAt) return [];

    const orgId = source.orgIdEnv ? process.env[source.orgIdEnv] ?? null : null;
    const payload: Record<string, unknown> = {
      raw: record,
      region: source.region,
      sourceTier: source.sourceTier ?? "free"
    };
    for (const [key, value] of Object.entries(source.payloadMap ?? {})) {
      payload[key] = getString(record, aliases(value, []));
    }

    const url = getString(record, aliases(source.fieldMap?.url, ["url", "source_url", "document_url"])) ?? sourceUrl;
    const title =
      getString(record, aliases(source.fieldMap?.title, ["title", "name", "headline", "description"])) ?? `${source.id} ${externalId}`;
    const confidence = numberValue(getString(record, aliases(source.fieldMap?.confidence, ["confidence"])), source.confidence ?? 0.65);

    return [
      {
        layer: source.layer,
        source: source.id,
        externalId,
        orgId,
        observedAt,
        confidence,
        freshness: 1,
        isProprietary: source.sourceTier === "paid",
        sourceRefs: [
          {
            sourceId: source.id,
            url,
            title,
            externalId,
            observedAt
          }
        ],
        payload
      }
    ];
  });
}

export async function fetchConfiguredSourceSignals(options: ConfiguredSourceOptions) {
  if (options.source.sourceTier === "paid" && !options.source.orgIdEnv) {
    throw new Error(`Paid configured source ${options.source.id} requires orgIdEnv for proprietary RLS visibility`);
  }
  if (options.source.sourceTier === "paid" && options.source.orgIdEnv && !process.env[options.source.orgIdEnv]) {
    throw new Error(`Paid configured source ${options.source.id} requires ${options.source.orgIdEnv}`);
  }
  const records = await fetchJsonOrCsvRecords(options.fetchImpl ?? fetch, options.feedUrl, authHeaders(options.source));
  return parseConfiguredSourceRecords(options.source, records, options.feedUrl, options.limit);
}

import type { RawSignal } from "../lib/pipeline/types.ts";

type NrcRecord = {
  accessionNumber?: string;
  docketNumber?: string;
  documentDate?: string;
  title?: string;
};

export function parseNrcActions(records: NrcRecord[]): RawSignal[] {
  const observedAt = new Date().toISOString();
  return records.map((record) => ({
    layer: "energy",
    source: "nrc",
    externalId: record.accessionNumber ?? record.docketNumber ?? "nrc-record",
    observedAt: new Date(record.documentDate ?? observedAt).toISOString(),
    confidence: 0.92,
    freshness: 1,
    isProprietary: false,
    payload: {
      docketNumber: record.docketNumber ?? "",
      title: record.title ?? ""
    },
    sourceRefs: [
      {
        sourceId: "nrc",
        title: record.title ?? "NRC action",
        url: "https://adams.nrc.gov/wba/services/search/advanced/nrc",
        observedAt
      }
    ]
  })) satisfies RawSignal[];
}

export async function fetchNrcSignals(options: { dryRun?: boolean }) {
  if (options.dryRun) {
    return parseNrcActions([{ accessionNumber: "ML26140A001", docketNumber: "50-001", documentDate: "2026-05-20", title: "License amendment review" }]);
  }
  const response = await fetch("https://adams.nrc.gov/wba/services/search/advanced/nrc?q=license%20amendment");
  if (!response.ok) throw new Error(`NRC request failed: ${response.status}`);
  const payload = (await response.json()) as { results?: NrcRecord[] };
  return parseNrcActions(payload.results ?? []);
}

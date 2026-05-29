import type { RawSignal } from "../lib/pipeline/types.ts";

type SamOpportunity = {
  noticeId?: string;
  title?: string;
  postedDate?: string;
  organizationName?: string;
};

export function parseSamOpportunities(records: SamOpportunity[], seedNames: string[]): RawSignal[] {
  const observedAt = new Date().toISOString();
  return records.flatMap((record) => {
    const matched = seedNames.find((name) => `${record.title ?? ""} ${record.organizationName ?? ""}`.toLowerCase().includes(name.toLowerCase()));
    if (!matched) return [];
    return [{
      layer: "cash",
      source: "sam-gov",
      externalId: record.noticeId ?? matched,
      observedAt: new Date(record.postedDate ?? observedAt).toISOString(),
      confidence: 0.9,
      freshness: 1,
      isProprietary: false,
      payload: { entityName: matched, organizationName: record.organizationName ?? "", title: record.title ?? "" },
      sourceRefs: [{ sourceId: "sam-gov", title: record.title ?? matched, url: "https://api.sam.gov/opportunities/v2/search", observedAt }]
    }] satisfies RawSignal[];
  });
}

export async function fetchSamGovSignals(options: { seedNames: string[]; apiKey?: string; dryRun?: boolean }) {
  if (options.dryRun) {
    return parseSamOpportunities([{ noticeId: "sam-1", title: "Cloud modernization contract for Palantir Technologies", postedDate: "2026-05-20" }], options.seedNames);
  }
  if (!options.apiKey) throw new Error("SAM.gov API key is required");
  const postedFrom = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const response = await fetch(`https://api.sam.gov/opportunities/v2/search?api_key=${encodeURIComponent(options.apiKey)}&postedFrom=${postedFrom}&limit=100`);
  if (!response.ok) throw new Error(`SAM.gov request failed: ${response.status}`);
  const payload = (await response.json()) as { opportunitiesData?: SamOpportunity[] };
  return parseSamOpportunities(payload.opportunitiesData ?? [], options.seedNames);
}

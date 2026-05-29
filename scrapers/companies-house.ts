import type { RawSignal } from "../lib/pipeline/types.ts";

export function parseCompaniesHouseFilings(companyNumber: string, companyName: string, records: Array<Record<string, unknown>>) {
  return records.flatMap((record) => {
    const date = String(record.date ?? "");
    const type = String(record.type ?? "");
    if (!date || !type) return [];
    return [
      {
        layer: "cash",
        source: "companies-house",
        externalId: `${companyNumber}:${type}:${date}`,
        observedAt: `${date}T00:00:00.000Z`,
        confidence: 0.88,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "companies-house",
            url: String((record.links as { self?: string } | undefined)?.self ?? "https://find-and-update.company-information.service.gov.uk/"),
            title: `${companyName} ${type}`,
            externalId: companyNumber,
            observedAt: `${date}T00:00:00.000Z`
          }
        ],
        payload: {
          companyName,
          companyNumber,
          filingType: type,
          description: String(record.description ?? ""),
          directorChange: type.includes("appoint") || type.includes("terminate")
        }
      } satisfies RawSignal
    ];
  });
}

export async function fetchCompaniesHouseSignals(options: { dryRun?: boolean }) {
  if (options.dryRun) {
    return parseCompaniesHouseFilings("01234567", "ASML Holding UK Ltd", [
      { date: "2026-05-20", type: "tm01", description: "director resigned", links: { self: "https://example.local/ch" } }
    ]);
  }
  return [];
}

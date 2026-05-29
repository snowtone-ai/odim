import type { RawSignal } from "../lib/pipeline/types.ts";

function parseOwnershipPercent(document: string) {
  const xmlMatch = document.match(/(?:PERCENTOFCLASSREPRESENTEDBYAMOUNT|percentOfClassRepresentedByAmount)[^>]*>\s*([\d.]+)/i);
  if (xmlMatch) return Number(xmlMatch[1]);
  const textMatch = document.match(/(\d+(?:\.\d+)?)\s*%/);
  return Number(textMatch?.[1] ?? 0);
}

export function parse13DGDocument(
  payload:
    | { filerName: string; subjectCompany: string; ownershipPercent: number; purpose?: string; passive?: boolean; observedAt: string; url: string }
    | { filerName: string; subjectCompany: string; document: string; observedAt: string; url: string }
) {
  const document = "document" in payload ? payload.document : "";
  const ownershipPercent =
    "ownershipPercent" in payload ? payload.ownershipPercent : parseOwnershipPercent(document);
  const passive =
    "passive" in payload
      ? (payload.passive ?? false)
      : /schedule\s+13g|passive/i.test(document);
  const purpose =
    "purpose" in payload
      ? (payload.purpose ?? "")
      : document.match(/Item\s+4[\s\S]{0,400}/i)?.[0] ?? "";
  return [
    {
      layer: "cash",
      source: "sec-edgar-13dg",
      externalId: `${payload.filerName}:${payload.subjectCompany}:${payload.observedAt}`,
      observedAt: payload.observedAt,
      confidence: passive ? 0.85 : 0.95,
      freshness: 1,
      sourceRefs: [
        {
          sourceId: "sec-edgar-13dg",
          url: payload.url,
          title: `${payload.filerName} ${passive ? "13G" : "13D"} ${payload.subjectCompany}`,
          observedAt: payload.observedAt
        }
      ],
      payload: {
        filerName: payload.filerName,
        subjectCompany: payload.subjectCompany,
        ownershipPercent,
        purpose,
        passive,
        amountUsd: ownershipPercent * 10_000_000
      }
    } satisfies RawSignal
  ];
}

export async function fetch13DGSignals(options: { dryRun?: boolean }) {
  if (options.dryRun) {
    return parse13DGDocument({
      filerName: "ValueAct Capital",
      subjectCompany: "Fixture Industries",
      ownershipPercent: 7.2,
      purpose: "Strategic review",
      observedAt: "2026-05-20T00:00:00.000Z",
      url: "https://www.sec.gov/example/13d"
    });
  }
  return [];
}

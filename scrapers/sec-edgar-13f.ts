import type { RawSignal } from "../lib/pipeline/types.ts";

export const MAJOR_13F_FILERS = [
  { cik: "0001423053", name: "Citadel Advisors LLC" },
  { cik: "0001350694", name: "Bridgewater Associates, LP" },
  { cik: "0001037389", name: "Renaissance Technologies LLC" },
  { cik: "0001179392", name: "Point72 Asset Management, L.P." }
];

function parseInformationRows(document: string) {
  const rows = Array.from(document.matchAll(/<infoTable>([\s\S]*?)<\/infoTable>/gi)).map((match) => match[1]);
  return rows.map((row) => ({
    issuerName: row.match(/<(?:nameOfIssuer|nameofissuer)>([\s\S]*?)</i)?.[1]?.trim() ?? "",
    valueThousands: Number(row.match(/<(?:value)>([\d.]+)</i)?.[1] ?? 0),
    shares: Number(row.match(/<(?:sshPrnamt)>([\d.]+)</i)?.[1] ?? 0),
    putCall: row.match(/<(?:putCall)>([\s\S]*?)</i)?.[1]?.trim() ?? ""
  }));
}

export function parse13FInformationTable(
  payload:
    | { filerName: string; issuerName: string; valueThousands: number; shares: number; putCall?: string; observedAt: string; quarterLabel?: string }
    | { filerName: string; document: string; observedAt: string; quarterLabel?: string }
) {
  const rows =
    "document" in payload
      ? parseInformationRows(payload.document).map((row) => ({ ...row, filerName: payload.filerName, observedAt: payload.observedAt, quarterLabel: payload.quarterLabel }))
      : [payload];
  return rows.map((row) => {
    const amountUsd = row.valueThousands * 1000;
    return {
      layer: "cash",
      source: "sec-edgar-13f",
      externalId: `${row.filerName}:${row.issuerName}:${row.observedAt}`,
      observedAt: row.observedAt,
      confidence: 0.95,
      freshness: 1,
      sourceRefs: [
        {
          sourceId: "sec-edgar-13f",
          url: "https://www.sec.gov/edgar/search/",
          title: `${row.filerName} 13F ${row.issuerName}`,
          observedAt: row.observedAt
        }
      ],
      payload: {
        filerName: row.filerName,
        issuerName: row.issuerName,
        valueThousands: row.valueThousands,
        shares: row.shares,
        amountUsd,
        putCall: row.putCall ?? "",
        positionDeltaRatio: amountUsd >= 100_000_000 ? 0.6 : 0.1,
        quarterLabel: row.quarterLabel ?? "Q1"
      }
    } satisfies RawSignal;
  });
}

export async function fetch13FHoldings(options: { dryRun?: boolean }) {
  if (options.dryRun) {
    return {
      signals: parse13FInformationTable({
        filerName: "Citadel Advisors LLC",
        issuerName: "Fixture Semiconductor",
        valueThousands: 250000,
        shares: 1250000,
        observedAt: "2026-05-15T00:00:00.000Z"
      }),
      links: []
    };
  }
  return { signals: [], links: [] };
}

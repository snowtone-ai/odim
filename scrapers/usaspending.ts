import type { RawSignal } from "../lib/pipeline/types.ts";

export function parseUsaspendingAwards(recipient: string, records: Array<Record<string, unknown>>) {
  return records.flatMap((record) => {
    const amount = Number(record.generated_internal_id ? record.award_amount : record.Amount ?? record.amount ?? 0);
    const date = String(record.action_date ?? record.date_signed ?? "");
    if (!date) return [];
    return [
      {
        layer: "cash",
        source: "usaspending",
        externalId: String(record.generated_internal_id ?? record.award_id ?? `${recipient}:${date}`),
        observedAt: `${date}T00:00:00.000Z`,
        confidence: 0.95,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "usaspending",
            url: "https://www.usaspending.gov/",
            title: `${recipient} federal award`,
            observedAt: `${date}T00:00:00.000Z`
          }
        ],
        payload: {
          companyName: recipient,
          awardingAgency: String(record.awarding_agency ?? record.awarding_sub_agency ?? ""),
          amountUsd: Number.isFinite(amount) ? amount : 0,
          critical: Number.isFinite(amount) && amount >= 100_000_000
        }
      } satisfies RawSignal
    ];
  });
}

export async function fetchUsaspendingSignals(options: { dryRun?: boolean }) {
  if (options.dryRun) {
    return parseUsaspendingAwards("Palantir Technologies", [
      { generated_internal_id: "USA-42", action_date: "2026-05-20", award_amount: 150000000, awarding_agency: "Department of Defense" }
    ]);
  }
  return [];
}

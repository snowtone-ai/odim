import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchWithTimeout } from "./common.ts";

export function parseEdinetDocuments(records: Array<Record<string, unknown>>) {
  return records.flatMap((record) => {
    const docId = String(record.docID ?? record.docId ?? "");
    const submitDateTime = String(record.submitDateTime ?? record.submitDate ?? "");
    if (!docId || !submitDateTime) return [];
    return [
      {
        layer: "cash",
        source: "edinet",
        externalId: docId,
        observedAt: new Date(submitDateTime).toISOString(),
        confidence: 0.9,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "edinet",
            url: `https://disclosure.edinet-fsa.go.jp/E01EW/BLMainController.jsp?uji.verb=W1E63010EDINET&lgKbn=2&dflg=0&iflg=0&dispKbn=0&pid=${docId}`,
            title: String(record.docDescription ?? record.filerName ?? docId),
            externalId: docId,
            observedAt: new Date(submitDateTime).toISOString()
          }
        ],
        payload: {
          companyName: String(record.filerName ?? ""),
          edinetCode: String(record.edinetCode ?? ""),
          documentType: String(record.docTypeCode ?? "")
        }
      } satisfies RawSignal
    ];
  });
}

export async function fetchEdinetSignals(options: { apiKey?: string; fetchImpl?: typeof fetch; dryRun?: boolean }) {
  if (options.dryRun) {
    return parseEdinetDocuments([
      { docID: "S100FIX1", submitDateTime: "2026-05-20T02:10:00+09:00", filerName: "Toyota Motor Corporation", edinetCode: "E02144", docTypeCode: "120" }
    ]);
  }
  if (!options.apiKey) return [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const date = new Date().toISOString().slice(0, 10);
  const response = await fetchWithTimeout(fetchImpl, `https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=${date}&type=2&Subscription-Key=${options.apiKey}`);
  if (!response.ok) throw new Error(`EDINET request failed: ${response.status}`);
  const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
  return parseEdinetDocuments(payload.results ?? []);
}

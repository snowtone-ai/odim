import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchWithTimeout } from "./common.ts";

const ITEM_CONFIDENCE: Record<string, number> = {
  "1.01": 0.9,
  "1.02": 0.88,
  "2.01": 0.95,
  "2.05": 0.95,
  "2.06": 0.95,
  "4.01": 0.8,
  "5.02": 0.85,
  "7.01": 0.7
};

const SEC_BATCH_SIZE = 8;
const SEC_BATCH_DELAY_MS = 1200;

type Submission = {
  cik: string | number;
  name: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      form?: string[];
      items?: string[];
      primaryDocument?: string[];
    };
  };
};

function extractItemsFromText(text: string) {
  return Array.from(text.matchAll(/Item\s+(\d+\.\d+)/gi)).map((match) => match[1]);
}

function normalizeCik(cik: string | number) {
  return String(cik).replace(/^0+/, "").padStart(10, "0");
}

function archiveUrl(cik: string, accession: string, doc?: string) {
  return `https://www.sec.gov/Archives/edgar/data/${String(cik).replace(/^0+/, "")}/${accession.replaceAll("-", "")}/${doc ?? `${accession}.txt`}`;
}

export function parse8KSubmission(payload: Submission) {
  const cik = normalizeCik(payload.cik);
  const recent = payload.filings?.recent;
  if (!recent?.accessionNumber?.length) return [];
  const signals: RawSignal[] = [];
  for (let index = 0; index < recent.accessionNumber.length; index += 1) {
    if (recent.form?.[index] !== "8-K" || !recent.filingDate?.[index]) continue;
    const items = (recent.items?.[index] ?? "")
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const parsedItems = items.length ? items : extractItemsFromText(recent.primaryDocument?.[index] ?? "");
    for (const item of parsedItems.length ? parsedItems : ["7.01"]) {
      signals.push({
        layer: "cash",
        source: "sec-edgar-8k",
        externalId: `${recent.accessionNumber[index]}:${item}`,
        observedAt: `${recent.filingDate[index]}T00:00:00.000Z`,
        confidence: ITEM_CONFIDENCE[item] ?? 0.72,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "sec-edgar-8k",
            url: archiveUrl(cik, recent.accessionNumber[index], recent.primaryDocument?.[index]),
            title: `${payload.name} 8-K ${item}`,
            externalId: recent.accessionNumber[index],
            observedAt: `${recent.filingDate[index]}T00:00:00.000Z`
          }
        ],
        payload: {
          companyName: payload.name,
          cik,
          accessionNumber: recent.accessionNumber[index],
          item,
          eventType: item
        }
      });
    }
  }
  return signals;
}

export async function fetch8KSignals(
  cik: string,
  options: { userAgent?: string; baseUrl?: string; dryRun?: boolean; fetchImpl?: typeof fetch }
) {
  if (options.dryRun) {
    return parse8KSubmission({
      cik,
      name: "Fixture Corp",
      filings: {
        recent: {
          accessionNumber: ["0000000000-26-000002"],
          filingDate: ["2026-05-20"],
          form: ["8-K"],
          items: ["2.01 5.02"],
          primaryDocument: ["fixture-8k.htm"]
        }
      }
    });
  }
  if (!options.userAgent) throw new Error("SEC_EDGAR_USER_AGENT is required for 8-K requests");
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchWithTimeout(fetchImpl, `${options.baseUrl ?? "https://data.sec.gov/submissions"}/CIK${normalizeCik(cik)}.json`, {
    headers: { accept: "application/json", "user-agent": options.userAgent }
  });
  if (!response.ok) throw new Error(`8-K SEC request failed: ${response.status}`);
  return parse8KSubmission((await response.json()) as Submission);
}

export async function fetch8KSignalsBatch(
  ciks: string[],
  options: { userAgent?: string; baseUrl?: string; dryRun?: boolean; fetchImpl?: typeof fetch }
) {
  const allSignals: RawSignal[] = [];
  for (let index = 0; index < ciks.length; index += SEC_BATCH_SIZE) {
    const batch = ciks.slice(index, index + SEC_BATCH_SIZE);
    const result = await Promise.all(batch.map((cik) => fetch8KSignals(cik, options)));
    allSignals.push(...result.flat());
    if (index + SEC_BATCH_SIZE < ciks.length) {
      await new Promise((resolve) => setTimeout(resolve, SEC_BATCH_DELAY_MS));
    }
  }
  return allSignals;
}

import type { RawSignal } from "../lib/pipeline/types.ts";

type SecRecentFilings = {
  accessionNumber?: string[];
  filingDate?: string[];
  reportDate?: string[];
  form?: string[];
  primaryDocument?: string[];
  items?: string[];
};

type SecSubmissionsResponse = {
  cik: string | number;
  name: string;
  tickers?: string[];
  filings?: {
    recent?: SecRecentFilings;
  };
};

export type SecEdgarOptions = {
  ciks: string[];
  baseUrl?: string;
  userAgent?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
};

const trackedForms = new Set(["8-K", "S-1"]);

function normalizeCik(cik: string | number) {
  return String(cik).replace(/^0+/, "").padStart(10, "0");
}

function secArchiveUrl(cik: string | number, accessionNumber: string, primaryDocument?: string) {
  const bareCik = String(cik).replace(/^0+/, "");
  const accessionPath = accessionNumber.replaceAll("-", "");
  const doc = primaryDocument?.trim() || `${accessionNumber}.txt`;
  return `https://www.sec.gov/Archives/edgar/data/${bareCik}/${accessionPath}/${doc}`;
}

function recentAt(recent: SecRecentFilings, index: number) {
  return {
    accessionNumber: recent.accessionNumber?.[index],
    filingDate: recent.filingDate?.[index],
    form: recent.form?.[index],
    items: recent.items?.[index],
    primaryDocument: recent.primaryDocument?.[index],
    reportDate: recent.reportDate?.[index]
  };
}

export function parseSecSubmissions(payload: SecSubmissionsResponse, limit = 50): RawSignal[] {
  const recent = payload.filings?.recent;
  if (!recent?.accessionNumber?.length) return [];

  const cik = normalizeCik(payload.cik);
  const companyName = payload.name;
  const ticker = payload.tickers?.[0];
  const signals: RawSignal[] = [];

  for (let index = 0; index < recent.accessionNumber.length && signals.length < limit; index += 1) {
    const filing = recentAt(recent, index);
    if (!filing.accessionNumber || !filing.form || !trackedForms.has(filing.form)) continue;
    const filingDate = filing.filingDate ?? filing.reportDate;
    if (!filingDate) continue;

    const documentUrl = secArchiveUrl(cik, filing.accessionNumber, filing.primaryDocument);
    signals.push({
      layer: "cash",
      source: "sec-edgar",
      externalId: filing.accessionNumber,
      observedAt: `${filingDate}T00:00:00.000Z`,
      confidence: filing.form === "8-K" ? 0.72 : 0.66,
      freshness: 1,
      sourceRefs: [
        {
          sourceId: "sec-edgar",
          url: documentUrl,
          title: `${companyName} ${filing.form} ${filing.accessionNumber}`,
          externalId: filing.accessionNumber,
          observedAt: `${filingDate}T00:00:00.000Z`
        }
      ],
      payload: {
        accessionNumber: filing.accessionNumber,
        cik,
        companyName,
        filingDate,
        form: filing.form,
        items: filing.items,
        primaryDocument: filing.primaryDocument,
        reportDate: filing.reportDate,
        ticker
      }
    });
  }

  return signals;
}

export async function fetchSecEdgarSignals(options: SecEdgarOptions): Promise<RawSignal[]> {
  const baseUrl = options.baseUrl ?? "https://data.sec.gov/submissions";
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.limit ?? 50;
  if (!options.userAgent) throw new Error("SEC_EDGAR_USER_AGENT is required for SEC EDGAR requests");
  const userAgent = options.userAgent;

  const batches = await Promise.all(
    options.ciks.map(async (cik) => {
      const normalizedCik = normalizeCik(cik);
      const response = await fetchImpl(`${baseUrl}/CIK${normalizedCik}.json`, {
        headers: {
          "user-agent": userAgent,
          accept: "application/json"
        }
      });
      if (!response.ok) throw new Error(`SEC EDGAR ${normalizedCik} request failed: ${response.status}`);
      return parseSecSubmissions((await response.json()) as SecSubmissionsResponse, limit);
    })
  );

  return batches.flat();
}

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
    files?: Array<{
      filingCount?: number;
      filingFrom?: string;
      filingTo?: string;
      name?: string;
    }>;
    recent?: SecRecentFilings;
  };
};

type SecFilingMetadata = {
  cik: string | number;
  companyName: string;
  ticker?: string;
};

export type SecEdgarOptions = {
  ciks: string[];
  baseUrl?: string;
  historicalFileLimit?: number;
  includeHistorical?: boolean;
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

function parseSecFilingTable(table: SecRecentFilings | undefined, metadata: SecFilingMetadata, limit = 50): RawSignal[] {
  if (!table?.accessionNumber?.length) return [];
  const cik = normalizeCik(metadata.cik);
  const signals: RawSignal[] = [];

  for (let index = 0; index < table.accessionNumber.length && signals.length < limit; index += 1) {
    const filing = recentAt(table, index);
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
          title: `${metadata.companyName} ${filing.form} ${filing.accessionNumber}`,
          externalId: filing.accessionNumber,
          observedAt: `${filingDate}T00:00:00.000Z`
        }
      ],
      payload: {
        accessionNumber: filing.accessionNumber,
        cik,
        companyName: metadata.companyName,
        filingDate,
        form: filing.form,
        items: filing.items,
        primaryDocument: filing.primaryDocument,
        reportDate: filing.reportDate,
        ticker: metadata.ticker
      }
    });
  }

  return signals;
}

export function parseSecSubmissions(payload: SecSubmissionsResponse, limit = 50): RawSignal[] {
  return parseSecFilingTable(
    payload.filings?.recent,
    { cik: payload.cik, companyName: payload.name, ticker: payload.tickers?.[0] },
    limit
  );
}

function historicalSubmissionUrl(baseUrl: string, fileName: string) {
  return new URL(fileName, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

export async function fetchSecEdgarSignals(options: SecEdgarOptions): Promise<RawSignal[]> {
  const baseUrl = options.baseUrl ?? "https://data.sec.gov/submissions";
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.limit ?? 50;
  const historicalFileLimit = options.historicalFileLimit ?? 5;
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
      const payload = (await response.json()) as SecSubmissionsResponse;
      const signals = parseSecSubmissions(payload, limit);
      if (!options.includeHistorical || signals.length >= limit) return signals.slice(0, limit);

      const metadata = { cik: payload.cik, companyName: payload.name, ticker: payload.tickers?.[0] };
      for (const file of payload.filings?.files?.slice(0, historicalFileLimit) ?? []) {
        if (!file.name || signals.length >= limit) break;
        const fileUrl = historicalSubmissionUrl(baseUrl, file.name);
        const fileResponse = await fetchImpl(fileUrl, {
          headers: {
            "user-agent": userAgent,
            accept: "application/json"
          }
        });
        if (!fileResponse.ok) throw new Error(`SEC EDGAR historical ${normalizedCik} ${file.name} request failed: ${fileResponse.status}`);
        signals.push(...parseSecFilingTable((await fileResponse.json()) as SecRecentFilings, metadata, limit - signals.length));
      }
      return signals.slice(0, limit);
    })
  );

  return batches.flat();
}

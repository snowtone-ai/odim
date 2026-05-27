import type { RawSignal } from "../lib/pipeline/types.ts";
import { getString, parseDate, type PublicRecord } from "./common.ts";

export type PatentOptions = {
  baseUrl?: string;
  assignee?: string;
  cpcGroup?: string;
  limit?: number;
  page?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  assigneeName: ["assignees.0.assignee_organization", "assigneeName", "assignee_organization", "assignee"],
  cpcGroup: ["cpcs.0.cpc_group", "cpcGroup", "cpc_group", "cpc"],
  filingDate: ["application.0.filing_date", "filingDate", "filing_date"],
  grantDate: ["patent_date", "grantDate", "grant_date"],
  patentNumber: ["patent_id", "patentNumber", "patent_number"],
  title: ["patent_title", "title"]
} as const;

export function parsePatentRecords(records: PublicRecord[], sourceUrl: string, limit = 50): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const patentNumber = getString(record, fieldAliases.patentNumber);
    const grantDate = parseDate(getString(record, fieldAliases.grantDate));
    if (!patentNumber || !grantDate) return [];

    const title = getString(record, fieldAliases.title) ?? `Patent ${patentNumber}`;
    const externalId = `patent:${patentNumber}`;

    return [
      {
        layer: "cash",
        source: "uspto-patents",
        externalId,
        observedAt: grantDate,
        confidence: 0.58,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "uspto-patents",
            url: `https://patents.google.com/patent/US${patentNumber}`,
            title: `USPTO ${patentNumber}: ${title}`,
            externalId,
            observedAt: grantDate
          }
        ],
        payload: {
          assigneeName: getString(record, fieldAliases.assigneeName),
          cpcGroup: getString(record, fieldAliases.cpcGroup),
          filingDate: parseDate(getString(record, fieldAliases.filingDate))?.slice(0, 10),
          grantDate: grantDate.slice(0, 10),
          patentNumber,
          title,
          raw: record
        }
      }
    ];
  });
}

export async function fetchPatentSignals(options: PatentOptions): Promise<RawSignal[]> {
  const baseUrl = options.baseUrl ?? "https://search.patentsview.org/api/v1/patent/";
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.limit ?? 50;
  const page = options.page ?? 1;

  const params = new URLSearchParams({ page: String(page), per_page: String(limit), sort: "patent_date:desc" });
  if (options.assignee) params.set("q", JSON.stringify({ _contains: { "assignees.assignee_organization": options.assignee } }));
  if (options.cpcGroup) params.set("f", JSON.stringify(["patent_id", "patent_title", "patent_date", "assignees", "cpcs", "application"]));

  const url = `${baseUrl}?${params.toString()}`;
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`PatentsView API request failed: ${response.status}`);

  const payload = (await response.json()) as { patents?: PublicRecord[] };
  const records = payload.patents ?? [];
  return parsePatentRecords(records, baseUrl, limit);
}

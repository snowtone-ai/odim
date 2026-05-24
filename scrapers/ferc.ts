import type { RawSignal } from "../lib/pipeline/types.ts";

type FercRecord = Record<string, unknown>;

export type FercOptions = {
  feedUrl: string;
  limit?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  applicant: ["applicant", "applicantRaw", "company", "respondent", "party"],
  capacityMw: ["capacityMw", "capacity_mw", "mw", "megawatts"],
  description: ["description", "title", "summary", "document_title"],
  docketNumber: ["docketNumber", "docket_number", "docket", "sub_docket"],
  filingDate: ["filingDate", "filing_date", "date", "filed_at"],
  projectName: ["projectName", "project_name", "title", "facility"]
} as const;

function getString(record: FercRecord, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = record[alias];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  return parsed.toISOString();
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export function parseFercRecords(records: FercRecord[], sourceUrl: string, limit = 50): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const docketNumber = getString(record, fieldAliases.docketNumber);
    const filingDate = parseDate(getString(record, fieldAliases.filingDate));
    if (!docketNumber || !filingDate) return [];

    const applicant = getString(record, fieldAliases.applicant) ?? "Unknown FERC applicant";
    const description = getString(record, fieldAliases.description) ?? docketNumber;
    const projectName = getString(record, fieldAliases.projectName) ?? description;

    return [
      {
        layer: "energy",
        source: "ferc-elibrary",
        externalId: docketNumber,
        observedAt: filingDate,
        confidence: 0.7,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "ferc-elibrary",
            url: sourceUrl,
            title: `FERC docket ${docketNumber}`,
            externalId: docketNumber,
            observedAt: filingDate
          }
        ],
        payload: {
          applicantRaw: applicant,
          capacityMw: getString(record, fieldAliases.capacityMw),
          description,
          docketNumber,
          filingDate: filingDate.slice(0, 10),
          projectName,
          raw: record
        }
      }
    ];
  });
}

export async function fetchFercSignals(options: FercOptions): Promise<RawSignal[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(options.feedUrl, { headers: { accept: "application/json,text/csv;q=0.9,*/*;q=0.1" } });
  if (!response.ok) throw new Error(`FERC feed request failed: ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    const payload = (await response.json()) as FercRecord[] | { results?: FercRecord[]; data?: FercRecord[] };
    const records = Array.isArray(payload) ? payload : (payload.results ?? payload.data ?? []);
    return parseFercRecords(records, options.feedUrl, options.limit);
  }

  return parseFercRecords(parseCsv(await response.text()), options.feedUrl, options.limit);
}

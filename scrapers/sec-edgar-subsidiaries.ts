import { createHash, randomUUID } from "node:crypto";
import type { OntologyLinkDraft, SourceRef } from "../lib/pipeline/types.ts";
import { fetchWithTimeout } from "./common.ts";

export type SubsidiaryOptions = {
  baseUrl?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
};

type SecSubmissionsJson = {
  cik: string | number;
  name: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      form?: string[];
      primaryDocument?: string[];
      filingDate?: string[];
    };
  };
};

type FilingIndexItem = {
  name?: string;
  type?: string;
  description?: string;
};

function normalizeCik(cik: string | number): string {
  return String(cik).replace(/^0+/, "").padStart(10, "0");
}

function normalizeCikBare(cik: string | number): string {
  return String(cik).replace(/^0+/, "");
}

function accessionPath(accessionNumber: string): string {
  return accessionNumber.replaceAll("-", "");
}

function stableId(parts: string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 22);
}

function parseSubsidiariesHtml(html: string): Array<{ name: string; jurisdiction: string }> {
  const subsidiaries: Array<{ name: string; jurisdiction: string }> = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells: string[] = [];
    const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    }
    if (cells.length >= 2) {
      const name = cells[0];
      const jurisdiction = cells[1];
      if (name.length > 2 && !/^(name|subsidiary|company|corporation)/i.test(name)) {
        subsidiaries.push({ name, jurisdiction });
      }
    }
  }
  return subsidiaries;
}

function parseSubsidiariesText(text: string): Array<{ name: string; jurisdiction: string }> {
  const subsidiaries: Array<{ name: string; jurisdiction: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;
    if (/^(name|subsidiary|jurisdiction|state|country|exhibit)/i.test(trimmed)) continue;
    const parts = trimmed.split(/\s{2,}|\t/);
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const jurisdiction = parts[parts.length - 1].trim();
      if (name.length > 2 && jurisdiction.length > 0) {
        subsidiaries.push({ name, jurisdiction });
      }
    } else if (trimmed.length > 3 && !trimmed.includes("....")) {
      subsidiaries.push({ name: trimmed, jurisdiction: "" });
    }
  }
  return subsidiaries;
}

export async function fetchSubsidiaryLinks(
  cik: string,
  options: SubsidiaryOptions = {}
): Promise<OntologyLinkDraft[]> {
  const baseUrl = options.baseUrl ?? "https://data.sec.gov/submissions";
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!options.userAgent) throw new Error("SEC_EDGAR_USER_AGENT is required");
  const userAgent = options.userAgent;
  const jsonHeaders = { "user-agent": userAgent, accept: "application/json" };

  const normalizedCik = normalizeCik(cik);
  const bareCik = normalizeCikBare(cik);

  const submissionsResp = await fetchWithTimeout(
    fetchImpl,
    `${baseUrl}/CIK${normalizedCik}.json`,
    { headers: jsonHeaders }
  );
  if (!submissionsResp.ok) return [];

  const submissions = (await submissionsResp.json()) as SecSubmissionsJson;
  const companyName = submissions.name ?? cik;
  const recent = submissions.filings?.recent;
  if (!recent?.accessionNumber?.length) return [];

  let tenKAccession: string | undefined;
  let tenKDate: string | undefined;
  for (let i = 0; i < (recent.form?.length ?? 0); i++) {
    if (recent.form?.[i] === "10-K") {
      tenKAccession = recent.accessionNumber?.[i];
      tenKDate = recent.filingDate?.[i];
      break;
    }
  }
  if (!tenKAccession) return [];

  const accPath = accessionPath(tenKAccession);
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${bareCik}/${accPath}/${tenKAccession}-index.json`;
  const indexResp = await fetchWithTimeout(fetchImpl, indexUrl, {
    headers: { "user-agent": userAgent, accept: "application/json" }
  });
  if (!indexResp.ok) return [];

  let ex21Name: string | undefined;
  try {
    const indexData = (await indexResp.json()) as { directory?: { item?: FilingIndexItem[] } };
    const items = indexData.directory?.item ?? [];
    const ex21 = items.find((item) => {
      const name = (item.name ?? "").toLowerCase();
      const desc = (item.description ?? "").toLowerCase();
      return (
        name.includes("ex-21") ||
        name.includes("ex21") ||
        name.includes("exhibit21") ||
        desc.includes("subsidiaries")
      );
    });
    ex21Name = ex21?.name;
  } catch {
    return [];
  }
  if (!ex21Name) return [];

  const ex21Url = `https://www.sec.gov/Archives/edgar/data/${bareCik}/${accPath}/${ex21Name}`;
  const ex21Resp = await fetchWithTimeout(fetchImpl, ex21Url, {
    headers: { "user-agent": userAgent, accept: "text/html,text/plain,*/*" }
  });
  if (!ex21Resp.ok) return [];

  const contentType = ex21Resp.headers.get("content-type") ?? "";
  const body = await ex21Resp.text();
  const parsed = contentType.includes("html") || body.trimStart().startsWith("<")
    ? parseSubsidiariesHtml(body)
    : parseSubsidiariesText(body);

  const sourceRef: SourceRef = {
    sourceId: "sec-edgar-ex21",
    url: ex21Url,
    title: `${companyName} Exhibit 21 (${tenKDate ?? "unknown"})`,
    externalId: tenKAccession,
    observedAt: tenKDate ? `${tenKDate}T00:00:00.000Z` : new Date().toISOString()
  };

  const parentId = `company:${normalizedCik}`;
  return parsed.slice(0, 200).map((sub) => ({
    id: randomUUID(),
    fromObjectId: parentId,
    toObjectId: `company:sub:${stableId([normalizedCik, sub.name])}`,
    linkType: "subsidiary",
    confidence: 0.95,
    orgVisible: null,
    sourceRefs: [sourceRef]
  } satisfies OntologyLinkDraft));
}

export async function fetchSubsidiaryLinksBatch(
  ciks: string[],
  options: SubsidiaryOptions
): Promise<OntologyLinkDraft[]> {
  const SEC_BATCH_SIZE = 8;
  const SEC_BATCH_DELAY_MS = 1200;
  const results: OntologyLinkDraft[] = [];

  for (let i = 0; i < ciks.length; i += SEC_BATCH_SIZE) {
    const batch = ciks.slice(i, i + SEC_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((cik) =>
        fetchSubsidiaryLinks(cik, options).catch((err) => {
          console.warn(`sec-edgar-ex21 ${cik}: ${err instanceof Error ? err.message : String(err)}`);
          return [] as OntologyLinkDraft[];
        })
      )
    );
    results.push(...batchResults.flat());
    if (i + SEC_BATCH_SIZE < ciks.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, SEC_BATCH_DELAY_MS));
    }
  }

  return results;
}

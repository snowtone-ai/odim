import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchWithTimeout } from "./common.ts";

const AGENCY_LAYER: Record<string, string> = {
  EPA: "water",
  DOE: "energy",
  FERC: "energy",
  NRC: "energy",
  SEC: "cash",
  FTC: "cash",
  DOJ: "cash",
  DOD: "logistics",
  DOT: "logistics",
  USDA: "land",
  DOI: "land"
};

export function parseFederalRegisterResults(records: Array<Record<string, unknown>>) {
  return records.flatMap((record) => {
    const agency = String((record.agencies as Array<{ name?: string }> | undefined)?.[0]?.name ?? "SEC").toUpperCase();
    const published = String(record.publication_date ?? "").slice(0, 10);
    if (!published) return [];
    return [
      {
        layer: AGENCY_LAYER[agency] ?? "cash",
        source: "federal-register",
        externalId: String(record.document_number ?? record.id ?? published),
        observedAt: `${published}T00:00:00.000Z`,
        confidence: String(record.type ?? "").includes("RULE") ? 0.9 : 0.7,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "federal-register",
            url: String(record.html_url ?? "https://www.federalregister.gov/"),
            title: String(record.title ?? agency),
            externalId: String(record.document_number ?? record.id ?? published),
            observedAt: `${published}T00:00:00.000Z`
          }
        ],
        payload: {
          agency,
          title: String(record.title ?? ""),
          documentType: String(record.type ?? ""),
          significant: true
        }
      } satisfies RawSignal
    ];
  });
}

export async function fetchFederalRegisterSignals(options: { fetchImpl?: typeof fetch; dryRun?: boolean }) {
  if (options.dryRun) {
    return parseFederalRegisterResults([
      { document_number: "2026-12345", publication_date: "2026-05-20", title: "EPA rule on industrial cooling water", type: "RULE", html_url: "https://example.local/fr", agencies: [{ name: "EPA" }] }
    ]);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://www.federalregister.gov/api/v1/documents.json?conditions[publication_date][gte]=${date}&conditions[type][]=RULE&conditions[type][]=PROPOSED_RULE&per_page=100`;
  const response = await fetchWithTimeout(fetchImpl, url);
  if (!response.ok) throw new Error(`Federal Register request failed: ${response.status}`);
  const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
  return parseFederalRegisterResults(payload.results ?? []);
}

import { randomUUID } from "node:crypto";
import type { OntologyLinkDraft, SourceRef } from "../lib/pipeline/types.ts";
import { fetchWithTimeout } from "./common.ts";

export type GleifOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

type GleifRelationshipResponse = {
  data?: {
    type?: string;
    id?: string;
    attributes?: {
      lei?: string;
      entity?: {
        legalName?: { name?: string };
      };
    };
  };
};

const GLEIF_RATE_DELAY_MS = 250; // 4 req/s to stay under 5 req/s fair-use limit

export async function fetchGleifRelationships(
  lei: string,
  options: GleifOptions = {}
): Promise<OntologyLinkDraft[]> {
  const baseUrl = options.baseUrl ?? "https://api.gleif.org/api/v1";
  const fetchImpl = options.fetchImpl ?? fetch;
  const links: OntologyLinkDraft[] = [];

  async function fetchRelation(path: string, linkType: string) {
    const url = `${baseUrl}/lei-records/${encodeURIComponent(lei)}/${path}`;
    const resp = await fetchWithTimeout(fetchImpl, url, {
      headers: { accept: "application/vnd.api+json" }
    });
    if (!resp.ok) return;

    const data = (await resp.json()) as GleifRelationshipResponse;
    const record = data.data;
    if (!record) return;

    const parentLei = record.attributes?.lei ?? record.id;
    if (!parentLei || parentLei === lei) return;

    const parentName = record.attributes?.entity?.legalName?.name ?? parentLei;

    const sourceRef: SourceRef = {
      sourceId: "gleif",
      url: `${baseUrl}/lei-records/${encodeURIComponent(parentLei)}`,
      title: `GLEIF LEI Record: ${parentName}`,
      externalId: parentLei,
      observedAt: new Date().toISOString()
    };

    links.push({
      id: randomUUID(),
      fromObjectId: `company:lei:${lei}`,
      toObjectId: `company:lei:${parentLei}`,
      linkType,
      confidence: 0.90,
      orgVisible: null,
      sourceRefs: [sourceRef]
    } satisfies OntologyLinkDraft);
  }

  await fetchRelation("direct-parent", "parent_company");
  await new Promise<void>((resolve) => setTimeout(resolve, GLEIF_RATE_DELAY_MS));
  await fetchRelation("ultimate-parent", "ultimate_parent");

  return links;
}

export async function fetchGleifRelationshipsBatch(
  leis: string[],
  options: GleifOptions = {}
): Promise<OntologyLinkDraft[]> {
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 1100; // 5 req/s rate limit across batch
  const results: OntologyLinkDraft[] = [];

  for (let i = 0; i < leis.length; i += BATCH_SIZE) {
    const batch = leis.slice(i, i + BATCH_SIZE);
    for (const lei of batch) {
      const batchResult = await fetchGleifRelationships(lei, options).catch((err) => {
        console.warn(`gleif ${lei}: ${err instanceof Error ? err.message : String(err)}`);
        return [] as OntologyLinkDraft[];
      });
      results.push(...batchResult);
    }
    if (i + BATCH_SIZE < leis.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}

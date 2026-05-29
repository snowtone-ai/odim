import { randomUUID } from "node:crypto";
import type { OntologyLinkDraft, OntologyObjectDraft, SourceRef } from "../lib/pipeline/types.ts";
import { fetchWithTimeout } from "./common.ts";

export type WikidataOptions = {
  endpointUrl?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
};

type WikidataBindings = {
  results?: {
    bindings?: Array<Record<string, { type: string; value: string } | undefined>>;
  };
};

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const WIKIDATA_BATCH_SIZE = 50;
const WIKIDATA_RATE_DELAY_MS = 1000;
const WIKIDATA_COOLDOWN_MS = 60_000;

function buildSparqlQuery(wikidataIds: string[]): string {
  const values = wikidataIds.map((id) => `wd:${id}`).join(" ");
  return `
SELECT ?item ?itemLabel ?subsidiary ?subsidiaryLabel ?industry ?industryLabel WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P355 ?subsidiary }
  OPTIONAL { ?item wdt:P452 ?industry }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ja" }
}
LIMIT 1000
`.trim();
}

function bindingValue(
  binding: Record<string, { type: string; value: string } | undefined>,
  key: string
): string | undefined {
  return binding[key]?.value;
}

function wikidataItemId(uri: string): string | undefined {
  const match = /\/([QP]\d+)$/.exec(uri);
  return match?.[1];
}

export async function fetchWikidataRelationships(
  wikidataIds: string[],
  options: WikidataOptions = {}
): Promise<{ links: OntologyLinkDraft[]; objects: OntologyObjectDraft[] }> {
  if (!wikidataIds.length) return { links: [], objects: [] };
  const endpointUrl = options.endpointUrl ?? WIKIDATA_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? fetch;
  const userAgent = options.userAgent ?? process.env.WIKIDATA_USER_AGENT ?? "Odim/1.0";

  const links: OntologyLinkDraft[] = [];
  const objects: OntologyObjectDraft[] = [];
  const seenObjects = new Set<string>();

  for (let i = 0; i < wikidataIds.length; i += WIKIDATA_BATCH_SIZE) {
    const batch = wikidataIds.slice(i, i + WIKIDATA_BATCH_SIZE);
    const sparql = buildSparqlQuery(batch);

    let resp: Response;
    try {
      resp = await fetchWithTimeout(
        fetchImpl,
        `${endpointUrl}?query=${encodeURIComponent(sparql)}&format=json`,
        {
          headers: {
            accept: "application/sparql-results+json",
            "user-agent": userAgent
          }
        },
        30_000
      );
    } catch (err) {
      console.warn(`wikidata batch ${i}: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }

    if (resp.status === 429) {
      console.warn("wikidata 429 — cooling down 60s");
      await new Promise<void>((resolve) => setTimeout(resolve, WIKIDATA_COOLDOWN_MS));
      i -= WIKIDATA_BATCH_SIZE; // retry same batch
      continue;
    }

    if (!resp.ok) {
      console.warn(`wikidata HTTP ${resp.status} for batch ${i}`);
      break;
    }

    const data = (await resp.json()) as WikidataBindings;
    const bindings = data.results?.bindings ?? [];

    for (const binding of bindings) {
      const itemUri = bindingValue(binding, "item");
      const itemLabel = bindingValue(binding, "itemLabel");
      const subsidiaryUri = bindingValue(binding, "subsidiary");
      const subsidiaryLabel = bindingValue(binding, "subsidiaryLabel");
      const industryUri = bindingValue(binding, "industry");
      const industryLabel = bindingValue(binding, "industryLabel");

      if (!itemUri) continue;
      const itemId = wikidataItemId(itemUri) ?? itemUri;

      const sourceRef: SourceRef = {
        sourceId: "wikidata",
        url: itemUri,
        title: itemLabel ?? itemId,
        externalId: itemId,
        observedAt: new Date().toISOString()
      };

      // Subsidiary link
      if (subsidiaryUri) {
        const subId = wikidataItemId(subsidiaryUri) ?? subsidiaryUri;
        const subLabel = subsidiaryLabel ?? subId;

        if (!seenObjects.has(subId)) {
          seenObjects.add(subId);
          objects.push({
            id: `company:wd:${subId}`,
            objectType: "company",
            attributes: {
              name: subLabel,
              wikidata_id: subId
            },
            orgVisible: null,
            sourceRefs: [
              {
                sourceId: "wikidata",
                url: subsidiaryUri,
                title: subLabel,
                externalId: subId,
                observedAt: new Date().toISOString()
              }
            ]
          } satisfies OntologyObjectDraft);
        }

        links.push({
          id: randomUUID(),
          fromObjectId: `company:wd:${itemId}`,
          toObjectId: `company:wd:${subId}`,
          linkType: "subsidiary",
          confidence: 0.65,
          orgVisible: null,
          sourceRefs: [sourceRef]
        } satisfies OntologyLinkDraft);
      }

      // Industry classification
      if (industryUri) {
        const industryId = wikidataItemId(industryUri) ?? industryUri;
        const industryName = industryLabel ?? industryId;

        if (!seenObjects.has(`industry:${industryId}`)) {
          seenObjects.add(`industry:${industryId}`);
          objects.push({
            id: `industry:wd:${industryId}`,
            objectType: "industry",
            attributes: {
              name: industryName,
              wikidata_id: industryId
            },
            orgVisible: null,
            sourceRefs: [
              {
                sourceId: "wikidata",
                url: industryUri,
                title: industryName,
                externalId: industryId,
                observedAt: new Date().toISOString()
              }
            ]
          } satisfies OntologyObjectDraft);
        }

        links.push({
          id: randomUUID(),
          fromObjectId: `company:wd:${itemId}`,
          toObjectId: `industry:wd:${industryId}`,
          linkType: "industry_classification",
          confidence: 0.75,
          orgVisible: null,
          sourceRefs: [sourceRef]
        } satisfies OntologyLinkDraft);
      }
    }

    if (i + WIKIDATA_BATCH_SIZE < wikidataIds.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, WIKIDATA_RATE_DELAY_MS));
    }
  }

  return { links, objects };
}

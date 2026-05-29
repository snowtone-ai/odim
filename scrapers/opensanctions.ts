import type { RawSignal } from "../lib/pipeline/types.ts";

type OpenSanctionsEntity = {
  id?: string;
  caption?: string;
  names?: string[];
  datasets?: string[];
  first_seen?: string;
  last_seen?: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function levenshtein(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  const matrix = Array.from({ length: a.length + 1 }, (_, row) => Array.from({ length: b.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

export function parseOpenSanctionsMatches(entities: OpenSanctionsEntity[], seedNames: string[]): RawSignal[] {
  const observedAt = new Date().toISOString();
  const signals: RawSignal[] = [];
  for (const entry of entities) {
    const names = [entry.caption ?? "", ...(entry.names ?? [])].filter(Boolean);
    const matched = seedNames.find((seed) => names.some((name) => levenshtein(seed, name) < 3 || normalize(seed) === normalize(name)));
    if (!matched) continue;
    const exact = names.some((name) => normalize(seedNames.find((seed) => seed === matched) ?? "") === normalize(name));
    signals.push({
      layer: "cash",
      source: "opensanctions",
      externalId: entry.id ?? matched,
      observedAt,
      confidence: exact ? 0.98 : 0.7,
      freshness: 1,
      isProprietary: false,
      payload: {
        entityName: matched,
        matchedName: entry.caption ?? names[0] ?? matched,
        datasets: entry.datasets ?? []
      },
      sourceRefs: [
        {
          sourceId: "opensanctions",
          title: `OpenSanctions hit for ${matched}`,
          url: "https://data.opensanctions.org/datasets/latest/default/entities.ftm.json",
          observedAt
        }
      ]
    });
  }
  return signals;
}

export async function fetchOpenSanctionsSignals(options: { seedNames: string[]; dryRun?: boolean }) {
  if (options.dryRun) {
    return parseOpenSanctionsMatches([{ id: "os-1", caption: "Meta Platforms, Inc.", datasets: ["sanctions"] }], options.seedNames);
  }
  const response = await fetch("https://data.opensanctions.org/datasets/latest/default/entities.ftm.json");
  if (!response.ok) throw new Error(`OpenSanctions request failed: ${response.status}`);
  const payload = (await response.json()) as OpenSanctionsEntity[];
  return parseOpenSanctionsMatches(payload.slice(0, 2500), options.seedNames);
}

import type { RawSignal } from "../lib/pipeline/types.ts";

type FemaRecord = {
  disasterNumber?: string;
  declarationTitle?: string;
  incidentBeginDate?: string;
  state?: string;
};

export function parseFemaDeclarations(records: FemaRecord[], entityLocations: Array<{ name: string; state?: string }>): RawSignal[] {
  const signals: RawSignal[] = [];
  for (const record of records) {
    const impacted = entityLocations.filter((entity) => entity.state && entity.state === record.state);
    for (const entity of impacted) {
      const observedAt = new Date(record.incidentBeginDate ?? Date.now()).toISOString();
      signals.push({
        layer: "land",
        source: "fema",
        externalId: record.disasterNumber ?? entity.name,
        observedAt,
        confidence: 0.86,
        freshness: 1,
        isProprietary: false,
        payload: {
          entityName: entity.name,
          state: record.state ?? "",
          event: record.declarationTitle ?? "Disaster declaration"
        },
        sourceRefs: [
          {
            sourceId: "fema",
            title: record.declarationTitle ?? "FEMA declaration",
            url: "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries",
            observedAt
          }
        ]
      });
    }
  }
  return signals;
}

export async function fetchFemaSignals(options: { entityLocations: Array<{ name: string; state?: string }>; dryRun?: boolean }) {
  if (options.dryRun) {
    return parseFemaDeclarations(
      [{ disasterNumber: "FEMA-1", declarationTitle: "Texas Severe Storms", incidentBeginDate: "2026-05-20", state: "TX" }],
      options.entityLocations
    );
  }
  const response = await fetch("https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=50");
  if (!response.ok) throw new Error(`FEMA request failed: ${response.status}`);
  const payload = (await response.json()) as { DisasterDeclarationsSummaries?: FemaRecord[] };
  return parseFemaDeclarations(payload.DisasterDeclarationsSummaries ?? [], options.entityLocations);
}

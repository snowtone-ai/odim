import type { RawSignal } from "../lib/pipeline/types.ts";
import { getString, parseDate, type PublicRecord } from "./common.ts";

export type EiaOptions = {
  apiKey: string;
  baseUrl?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
};

const fieldAliases = {
  balancingAuthority: ["balancing-authority-name", "balancingAuthority", "balancing_authority"],
  capacityMw: ["nameplate-capacity-mw", "capacityMw", "capacity_mw", "mw"],
  fuelType: ["energy-source-desc", "fuelType", "fuel_type", "energy_source"],
  plantId: ["plantid", "plantId", "plant_id", "plant-id"],
  plantName: ["plantName", "plant_name", "plant-name", "name"],
  reportPeriod: ["period", "reportPeriod", "report_period"],
  state: ["stateid", "state", "stateDescription"],
  status: ["status", "operating-status", "operatingstatus"]
} as const;

export function parseEiaRecords(records: PublicRecord[], sourceUrl: string, limit = 50): RawSignal[] {
  return records.slice(0, limit).flatMap((record) => {
    const plantId = getString(record, fieldAliases.plantId);
    const reportPeriod = getString(record, fieldAliases.reportPeriod);
    if (!plantId || !reportPeriod) return [];

    const observedAt = parseDate(reportPeriod) ?? parseDate(`${reportPeriod}-01`);
    if (!observedAt) return [];

    const plantName = getString(record, fieldAliases.plantName) ?? "Unknown plant";
    const externalId = `eia:${plantId}:${reportPeriod}`;

    return [
      {
        layer: "energy",
        source: "eia-electricity",
        externalId,
        observedAt,
        confidence: 0.82,
        freshness: 1,
        sourceRefs: [
          {
            sourceId: "eia-electricity",
            url: sourceUrl,
            title: `EIA plant ${plantName} (${plantId})`,
            externalId,
            observedAt
          }
        ],
        payload: {
          balancingAuthority: getString(record, fieldAliases.balancingAuthority),
          capacityMw: getString(record, fieldAliases.capacityMw),
          fuelType: getString(record, fieldAliases.fuelType),
          plantId,
          plantName,
          reportPeriod,
          state: getString(record, fieldAliases.state),
          status: getString(record, fieldAliases.status) ?? "operational",
          raw: record
        }
      }
    ];
  });
}

export async function fetchEiaSignals(options: EiaOptions): Promise<RawSignal[]> {
  const baseUrl = options.baseUrl ?? "https://api.eia.gov/v2";
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.limit ?? 50;
  if (!options.apiKey) throw new Error("EIA_API_KEY is required for EIA API requests");

  const url = `${baseUrl}/electricity/operating-generator-capacity/data/?api_key=${options.apiKey}&frequency=monthly&data[0]=nameplate-capacity-mw&sort[0][column]=period&sort[0][direction]=desc&length=${limit}`;
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`EIA API request failed: ${response.status}`);

  const payload = (await response.json()) as { response?: { data?: PublicRecord[] } };
  const records = payload.response?.data ?? [];
  return parseEiaRecords(records, `${baseUrl}/electricity/operating-generator-capacity`, limit);
}

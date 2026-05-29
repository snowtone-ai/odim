import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchWithTimeout } from "./common.ts";

const SERIES = [
  { id: "DFF", layer: "cash", label: "Fed Funds Rate" },
  { id: "DGS10", layer: "cash", label: "10Y Treasury" },
  { id: "DGS2", layer: "cash", label: "2Y Treasury" },
  { id: "UNRATE", layer: "cash", label: "Unemployment Rate" },
  { id: "CPIAUCSL", layer: "raw_materials", label: "CPI" },
  { id: "PPIACO", layer: "raw_materials", label: "PPI" },
  { id: "GDP", layer: "cash", label: "GDP" },
  { id: "GDPC1", layer: "cash", label: "Real GDP" },
  { id: "INDPRO", layer: "compute", label: "Industrial Production" },
  { id: "HOUST", layer: "land", label: "Housing Starts" },
  { id: "PERMIT", layer: "land", label: "Building Permits" },
  { id: "DCOILWTICO", layer: "energy", label: "WTI Crude" },
  { id: "DCOILBRENTEU", layer: "energy", label: "Brent Crude" },
  { id: "GOLDAMGBD228NLBM", layer: "raw_materials", label: "Gold Price" },
  { id: "DEXUSEU", layer: "cash", label: "EUR/USD" },
  { id: "BAMLH0A0HYM2", layer: "cash", label: "High Yield Spread" },
  { id: "T10Y2Y", layer: "cash", label: "Yield Curve Spread" },
  { id: "VIXCLS", layer: "cash", label: "VIX" },
  { id: "M2SL", layer: "cash", label: "Money Supply M2" }
];

export function parseFredSeriesObservations(
  series: { id: string; layer: string; label: string },
  observation: { date: string; value: string }
) {
  const value = Number(observation.value);
  if (!Number.isFinite(value)) return [];
  return [
    {
      layer: series.layer,
      source: "fred-economic",
      externalId: `${series.id}:${observation.date}`,
      observedAt: `${observation.date}T00:00:00.000Z`,
      confidence: 0.99,
      freshness: 1,
      sourceRefs: [
        {
          sourceId: "fred-economic",
          url: `https://fred.stlouisfed.org/series/${series.id}`,
          title: `${series.label} ${observation.date}`,
          externalId: series.id,
          observedAt: `${observation.date}T00:00:00.000Z`
        }
      ],
      payload: {
        seriesId: series.id,
        label: series.label,
        value,
        critical: series.id === "T10Y2Y" && value < 0
      }
    } satisfies RawSignal
  ];
}

export async function fetchFredSignals(options: { apiKey?: string; fetchImpl?: typeof fetch; dryRun?: boolean }) {
  if (options.dryRun) {
    return SERIES.map((series, index) =>
      parseFredSeriesObservations(series, { date: `2026-05-${String((index % 9) + 11).padStart(2, "0")}`, value: String(index === 16 ? -0.42 : 100 + index) })[0]
    );
  }
  if (!options.apiKey) return [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const allSignals: RawSignal[] = [];
  for (const series of SERIES) {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${options.apiKey}&file_type=json&sort_order=desc&limit=1`;
    const response = await fetchWithTimeout(fetchImpl, url);
    if (!response.ok) throw new Error(`FRED request failed: ${response.status}`);
    const payload = (await response.json()) as { observations?: Array<{ date: string; value: string }> };
    const first = payload.observations?.[0];
    if (first) allSignals.push(...parseFredSeriesObservations(series, first));
  }
  return allSignals;
}

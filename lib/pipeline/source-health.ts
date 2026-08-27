import { checkFreshness, type FreshnessStatus } from "./freshness.ts";

export type SourceHealthState = "configured" | "live-verified" | "fixture-only" | "skipped" | "failed";

export type SourceHealthEntry = {
  sourceId: string;
  lastSuccessAt: string | null;
  lastObservedAt: string | null;
  rawSignalCount: number;
  status: "healthy" | "stale" | "failing";
  state: SourceHealthState;
  slaHours?: number;
  hoursSinceUpdate?: number;
  detail?: string;
  verificationAt?: string | null;
};

export type SourceHealthConfig = {
  id: string;
  enabled?: boolean;
};

export type SourceHealthReport = {
  id: string;
  ok: boolean;
  count: number;
  lastObservedAt?: string;
  error?: string;
  skipped?: string;
};

export type SourceHealthRun = {
  mode?: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string;
  sourceReports?: SourceHealthReport[];
};

export type SourceHealthWatermark = {
  sourceId: string;
  lastSuccessAt?: string | null;
  lastObservedAt?: string | null;
  rawSignalCount?: number;
};

function timeValue(value?: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function latestRun(runs: readonly SourceHealthRun[]) {
  return [...runs].sort((a, b) => timeValue(b.startedAt) - timeValue(a.startedAt))[0];
}

function stateFor(
  report: SourceHealthReport | undefined,
  run: SourceHealthRun | undefined,
  watermark: SourceHealthWatermark | undefined
): SourceHealthState {
  if (report?.skipped) return "skipped";
  if (report && !report.ok) return "failed";
  if (run?.status === "failed" && report) return "failed";
  if (watermark?.lastSuccessAt) return "live-verified";
  if (report?.ok && run?.status === "succeeded") {
    return run.mode === "dry-run" ? "fixture-only" : "live-verified";
  }
  return "configured";
}

function statusFor(freshness: { status: FreshnessStatus } | undefined): SourceHealthEntry["status"] {
  if (freshness?.status === "fresh") return "healthy";
  if (freshness?.status === "stale") return "stale";
  return "failing";
}

/**
 * Combine the source registry with the latest run report and persisted
 * watermarks. A watermark is historical live evidence; a dry-run is never
 * promoted to live verification unless a live watermark already exists.
 */
export function buildSourceHealthEntries(
  configuredSources: readonly SourceHealthConfig[],
  runs: readonly SourceHealthRun[],
  watermarks: readonly SourceHealthWatermark[],
  forceFixtureOnly = false
): SourceHealthEntry[] {
  const run = latestRun(runs);
  const reports = new Map((run?.sourceReports ?? []).map((report) => [report.id, report]));
  const watermarkMap = new Map(watermarks.map((watermark) => [watermark.sourceId, watermark]));
  const configuredIds = configuredSources.filter((source) => source.enabled !== false).map((source) => source.id);
  const ids = [...new Set([...configuredIds, ...reports.keys(), ...watermarkMap.keys()])];
  const sourceRows = ids.map((sourceId) => {
    const report = reports.get(sourceId);
    const watermark = watermarkMap.get(sourceId);
    const state = forceFixtureOnly ? "fixture-only" : stateFor(report, run, watermark);
    const reportIsLiveSuccess = report?.ok === true && !report.skipped && run?.status === "succeeded" && run.mode !== "dry-run";
    const lastSuccessAt = watermark?.lastSuccessAt ?? (reportIsLiveSuccess ? run?.finishedAt ?? null : null);
    const lastObservedAt = report?.lastObservedAt ?? watermark?.lastObservedAt ?? null;
    const rawSignalCount = report?.count ?? watermark?.rawSignalCount ?? 0;
    const freshnessInput = {
      sourceId,
      lastSuccessAt,
      lastObservedAt,
      rawSignalCount
    };
    const freshness = checkFreshness([freshnessInput])[0];

    return {
      sourceId,
      lastSuccessAt,
      lastObservedAt,
      rawSignalCount,
      status: statusFor(freshness),
      state,
      slaHours: freshness?.slaHours,
      hoursSinceUpdate: freshness?.hoursSinceUpdate,
      detail: report?.error ?? report?.skipped ?? (state === "fixture-only" ? "dry-run" : undefined),
      verificationAt: state === "live-verified" ? lastSuccessAt : run?.finishedAt ?? null
    } satisfies SourceHealthEntry;
  });

  return sourceRows;
}

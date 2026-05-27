import { issueApiKey, redactApiKey, toApiKeyRow, type ApiKeyRecord } from "../auth/api-keys.ts";
import { tenantOrPublicFilter, type OrgContext } from "../api/org.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import { createServerSupabaseReadClient, createServiceSupabaseClient, hasSupabaseReadEnv, hasSupabaseWriteEnv } from "../supabase/client.ts";

export type OrgMember = {
  id: string;
  orgId: string;
  displayName: string;
  role: "analyst" | "admin";
};

export type AlertRule = {
  id: string;
  orgId: string;
  name: string;
  layer: string;
  minConfidence: number;
  destination: "email" | "slack" | "api";
  enabled: boolean;
  createdAt: string;
};

export type IngestionRun = {
  id: string;
  mode: "daily" | "backfill" | "dry-run";
  status: "running" | "succeeded" | "failed";
  rawSignalCount: number;
  alertCount: number;
  sourceLimit: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
};

export type SourceWatermark = {
  sourceId: string;
  mode: string;
  lastSuccessAt: string;
  lastObservedAt?: string;
  rawSignalCount: number;
};

const demoOrgId = "demo-org";

const fallbackMembers: OrgMember[] = [
  { id: "demo-admin", orgId: demoOrgId, displayName: "Odim Admin", role: "admin" },
  { id: "demo-analyst", orgId: demoOrgId, displayName: "Reality Analyst", role: "analyst" }
];

const fallbackApiKey: ApiKeyRecord = {
  id: deterministicUuid("api_key", "fallback-demo-key"),
  orgId: demoOrgId,
  name: "Huginn Agent Read API",
  prefix: "odim_live_demo",
  keyHash: "sha256:redacted",
  scopes: ["huginn:query", "alerts:read", "entities:read"],
  createdBy: "demo-admin",
  createdAt: "2026-05-24T00:00:00.000Z"
};

const fallbackAlertRules: AlertRule[] = [
  {
    id: deterministicUuid("alert_rule", "demo-large-power"),
    orgId: demoOrgId,
    name: "Watchlist large-load power filings",
    layer: "energy",
    minConfidence: 0.7,
    destination: "email",
    enabled: true,
    createdAt: "2026-05-24T00:00:00.000Z"
  },
  {
    id: deterministicUuid("alert_rule", "demo-spv-permit"),
    orgId: demoOrgId,
    name: "SPV construction permit changes",
    layer: "land",
    minConfidence: 0.65,
    destination: "slack",
    enabled: true,
    createdAt: "2026-05-24T00:00:00.000Z"
  }
];

const fallbackIngestionRuns: IngestionRun[] = [
  {
    id: deterministicUuid("ingestion_run", "fallback-daily"),
    mode: "daily",
    status: "succeeded",
    rawSignalCount: 13,
    alertCount: 4,
    sourceLimit: 50,
    startedAt: "2026-05-27T08:17:00.000Z",
    finishedAt: "2026-05-27T08:18:12.000Z"
  },
  {
    id: deterministicUuid("ingestion_run", "fallback-backfill"),
    mode: "backfill",
    status: "succeeded",
    rawSignalCount: 500,
    alertCount: 37,
    sourceLimit: 500,
    startedAt: "2026-05-26T01:00:00.000Z",
    finishedAt: "2026-05-26T01:08:42.000Z"
  }
];

const fallbackSourceWatermarks: SourceWatermark[] = [
  {
    sourceId: "sec-edgar",
    mode: "backfill",
    lastSuccessAt: "2026-05-26T01:08:42.000Z",
    lastObservedAt: "2026-05-20T00:00:00.000Z",
    rawSignalCount: 120
  },
  {
    sourceId: "ferc-elibrary",
    mode: "daily",
    lastSuccessAt: "2026-05-27T08:18:12.000Z",
    lastObservedAt: "2026-05-19T00:00:00.000Z",
    rawSignalCount: 48
  },
  {
    sourceId: "eia-electricity",
    mode: "backfill",
    lastSuccessAt: "2026-05-26T01:08:42.000Z",
    lastObservedAt: "2026-04-01T00:00:00.000Z",
    rawSignalCount: 100
  }
];

function effectiveOrgId(context: OrgContext) {
  return context.orgId ?? demoOrgId;
}

function fallbackAdminSettings(orgId: string) {
  return {
    source: "fallback" as const,
    org: { id: orgId, name: "Odim Demo Fund", tier: "intelligence" },
    members: fallbackMembers.filter((member) => member.orgId === orgId),
    apiKeys: [redactApiKey({ ...fallbackApiKey, orgId })],
    alertRules: fallbackAlertRules.map((rule) => ({ ...rule, orgId })),
    ingestionRuns: fallbackIngestionRuns,
    sourceWatermarks: fallbackSourceWatermarks
  };
}

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.ADMIN_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the table|relation .* does not exist/i.test(message);
}

function assertSupabaseReadEnv() {
  if (!hasSupabaseReadEnv() && isProductionRuntime()) {
    throw new Error("Supabase read environment is required in production");
  }
}

function assertSupabaseWriteEnv() {
  if (!hasSupabaseWriteEnv() && isProductionRuntime()) {
    throw new Error("Supabase write environment is required in production");
  }
}

export async function getAdminSettings(context: OrgContext = {}) {
  const orgId = effectiveOrgId(context);
  assertSupabaseReadEnv();
  if (!hasSupabaseReadEnv()) {
    return fallbackAdminSettings(orgId);
  }

  const client = createServerSupabaseReadClient();
  const [orgResult, usersResult, apiKeysResult, alertRulesResult, ingestionRunsResult, sourceWatermarksResult] = await Promise.all([
    client.from("orgs").select("id, name, tier").eq("id", orgId).single(),
    client.from("users").select("id, org_id, display_name, role").eq("org_id", orgId).limit(100),
    client
      .from("api_keys")
      .select("id, org_id, name, prefix, scopes, created_by, created_at, last_used_at, revoked_at")
      .eq("org_id", orgId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("alert_rules")
      .select("id, org_id, name, layer, min_confidence, destination, enabled, created_at")
      .or(tenantOrPublicFilter("org_id", orgId))
      .order("created_at", { ascending: false })
      .limit(100),
    // NOTE(single-tenant): ingestion_runs and source_watermarks have no org_id column.
    // These are system-wide pipeline operation tables, safe for single-tenant deployment.
    // Multi-tenant expansion requires: ALTER TABLE ingestion_runs ADD COLUMN org_id uuid;
    // ALTER TABLE source_watermarks ADD COLUMN org_id uuid; plus .eq("org_id", orgId) filters.
    client
      .from("ingestion_runs")
      .select("id, mode, status, source_limit, raw_signal_count, alert_count, error, started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(10),
    client
      .from("source_watermarks")
      .select("source_id, mode, last_success_at, last_observed_at, raw_signal_count")
      .order("updated_at", { ascending: false })
      .limit(25)
  ]);

  const firstError =
    orgResult.error ??
    usersResult.error ??
    apiKeysResult.error ??
    alertRulesResult.error ??
    ingestionRunsResult.error ??
    sourceWatermarksResult.error;
  if (firstError) {
    if (shouldFallbackFromSupabaseError(firstError.message)) return fallbackAdminSettings(orgId);
    throw new Error(`admin settings read failed: ${firstError.message}`);
  }

  return {
    source: "supabase" as const,
    org: orgResult.data,
    members: (usersResult.data ?? []).map((user) => ({
      id: String(user.id),
      orgId: String(user.org_id),
      displayName: String(user.display_name ?? user.id),
      role: user.role === "admin" ? "admin" : "analyst"
    })),
    apiKeys: (apiKeysResult.data ?? []).map((row) => ({
      id: String(row.id),
      orgId: String(row.org_id),
      name: String(row.name),
      prefix: String(row.prefix),
      scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
      createdBy: row.created_by ? String(row.created_by) : undefined,
      createdAt: String(row.created_at),
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
      revokedAt: row.revoked_at ? String(row.revoked_at) : undefined
    })),
    alertRules: (alertRulesResult.data ?? []).map((row) => ({
      id: String(row.id),
      orgId: String(row.org_id),
      name: String(row.name),
      layer: String(row.layer),
      minConfidence: Number(row.min_confidence),
      destination: ["email", "slack", "api"].includes(String(row.destination)) ? row.destination : "api",
      enabled: Boolean(row.enabled),
      createdAt: String(row.created_at)
    })),
    ingestionRuns: (ingestionRunsResult.data ?? []).map((row) => ({
      id: String(row.id),
      mode: ["daily", "backfill", "dry-run"].includes(String(row.mode)) ? row.mode : "daily",
      status: ["running", "succeeded", "failed"].includes(String(row.status)) ? row.status : "failed",
      rawSignalCount: Number(row.raw_signal_count ?? 0),
      alertCount: Number(row.alert_count ?? 0),
      sourceLimit: Number(row.source_limit ?? 0),
      startedAt: String(row.started_at),
      finishedAt: row.finished_at ? String(row.finished_at) : undefined,
      error: row.error ? String(row.error) : undefined
    })),
    sourceWatermarks: (sourceWatermarksResult.data ?? []).map((row) => ({
      sourceId: String(row.source_id),
      mode: String(row.mode ?? "daily"),
      lastSuccessAt: String(row.last_success_at),
      lastObservedAt: row.last_observed_at ? String(row.last_observed_at) : undefined,
      rawSignalCount: Number(row.raw_signal_count ?? 0)
    }))
  };
}

export async function createApiKey(context: OrgContext, input: { name: string; scopes?: string[]; createdBy?: string }) {
  const orgId = effectiveOrgId(context);
  const issued = issueApiKey({ orgId, name: input.name, scopes: input.scopes, createdBy: input.createdBy });
  assertSupabaseWriteEnv();
  if (!hasSupabaseWriteEnv()) {
    return {
      source: "fallback" as const,
      token: issued.token,
      apiKey: redactApiKey(issued.record)
    };
  }

  const { error } = await createServiceSupabaseClient().from("api_keys").upsert(toApiKeyRow(issued.record), { onConflict: "id" });
  if (error) throw new Error(`api key write failed: ${error.message}`);
  return {
    source: "supabase" as const,
    token: issued.token,
    apiKey: redactApiKey(issued.record)
  };
}

export async function revokeApiKey(context: OrgContext, input: { id: string }) {
  const orgId = effectiveOrgId(context);
  if (!input.id) throw new Error("api key id is required");
  assertSupabaseWriteEnv();
  if (!hasSupabaseWriteEnv()) {
    return { source: "fallback" as const, revoked: true, id: input.id, orgId };
  }

  const { error } = await createServiceSupabaseClient()
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("org_id", orgId);
  if (error) throw new Error(`api key revoke failed: ${error.message}`);
  return { source: "supabase" as const, revoked: true, id: input.id, orgId };
}

import { getOrgContextFromRequest, type OrgContext } from "../api/org.ts";
import { assertApiKeyPepperConfigured, isCommercialProductionEnv, prefixForToken, verifyApiKey, type ApiKeyRecord } from "./api-keys.ts";
import { createServerSupabaseReadClient, createServiceSupabaseClient, hasSupabaseReadEnv, hasSupabaseWriteEnv } from "../supabase/client.ts";

export type ApiAuthResult =
  | { ok: true; context: OrgContext; mode: "disabled" | "api-key"; scopes: string[] }
  | { ok: false; status: 401 | 403 | 429 | 503; error: string };

type FailedAuthBucket = {
  count: number;
  resetAt: number;
};

const failedAuthByClient = new Map<string, FailedAuthBucket>();

function authRequired() {
  return process.env.AUTH_REQUIRED === "true" || isCommercialProductionEnv();
}

function extractApiToken(request: Request) {
  const explicit = request.headers.get("x-odim-api-key");
  if (explicit) return explicit.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function failedAuthKey(request: Request, token: string) {
  return `${clientIp(request)}:${prefixForToken(token)}`;
}

export function resetApiAuthRateLimit() {
  failedAuthByClient.clear();
}

function assertApiAuthAttemptAllowed(key: string, now = Date.now()) {
  const windowMs = numberEnv("API_AUTH_RATE_LIMIT_WINDOW_MS", 60_000);
  const maxFailures = numberEnv("API_AUTH_MAX_FAILED_ATTEMPTS", 10);
  const bucket = failedAuthByClient.get(key);
  if (!bucket || now >= bucket.resetAt) return;
  if (bucket.count >= maxFailures) {
    throw new Error("API key auth rate limit exceeded");
  }
}

function recordFailedApiAuthAttempt(key: string, now = Date.now()) {
  const windowMs = numberEnv("API_AUTH_RATE_LIMIT_WINDOW_MS", 60_000);
  const current = failedAuthByClient.get(key);
  const bucket =
    current && now < current.resetAt
      ? current
      : {
          count: 0,
          resetAt: now + windowMs
        };
  bucket.count += 1;
  failedAuthByClient.set(key, bucket);
}

function clearFailedApiAuthAttempts(key: string) {
  failedAuthByClient.delete(key);
}

function toApiKeyRecord(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    prefix: String(row.prefix),
    keyHash: String(row.key_hash),
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: String(row.created_at),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
    revokedAt: row.revoked_at ? String(row.revoked_at) : undefined
  };
}

async function touchLastUsedAt(id: string, orgId: string) {
  if (!hasSupabaseWriteEnv()) return;
  await createServiceSupabaseClient()
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);
}

export async function authorizeApiRequest(request: Request, requiredScope: string): Promise<ApiAuthResult> {
  if (!authRequired()) {
    return { ok: true, context: getOrgContextFromRequest(request), mode: "disabled", scopes: [] };
  }

  const token = extractApiToken(request);
  if (!token) return { ok: false, status: 401, error: "API key is required" };
  const authRateLimitKey = failedAuthKey(request, token);
  try {
    assertApiAuthAttemptAllowed(authRateLimitKey);
  } catch {
    return { ok: false, status: 429, error: "Too many failed API key attempts" };
  }

  try {
    assertApiKeyPepperConfigured();
  } catch (error) {
    return { ok: false, status: 503, error: error instanceof Error ? error.message : "API key auth is not configured" };
  }

  if (!hasSupabaseReadEnv()) return { ok: false, status: 503, error: "Supabase read environment is required for API key auth" };

  const { data, error } = await createServerSupabaseReadClient()
    .from("api_keys")
    .select("id, org_id, name, prefix, key_hash, scopes, created_by, created_at, last_used_at, revoked_at")
    .eq("prefix", prefixForToken(token))
    .is("revoked_at", null)
    .limit(5);
  if (error) throw new Error(`api key auth failed: ${error.message}`);

  const record = (data ?? []).map((row) => toApiKeyRecord(row as Record<string, unknown>)).find((candidate) => verifyApiKey(token, candidate));
  if (!record) {
    recordFailedApiAuthAttempt(authRateLimitKey);
    return { ok: false, status: 401, error: "Invalid API key" };
  }
  clearFailedApiAuthAttempts(authRateLimitKey);
  if (!record.scopes.includes(requiredScope) && !record.scopes.includes("admin:*")) {
    return { ok: false, status: 403, error: "Insufficient API key permissions" };
  }

  await touchLastUsedAt(record.id, record.orgId);
  return { ok: true, context: { orgId: record.orgId }, mode: "api-key", scopes: record.scopes };
}

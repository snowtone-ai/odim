import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import { isProductionRuntime } from "../env/runtime.ts";

export type ApiKeyRecord = {
  id: string;
  orgId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: string[];
  createdBy?: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type ApiKeyIssueResult = {
  token: string;
  record: ApiKeyRecord;
};

export const DEFAULT_API_KEY_SCOPES = ["huginn:query", "alerts:read", "entities:read"] as const;

export const ALLOWED_API_KEY_SCOPES = [
  "huginn:query",
  "signals:read",
  "entities:read",
  "alerts:read",
  "audit:read",
  "settings:read",
  "admin:read",
  "admin:write",
  "read:signals",
  "read:entities",
  "read:alerts",
  "read:audit"
] as const;

const allowedApiKeyScopes = new Set<string>(ALLOWED_API_KEY_SCOPES);

export function resolveIssuableScopes(scopes?: string[]) {
  const requested = scopes?.length ? scopes : [...DEFAULT_API_KEY_SCOPES];
  for (const scope of requested) {
    if (!allowedApiKeyScopes.has(scope)) {
      throw new Error(`API key scope is not issuable: ${scope}`);
    }
  }
  return requested;
}

export function canIssueScopes(issuerScopes: string[], requestedScopes: string[]) {
  if (issuerScopes.includes("admin:*")) return true;
  return requestedScopes.every((scope) => issuerScopes.includes(scope));
}

export function isCommercialProductionEnv(env: NodeJS.ProcessEnv = process.env) {
  return isProductionRuntime(env);
}

export function requiresApiKeyPepper(env: NodeJS.ProcessEnv = process.env) {
  return env.AUTH_REQUIRED === "true" || isCommercialProductionEnv(env);
}

export function assertApiKeyPepperConfigured(env: NodeJS.ProcessEnv = process.env) {
  if (requiresApiKeyPepper(env) && !env.API_KEY_PEPPER) {
    throw new Error("API_KEY_PEPPER is required when API key auth is required");
  }
}

function hashToken(token: string) {
  assertApiKeyPepperConfigured();
  const pepper = process.env.API_KEY_PEPPER || "odim-local-development-pepper";
  return createHmac("sha256", pepper).update(token).digest("hex");
}

export function prefixForToken(token: string) {
  return token.slice(0, "odim_live_".length + 8);
}

export function issueApiKey(input: {
  orgId: string;
  name: string;
  scopes?: string[];
  createdBy?: string;
  now?: Date;
  tokenBytes?: Buffer;
}): ApiKeyIssueResult {
  if (!input.orgId) throw new Error("orgId is required to issue an API key");
  if (!input.name.trim()) throw new Error("API key name is required");
  const scopes = resolveIssuableScopes(input.scopes);

  const secret = (input.tokenBytes ?? randomBytes(24)).toString("base64url");
  const token = `odim_live_${secret}`;
  const prefix = prefixForToken(token);
  const createdAt = (input.now ?? new Date()).toISOString();
  const record = {
    id: deterministicUuid("api_key", { orgId: input.orgId, name: input.name, prefix, createdAt }),
    orgId: input.orgId,
    name: input.name.trim(),
    prefix,
    keyHash: hashToken(token),
    scopes,
    createdBy: input.createdBy,
    createdAt
  };

  return { token, record };
}

export function verifyApiKey(token: string, record: Pick<ApiKeyRecord, "keyHash" | "revokedAt">) {
  if (record.revokedAt) return false;
  const expected = Buffer.from(record.keyHash, "hex");
  const actual = Buffer.from(hashToken(token), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function redactApiKey(record: ApiKeyRecord) {
  return {
    id: record.id,
    orgId: record.orgId,
    name: record.name,
    prefix: record.prefix,
    scopes: record.scopes,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt
  };
}

export function toApiKeyRow(record: ApiKeyRecord) {
  return {
    id: record.id,
    org_id: record.orgId,
    name: record.name,
    prefix: record.prefix,
    key_hash: record.keyHash,
    scopes: record.scopes,
    created_by: record.createdBy ?? null,
    created_at: record.createdAt,
    last_used_at: record.lastUsedAt ?? null,
    revoked_at: record.revokedAt ?? null
  };
}

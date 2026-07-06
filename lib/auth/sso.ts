export type SsoProvider = "none" | "saml" | "oidc";

// "selfserve" sessions are issued by the env-gated signup and token-verified
// invite-accept routes rather than an external identity provider.
export type SsoSessionProvider = Exclude<SsoProvider, "none"> | "selfserve";

export type SsoSession = {
  email: string;
  orgId: string;
  provider: SsoSessionProvider;
  exp: number;
};

const COOKIE_NAME = "odim_sso_session";

function base64Url(input: string | Uint8Array) {
  const value =
    typeof input === "string"
      ? Buffer.from(input, "utf8")
      : Buffer.from(input);
  return value.toString("base64url");
}

function parseBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sessionSecret() {
  return process.env.SSO_SESSION_SECRET || process.env.API_KEY_PEPPER || "";
}

async function importHmacKey() {
  const secret = sessionSecret();
  if (!secret) throw new Error("SSO_SESSION_SECRET or API_KEY_PEPPER is required for SSO");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signPayload(payload: string) {
  const key = await importHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64Url(new Uint8Array(signature));
}

async function verifySignature(payload: string, signature: string) {
  const key = await importHmacKey();
  return crypto.subtle.verify("HMAC", key, Buffer.from(signature, "base64url"), new TextEncoder().encode(payload));
}

export function getSsoProvider(env: NodeJS.ProcessEnv = process.env): SsoProvider {
  const value = String(env.SSO_PROVIDER ?? "none").toLowerCase();
  if (value === "saml" || value === "oidc") return value;
  return "none";
}

export function ssoCookieName() {
  return COOKIE_NAME;
}

export function ssoEnabled(env: NodeJS.ProcessEnv = process.env) {
  return getSsoProvider(env) !== "none";
}

export function resolveSsoOrgId(email: string, explicitOrgId?: string | null) {
  if (explicitOrgId) return explicitOrgId;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const mapping = process.env.SSO_DOMAIN_ORG_MAP;
  if (mapping) {
    try {
      const parsed = JSON.parse(mapping) as Record<string, string>;
      if (parsed[domain]) return parsed[domain];
    } catch {
      // ignore malformed mapping and fall through
    }
  }
  return process.env.DEFAULT_ORG_ID ?? "11111111-1111-4111-8111-111111111111";
}

export async function issueSsoSession(input: { email: string; orgId?: string | null; provider: SsoSessionProvider; ttlSeconds?: number }) {
  const body = {
    email: input.email,
    orgId: resolveSsoOrgId(input.email, input.orgId),
    provider: input.provider,
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 12 * 60 * 60)
  } satisfies SsoSession;
  const payload = base64Url(JSON.stringify(body));
  return `${payload}.${await signPayload(payload)}`;
}

export async function verifySsoSession(token?: string | null): Promise<SsoSession | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!(await verifySignature(payload, signature))) return null;
  const body = JSON.parse(parseBase64Url(payload)) as SsoSession;
  if (!body.email || !body.orgId || !body.provider || body.exp * 1000 <= Date.now()) return null;
  return body;
}

export async function readSsoSessionCookie(header: string | null) {
  if (!header) return null;
  const token = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  return verifySsoSession(token);
}

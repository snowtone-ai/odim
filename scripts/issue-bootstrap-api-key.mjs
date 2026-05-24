import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createApiKey } from "../lib/repositories/admin.ts";

function loadDotenvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  let content = readFileSync(path, "utf8");
  if (/^API_KEY_PEPPER=\s*$/m.test(content)) {
    const pepper = randomBytes(32).toString("base64url");
    content = content.replace(/^API_KEY_PEPPER=\s*$/m, `API_KEY_PEPPER=${pepper}`);
    writeFileSync(path, content);
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

loadDotenvLocal();

const orgId = process.env.BOOTSTRAP_ORG_ID || process.env.PAID_SOURCE_ORG_ID || "11111111-1111-4111-8111-111111111111";
const name = process.env.BOOTSTRAP_API_KEY_NAME || "Bootstrap Admin API Key";
const scopes = (process.env.BOOTSTRAP_API_KEY_SCOPES || "admin:*")
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);
const createdBy = process.env.BOOTSTRAP_CREATED_BY && isUuid(process.env.BOOTSTRAP_CREATED_BY) ? process.env.BOOTSTRAP_CREATED_BY : undefined;

// Hard fail early to avoid generating a non-persisted fallback token by mistake.
required("NEXT_PUBLIC_SUPABASE_URL");
required("SUPABASE_SERVICE_ROLE_KEY");
required("API_KEY_PEPPER");

let result;
try {
  result = await createApiKey({ orgId }, { name, scopes, createdBy });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/permission denied for table api_keys/i.test(message)) {
    console.error("Bootstrap API key creation failed: Supabase service_role cannot write to api_keys.");
    console.error("Run supabase/tests/service-role-write-grants.sql once in the Supabase SQL Editor, then rerun pnpm issue:bootstrap-api-key.");
    process.exitCode = 1;
    result = null;
  } else {
    throw error;
  }
}

if (result && result.source !== "supabase") {
  throw new Error("Bootstrap key was not persisted to Supabase. Check write env values.");
}

if (result) {
  console.log("Bootstrap API key created.");
  console.log(`orgId: ${orgId}`);
  console.log(`name: ${name}`);
  console.log(`scopes: ${scopes.join(",")}`);
  console.log(`token: ${result.token}`);
}

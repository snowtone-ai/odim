import { existsSync, readFileSync } from "node:fs";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../lib/supabase/client.ts";

// The app operates around a single default org (DEFAULT_ORG_ID) in single-tenant
// deployments. When that org row is absent the settings page's orgs lookup returns
// zero rows and getAdminSettings throws "Cannot coerce the result to a single JSON
// object". This script idempotently provisions that org so the dashboard resolves it.

function loadDotenvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

loadDotenvLocal();

const orgId = process.env.DEFAULT_ORG_ID;
const name = process.env.DEFAULT_ORG_NAME || "Odim";
const tier = process.env.DEFAULT_ORG_TIER || "enterprise";

if (!orgId) throw new Error("DEFAULT_ORG_ID is required");
if (!isUuid(orgId)) throw new Error(`DEFAULT_ORG_ID must be a UUID, got: ${orgId}`);
if (!hasSupabaseWriteEnv()) {
  throw new Error("Supabase service environment (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) is required");
}

const client = createServiceSupabaseClient();
const { error } = await client.from("orgs").upsert({ id: orgId, name, tier }, { onConflict: "id" });
if (error) throw new Error(`default org seed failed: ${error.message}`);

console.log(JSON.stringify({ result: "seeded", orgId, name, tier }));

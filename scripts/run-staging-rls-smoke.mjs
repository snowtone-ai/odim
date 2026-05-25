import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"|"$/g, "");
  }
}

loadDotEnv(".env.local");
loadDotEnv(".env");

const databaseUrl = process.env.SUPABASE_STAGING_DATABASE_URL;
const smokeSql = "supabase/tests/rls-cross-org-smoke.sql";

if (!databaseUrl) {
  throw new Error("SUPABASE_STAGING_DATABASE_URL is required to run the staging RLS smoke test");
}

if (!existsSync(smokeSql)) {
  throw new Error(`${smokeSql} is missing`);
}

const result = spawnSync(
  "psql",
  ["-X", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-F", "|", databaseUrl, "-f", smokeSql],
  {
    encoding: "utf8",
    windowsHide: true
  }
);

if (result.error) {
  throw new Error(`Failed to start psql. Install PostgreSQL client tools first. ${result.error.message}`);
}

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.stdout.write(result.stdout);
  throw new Error(`staging RLS smoke SQL failed with exit code ${result.status}`);
}

const rows = result.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
const countsLine = rows.findLast((line) => /^\d+\|\d+\|\d+\|\d+\|\d+(\|\d+\|\d+)?$/.test(line));

if (!countsLine) {
  process.stdout.write(result.stdout);
  throw new Error("staging RLS smoke SQL did not return the expected five-count result row");
}

const [rawSignals, alerts, apiKeys, auditLog, muninMemory, muninOpinions = 0, huginnEvalLog = 0] = countsLine.split("|").map(Number);
const failures = [
  ["cross_org_raw_signals", rawSignals],
  ["cross_org_alerts", alerts],
  ["cross_org_api_keys", apiKeys],
  ["cross_org_audit_log", auditLog],
  ["cross_org_munin_memory", muninMemory],
  ["cross_org_munin_opinions", muninOpinions],
  ["cross_org_huginn_eval_log", huginnEvalLog]
].filter(([, count]) => count !== 0);

if (failures.length) {
  throw new Error(`staging RLS smoke failed: ${failures.map(([name, count]) => `${name}=${count}`).join(", ")}`);
}

console.log(
  JSON.stringify({
    cross_org_raw_signals: rawSignals,
    cross_org_alerts: alerts,
    cross_org_api_keys: apiKeys,
    cross_org_audit_log: auditLog,
    cross_org_munin_memory: muninMemory,
    cross_org_munin_opinions: muninOpinions,
    cross_org_huginn_eval_log: huginnEvalLog,
    result: "pass"
  })
);

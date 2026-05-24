import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("release audit codifies core Phase F launch-readiness controls", () => {
  const audit = readFileSync("scripts/release-audit.mjs", "utf8");
  for (const marker of [
    "All 7 Reality Layers configured",
    "Tenant isolation RLS policy exists",
    "Huginn requires org scope",
    "English/Japanese messages configured",
    "Signal Alerts mobile layout",
    "AI retry handles Gemini rate limiting",
    "Gemini Flash free-tier RPM/RPD/TPM guard exists per org",
    "API keys are HMAC-hashed with required pepper, redacted, and timing-safe",
    "API routes can require scoped API key auth and fail closed in production",
    "API key verification rate limits repeated invalid attempts",
    "API auth forbidden responses do not disclose required scope names",
    "Production Supabase schema/read/write errors do not fall back to demo data",
    "Commercial admin table exists",
    "Commercial-readiness audit matrix exists",
    "Staging RLS smoke script checks cross-org SELECT returns 0 rows",
    "Staging RLS smoke is executable as a release command and fails on SQL/runtime errors",
    "Commercial readiness records where to paste staging RLS evidence",
    "Commercial readiness requires infrastructure-level auth rate limiting"
  ]) {
    assert.match(audit, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

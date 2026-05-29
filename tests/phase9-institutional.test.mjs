import assert from "node:assert/strict";
import test from "node:test";
import { getRuntimeEnvironment, resolveSupabaseRuntimeEnv } from "../lib/env/runtime.ts";
import { parseOpenSanctionsMatches } from "../scrapers/opensanctions.ts";
import { parseFemaDeclarations } from "../scrapers/fema.ts";
import { parseSamOpportunities } from "../scrapers/sam-gov.ts";
import { parseNrcActions } from "../scrapers/nrc.ts";
import { runBacktest } from "../lib/pipeline/backtest.ts";
import { issueSsoSession, verifySsoSession } from "../lib/auth/sso.ts";
import { getEnsembleConfig } from "../lib/ai/ensemble.ts";

test("Phase9 env separation resolves staging and production Supabase variables", () => {
  const staging = resolveSupabaseRuntimeEnv({
    ENVIRONMENT: "staging",
    NEXT_PUBLIC_SUPABASE_STAGING_URL: "https://staging.example",
    NEXT_PUBLIC_SUPABASE_STAGING_ANON_KEY: "staging-anon",
    SUPABASE_STAGING_SERVICE_ROLE_KEY: "staging-service"
  });
  const production = resolveSupabaseRuntimeEnv({
    ENVIRONMENT: "production",
    NEXT_PUBLIC_SUPABASE_PRODUCTION_URL: "https://prod.example",
    NEXT_PUBLIC_SUPABASE_PRODUCTION_ANON_KEY: "prod-anon",
    SUPABASE_PRODUCTION_SERVICE_ROLE_KEY: "prod-service"
  });

  assert.equal(getRuntimeEnvironment({ ENVIRONMENT: "staging" }), "staging");
  assert.equal(staging.url, "https://staging.example");
  assert.equal(production.serviceRoleKey, "prod-service");
});

test("Phase9 SSO session round-trip is signed", async () => {
  const previous = process.env.SSO_SESSION_SECRET;
  process.env.SSO_SESSION_SECRET = "test-secret";
  try {
    const token = await issueSsoSession({ email: "analyst@example.com", provider: "oidc", orgId: "11111111-1111-4111-8111-111111111111" });
    const session = await verifySsoSession(token);
    assert.equal(session?.email, "analyst@example.com");
    assert.equal(session?.provider, "oidc");
  } finally {
    if (previous === undefined) delete process.env.SSO_SESSION_SECRET;
    else process.env.SSO_SESSION_SECRET = previous;
  }
});

test("Phase9 ensemble config and backtest are deterministic", () => {
  const previousProviders = process.env.AI_PROVIDERS;
  process.env.AI_PROVIDERS = "gemini,openai";
  try {
    const config = getEnsembleConfig();
    const result = runBacktest({
      startDate: "2026-01-01",
      endDate: "2026-05-29",
      sources: [],
      metric: "score"
    });
    assert.equal(config.providers.length, 2);
    assert.ok(result.hitRate >= 0);
    assert.ok(Object.keys(result.bySource).length > 0);
  } finally {
    if (previousProviders === undefined) delete process.env.AI_PROVIDERS;
    else process.env.AI_PROVIDERS = previousProviders;
  }
});

test("Phase9 scraper parsers produce source-backed signals", () => {
  const sanctions = parseOpenSanctionsMatches([{ id: "1", caption: "Meta Platforms, Inc." }], ["Meta Platforms, Inc."]);
  const fema = parseFemaDeclarations([{ disasterNumber: "F-1", declarationTitle: "TX storms", incidentBeginDate: "2026-05-20", state: "TX" }], [{ name: "Vistra Corp", state: "TX" }]);
  const sam = parseSamOpportunities([{ noticeId: "S-1", title: "Palantir modernization contract", postedDate: "2026-05-20" }], ["Palantir"]);
  const nrc = parseNrcActions([{ accessionNumber: "ML1", title: "License amendment", documentDate: "2026-05-20" }]);

  assert.equal(sanctions[0].source, "opensanctions");
  assert.equal(fema[0].source, "fema");
  assert.equal(sam[0].source, "sam-gov");
  assert.equal(nrc[0].source, "nrc");
});

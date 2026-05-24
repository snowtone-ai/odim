import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAiRateLimitAvailable,
  estimateTokens,
  resetAiRateLimitUsage,
  resolveAiRateLimits
} from "../lib/ai/rate-limit.ts";

test("AI rate limit defaults stay inside Gemini Flash free tier", () => {
  const limits = resolveAiRateLimits("gemini-2.5-flash", {
    AI_MAX_RPM: "1000",
    AI_MAX_RPD: "1000",
    AI_MAX_TPM: "1000000",
    AI_RATE_LIMIT_TIER: "free"
  });

  assert.deepEqual(limits, { rpm: 10, rpd: 250, tpm: 250000 });
  assert.equal(estimateTokens("12345678"), 2);
});

test("AI rate limiter fails before exceeding request caps", () => {
  resetAiRateLimitUsage();
  const env = { AI_MAX_RPM: "2", AI_MAX_RPD: "5", AI_MAX_TPM: "100", AI_RATE_LIMIT_TIER: "free" };
  const now = new Date("2026-05-24T00:00:00.000Z");

  assert.doesNotThrow(() => assertAiRateLimitAvailable({ model: "gemini-2.5-flash", estimatedTokens: 10, now, env }));
  assert.doesNotThrow(() => assertAiRateLimitAvailable({ model: "gemini-2.5-flash", estimatedTokens: 10, now, env }));
  assert.throws(
    () => assertAiRateLimitAvailable({ model: "gemini-2.5-flash", estimatedTokens: 10, now, env }),
    /RPM limit reached/
  );

  resetAiRateLimitUsage();
});

test("AI rate limiter isolates usage by org and model", () => {
  resetAiRateLimitUsage();
  const env = { AI_MAX_RPM: "1", AI_MAX_RPD: "5", AI_MAX_TPM: "100", AI_RATE_LIMIT_TIER: "free" };
  const now = new Date("2026-05-24T00:00:00.000Z");

  assert.doesNotThrow(() =>
    assertAiRateLimitAvailable({ model: "gemini-2.5-flash", orgId: "org-a", estimatedTokens: 10, now, env })
  );
  assert.doesNotThrow(() =>
    assertAiRateLimitAvailable({ model: "gemini-2.5-flash", orgId: "org-b", estimatedTokens: 10, now, env })
  );
  assert.throws(
    () => assertAiRateLimitAvailable({ model: "gemini-2.5-flash", orgId: "org-a", estimatedTokens: 10, now, env }),
    /RPM limit reached/
  );

  resetAiRateLimitUsage();
});

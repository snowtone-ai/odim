import assert from "node:assert/strict";
import test from "node:test";
import { resetRequestRateLimit } from "../lib/api/rate-limit.ts";
import { issueApiKey, toApiKeyRow } from "../lib/auth/api-keys.ts";
import { resetApiAuthRateLimit } from "../lib/auth/request.ts";
import { POST } from "../app/api/huginn/route.ts";

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";

function jsonRequest(body, headers = {}) {
  return new Request("https://odim.local/api/huginn", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}

function snapshotEnv() {
  return {
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_API_KEY: process.env.AI_API_KEY,
    API_KEY_PEPPER: process.env.API_KEY_PEPPER,
    AUTH_REQUIRED: process.env.AUTH_REQUIRED,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("Huginn route rejects missing question", async () => {
  resetRequestRateLimit();
  const previous = snapshotEnv();
  process.env.AUTH_REQUIRED = "false";
  try {
    const response = await POST(jsonRequest({ orgId: orgA }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "question is required" });
  } finally {
    restoreEnv(previous);
  }
});

test("Huginn route rejects oversized question", async () => {
  resetRequestRateLimit();
  const previous = snapshotEnv();
  process.env.AUTH_REQUIRED = "false";
  try {
    const response = await POST(jsonRequest({ orgId: orgA, question: "x".repeat(2001) }));
    assert.equal(response.status, 400);
  } finally {
    restoreEnv(previous);
  }
});

test("Huginn route returns answer shape for valid local request", async () => {
  resetRequestRateLimit();
  const previous = snapshotEnv();
  process.env.AUTH_REQUIRED = "false";
  process.env.AI_PROVIDER = "mock";
  try {
    const response = await POST(jsonRequest({ orgId: orgA, question: "Which alerts matter?" }));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.orgId, orgA);
    assert.equal(typeof payload.answer, "string");
    assert.ok(Array.isArray(payload.sources));
  } finally {
    restoreEnv(previous);
  }
});

test("Huginn route rejects authenticated orgId override", async () => {
  resetRequestRateLimit();
  resetApiAuthRateLimit();
  const previous = snapshotEnv();
  const previousFetch = globalThis.fetch;
  process.env.AUTH_REQUIRED = "true";
  process.env.API_KEY_PEPPER = "test-pepper";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const issued = issueApiKey({
    orgId: orgA,
    name: "Huginn route key",
    scopes: ["huginn:query"],
    now: new Date("2026-05-24T00:00:00.000Z"),
    tokenBytes: Buffer.alloc(24, 13)
  });
  globalThis.fetch = async () =>
    new Response(JSON.stringify([toApiKeyRow(issued.record)]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });

  try {
    const response = await POST(jsonRequest(
      { orgId: orgB, question: "Which alerts matter?" },
      { authorization: `Bearer ${issued.token}` }
    ));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "orgId override is not allowed" });
  } finally {
    restoreEnv(previous);
    globalThis.fetch = previousFetch;
    resetApiAuthRateLimit();
  }
});

test("Huginn route returns JSON 500 on provider error", async () => {
  resetRequestRateLimit();
  const previous = snapshotEnv();
  process.env.AUTH_REQUIRED = "false";
  process.env.AI_PROVIDER = "gemini";
  delete process.env.AI_API_KEY;
  try {
    const response = await POST(jsonRequest({ orgId: orgA, question: "Which alerts matter?" }));
    const payload = await response.json();
    assert.equal(response.status, 500);
    assert.match(payload.error, /AI_API_KEY/);
  } finally {
    restoreEnv(previous);
  }
});

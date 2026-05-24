import assert from "node:assert/strict";
import test from "node:test";
import { answerHuginnQuestion } from "../lib/huginn/query.ts";
import { buildFixtureMemories, searchMuninMemory } from "../lib/munin/memory.ts";

function withoutSupabaseEnv(run) {
  const snapshot = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("Munin search only returns memories scoped to the requested org", () => {
  const results = searchMuninMemory({
    orgId: "demo-org",
    question: "What does Laidley LLC imply for Meta power and water commitments?",
    memories: buildFixtureMemories("demo-org")
  });

  assert.ok(results.length >= 1);
  assert.ok(results.every((memory) => memory.orgId === "demo-org"));
  assert.ok(results.every((memory) => !memory.content.includes("Other org confidential")));
});

test("Huginn query builds source-backed reasoning trace without leaking other org memory", async () => {
  await withoutSupabaseEnv(async () => {
    let capturedContext = "";
    const response = await answerHuginnQuestion({
      orgId: "demo-org",
      userId: "analyst-1",
      question: "Which entities are committing capital before narrative confirmation?",
      memories: buildFixtureMemories("demo-org"),
      generate: async (request) => {
        capturedContext = request.context;
        return {
          answer: "Reality evidence indicates a source-backed capital fixation cluster; confidence remains probabilistic.",
          model: "test-model",
          confidence: 0.8,
          sources: ["test-generator"]
        };
      }
    });

    assert.equal(response.orgId, "demo-org");
    assert.equal(response.context.source, "fallback");
    assert.ok(response.context.entities > 0);
    assert.ok(response.context.auditEvents > 0);
    assert.ok(response.reasoningTrace.some((step) => step.step === "memory"));
    assert.ok(response.reasoningTrace.some((step) => step.step === "recall"));
    assert.ok(response.sources.includes("fixture:munin"));
    assert.ok(response.sources.includes("ferc-elibrary"));
    assert.equal(response.munin.recallDraft.orgId, "demo-org");
    assert.equal(response.munin.recallDraft.agentScope, "recall");
    assert.equal(response.munin.persisted, false);
    assert.match(capturedContext, /Narrative is a trigger, not truth/);
    assert.doesNotMatch(capturedContext, /Other org confidential/);
    assert.ok(response.munin.retrieved.every((memory) => !memory.content.includes("Other org confidential")));
  });
});

test("Huginn prepares recall draft when Supabase schema is not applied", async () => {
  const previous = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    REPOSITORY_SUPABASE_STRICT: process.env.REPOSITORY_SUPABASE_STRICT,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.REPOSITORY_SUPABASE_STRICT = "false";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Could not find the table 'public.munin_memory' in the schema cache" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });

  try {
    const response = await answerHuginnQuestion({
      orgId: "demo-org",
      question: "Which source-backed alerts matter?",
      generate: async () => ({
        answer: "Fallback source-backed context is available.",
        model: "test-model",
        confidence: 0.7,
        sources: ["test-generator"]
      })
    });

    assert.equal(response.context.source, "fallback");
    assert.equal(response.munin.persisted, false);
    assert.ok(response.reasoningTrace.some((step) => step.summary.includes("Prepared org-scoped Munin recall memory draft")));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = previousFetch;
  }
});

test("Huginn does not hide Supabase write schema errors in production", async () => {
  const previous = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    REPOSITORY_SUPABASE_STRICT: process.env.REPOSITORY_SUPABASE_STRICT,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ODIM_RUNTIME_ENV: process.env.ODIM_RUNTIME_ENV
  };
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.REPOSITORY_SUPABASE_STRICT = "false";
  process.env.ODIM_RUNTIME_ENV = "production";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Could not find the table 'public.munin_memory' in the schema cache" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });

  try {
    await assert.rejects(
      () =>
        answerHuginnQuestion({
          orgId: "demo-org",
          question: "Which source-backed alerts matter?",
          generate: async () => ({
            answer: "Fallback source-backed context is not acceptable in production.",
            model: "test-model",
            confidence: 0.7,
            sources: ["test-generator"]
          })
        }),
      /read failed|Munin recall write failed/
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = previousFetch;
  }
});

test("Huginn rejects missing org scope", async () => {
  await assert.rejects(
    () =>
      answerHuginnQuestion({
        orgId: "",
        question: "Should fail before any provider call"
      }),
    /orgId is required/
  );
});

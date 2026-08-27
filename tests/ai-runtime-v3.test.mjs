import assert from "node:assert/strict";
import test from "node:test";
import {
  AiProviderError,
  CircuitBreakerRegistry,
  InFlightLimiter,
  TtlSingleflightCache,
  buildRuntimeCacheKey,
  clearCircuitBreakers,
  clearRuntimeCache,
  createAiRuntime,
  graderSpec,
  hashContext,
  plannerSpec
} from "../lib/ai/runtime/index.ts";
import { ensembleGenerateWithConfig, getEnsembleConfig } from "../lib/ai/ensemble.ts";

function response(answer, model = "test-model", provider = "mock") {
  return { answer, model, confidence: 0.8, sources: [`${provider}:test`], provider };
}

function fakeAdapter(name, implementation, structuredImplementation) {
  return {
    name,
    model: `${name}-test-model`,
    generate: implementation,
    generateStructured: structuredImplementation
  };
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, timeoutMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("condition was not reached before test timeout");
    await sleep(1);
  }
}

test("runtime cache key hashes prompt material and singleflight runs one provider call", async () => {
  clearRuntimeCache();
  const cache = new TtlSingleflightCache();
  let calls = 0;
  const runtime = createAiRuntime({
    cache,
    adapters: {
      mock: fakeAdapter("mock", async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return response("deterministic answer", "mock-model", "mock");
      })
    }
  });
  const request = { orgId: "org-a", question: "private question", context: "private context" };
  const [first, second] = await Promise.all([
    runtime.generate(request, "mock"),
    runtime.generate(request, "mock")
  ]);
  const third = await runtime.generate(request, "mock");

  assert.equal(calls, 1);
  assert.equal(first.answer, "deterministic answer");
  assert.equal(second.cacheHit, true);
  assert.equal(third.cacheHit, true);
  const key = buildRuntimeCacheKey({ ...request, provider: "mock", model: "mock-model", schemaVersion: "answer-v3" });
  assert.doesNotMatch(key, /private question|private context/);
  assert.match(key, /[a-f0-9]{64}$/);
});

test("singleflight shared work survives a short first caller timeout", async () => {
  const cache = new TtlSingleflightCache();
  let calls = 0;
  const runtime = createAiRuntime({
    cache,
    adapters: {
      mock: fakeAdapter("mock", async (_request, { signal }) => {
        calls += 1;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 35);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("shared work was aborted"));
          }, { once: true });
        });
        return response("shared answer");
      })
    }
  });
  const request = { orgId: "org-a", question: "shared", context: "context" };
  const first = runtime.generate(request, "mock", { timeoutMs: 10, cacheTtlMs: 1_000 });
  await sleep(2);
  const second = runtime.generate(request, "mock", { timeoutMs: 200, cacheTtlMs: 1_000 });

  await assert.rejects(first, (error) => error instanceof AiProviderError && error.kind === "timeout");
  const result = await second;
  assert.equal(result.answer, "shared answer");
  assert.equal(calls, 1);

  const abortController = new AbortController();
  const abortRequest = { orgId: "org-a", question: "shared-abort", context: "context" };
  const aborted = runtime.generate(abortRequest, "mock", { signal: abortController.signal, timeoutMs: 200, cacheTtlMs: 1_000 });
  await sleep(2);
  const surviving = runtime.generate(abortRequest, "mock", { timeoutMs: 200, cacheTtlMs: 1_000 });
  abortController.abort();
  await assert.rejects(aborted, (error) => error instanceof AiProviderError && error.kind === "aborted");
  assert.equal((await surviving).answer, "shared answer");
  assert.equal(calls, 2);
});

test("cache bounds entries, prunes expired rows, fences late writes, and preserves hash boundaries", async () => {
  const cache = new TtlSingleflightCache({ maxEntries: 2 });
  await cache.getOrCreate("one", async () => "one", 25);
  await cache.getOrCreate("two", async () => "two", 25);
  await cache.getOrCreate("three", async () => "three", 25);
  assert.equal(cache.size(), 2);
  await sleep(35);
  assert.equal(cache.size(), 0);

  const pending = cache.getOrCreate("late", async () => {
    await sleep(20);
    return "late";
  }, 1_000);
  cache.clear();
  await pending;
  assert.equal(cache.size(), 0);

  assert.notEqual(hashContext("a", "\n\nb"), hashContext("a\n\n", "b"));
});

test("empty injected provider output is typed and never cached", async () => {
  let calls = 0;
  const cache = new TtlSingleflightCache();
  const runtime = createAiRuntime({
    cache,
    adapters: {
      mock: fakeAdapter("mock", async () => {
        calls += 1;
        return response("   ");
      })
    }
  });
  const request = { orgId: "org-a", question: "empty", context: "context" };
  for (let index = 0; index < 2; index += 1) {
    await assert.rejects(
      () => runtime.generate(request, "mock", { cacheTtlMs: 1_000 }),
      (error) => error instanceof AiProviderError && error.kind === "parse"
    );
  }
  assert.equal(calls, 2);
  assert.equal(cache.size(), 0);
});

test("runtime enforces native structured schema semantics and rejects prose-wrapped JSON", async () => {
  const runtime = createAiRuntime({
    cache: new TtlSingleflightCache(),
    adapters: {
      openai: fakeAdapter(
        "openai",
        async () => response("answer", "openai-test-model", "openai"),
        async () => ({
          text: `prefix ${JSON.stringify({
            need_retrieval: true,
            source_plan: ["munin"],
            needs_reality_gapfill: false,
            needs_narrative_capture: false,
            confidence_without_retrieval: 0.5,
            uses_past_opinion: false
          })}`,
          model: "openai-test-model"
        })
      )
    }
  });

  await assert.rejects(
    () => runtime.generateStructured({ orgId: "org-a", question: "q", context: "c" }, "openai", plannerSpec, { cacheTtlMs: 0 }),
    (error) => error instanceof AiProviderError && error.kind === "parse"
  );
  assert.equal(plannerSpec.validate({
    need_retrieval: true,
    source_plan: ["munin"],
    needs_reality_gapfill: false,
    needs_narrative_capture: false,
    confidence_without_retrieval: 0.5,
    uses_past_opinion: false,
    injected: true
  }), null);
  assert.equal(graderSpec.validate({ rubric_scores: [0.8], overall_score: 0.8, flags: [] }), null);
});

test("Gemini adapter sends JSON Schema response configuration", async () => {
  const snapshot = { AI_API_KEY: process.env.AI_API_KEY, AI_MODEL: process.env.AI_MODEL, AI_RETRY_ATTEMPTS: process.env.AI_RETRY_ATTEMPTS };
  const previousFetch = globalThis.fetch;
  process.env.AI_API_KEY = "test-key";
  process.env.AI_MODEL = "gemini-test";
  process.env.AI_RETRY_ATTEMPTS = "1";
  let capturedBody;
  let capturedUrl;
  let capturedHeaders;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedHeaders = init.headers;
    capturedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      need_retrieval: true,
      source_plan: ["munin"],
      needs_reality_gapfill: false,
      needs_narrative_capture: false,
      confidence_without_retrieval: 0.5,
      uses_past_opinion: false
    }) }] } }] }), { status: 200 });
  };
  try {
    const runtime = createAiRuntime({ cache: new TtlSingleflightCache() });
    const result = await runtime.generateStructured({ orgId: "org-a", question: "q", context: "c" }, "gemini", plannerSpec, { cacheTtlMs: 0 });
    assert.equal(result.value.need_retrieval, true);
    assert.doesNotMatch(capturedUrl, /[?&]key=/);
    assert.equal(capturedHeaders["x-goog-api-key"], "test-key");
    assert.equal(capturedBody.generationConfig.responseMimeType, "application/json");
    assert.deepEqual(capturedBody.generationConfig.responseJsonSchema, plannerSpec.jsonSchema);
  } finally {
    restoreEnv(snapshot);
    globalThis.fetch = previousFetch;
  }
});

test("Gemini adapter retries 429 responses using AI_RETRY_ATTEMPTS", async () => {
  const snapshot = { AI_API_KEY: process.env.AI_API_KEY, AI_MODEL: process.env.AI_MODEL, AI_RETRY_ATTEMPTS: process.env.AI_RETRY_ATTEMPTS };
  const previousFetch = globalThis.fetch;
  process.env.AI_API_KEY = "test-key";
  delete process.env.AI_MODEL;
  process.env.AI_RETRY_ATTEMPTS = "2";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response("rate limited", { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "retried answer" }] } }] }), { status: 200 });
  };
  try {
    const runtime = createAiRuntime({ cache: new TtlSingleflightCache() });
    const result = await runtime.generate({ orgId: "org-a", question: "retry", context: "c" }, "gemini", { cacheTtlMs: 0 });
    assert.equal(calls, 2);
    assert.equal(result.answer, "retried answer");
    assert.equal(result.model, "gemini-2.5-flash");
  } finally {
    restoreEnv(snapshot);
    globalThis.fetch = previousFetch;
  }
});

test("OpenAI Responses adapter sends the native structured text.format contract", async () => {
  const snapshot = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    AI_RETRY_ATTEMPTS: process.env.AI_RETRY_ATTEMPTS
  };
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_MODEL = "openai-test";
  process.env.OPENAI_BASE_URL = "https://openai.test/v1/responses";
  process.env.AI_RETRY_ATTEMPTS = "1";
  let capturedUrl;
  let capturedHeaders;
  let capturedBody;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedHeaders = init.headers;
    capturedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      status: "completed",
      output_text: JSON.stringify({
        need_retrieval: true,
        source_plan: ["munin"],
        needs_reality_gapfill: false,
        needs_narrative_capture: false,
        confidence_without_retrieval: 0.5,
        uses_past_opinion: false
      })
    }), { status: 200 });
  };
  try {
    const runtime = createAiRuntime({ cache: new TtlSingleflightCache() });
    const result = await runtime.generateStructured(
      { orgId: "org-a", question: "q", context: "c" },
      "openai",
      plannerSpec,
      { cacheTtlMs: 0 }
    );
    assert.equal(result.value.need_retrieval, true);
    assert.equal(capturedUrl, "https://openai.test/v1/responses");
    assert.equal(capturedHeaders.authorization, "Bearer test-openai-key");
    assert.deepEqual(capturedBody.text.format, {
      type: "json_schema",
      name: "odim_planner",
      strict: true,
      schema: plannerSpec.jsonSchema
    });
  } finally {
    restoreEnv(snapshot);
    globalThis.fetch = previousFetch;
  }
});

test("Anthropic adapter sanitizes unsupported remote schema keywords while preserving local schema", async () => {
  const snapshot = {
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
    CLAUDE_MODEL: process.env.CLAUDE_MODEL,
    CLAUDE_BASE_URL: process.env.CLAUDE_BASE_URL,
    AI_RETRY_ATTEMPTS: process.env.AI_RETRY_ATTEMPTS
  };
  const previousFetch = globalThis.fetch;
  process.env.CLAUDE_API_KEY = "test-claude-key";
  process.env.CLAUDE_MODEL = "claude-test";
  process.env.CLAUDE_BASE_URL = "https://claude.test/v1/messages";
  process.env.AI_RETRY_ATTEMPTS = "1";
  let capturedHeaders;
  let capturedBody;
  globalThis.fetch = async (_url, init) => {
    capturedHeaders = init.headers;
    capturedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({
        need_retrieval: true,
        source_plan: ["munin"],
        needs_reality_gapfill: false,
        needs_narrative_capture: false,
        confidence_without_retrieval: 0.5,
        uses_past_opinion: false
      }) }]
    }), { status: 200 });
  };
  try {
    const runtime = createAiRuntime({ cache: new TtlSingleflightCache() });
    const result = await runtime.generateStructured(
      { orgId: "org-a", question: "q", context: "c" },
      "claude",
      plannerSpec,
      { cacheTtlMs: 0 }
    );
    const remoteSchema = capturedBody.output_config.format.schema;
    assert.equal(result.value.need_retrieval, true);
    assert.equal(capturedHeaders["x-api-key"], "test-claude-key");
    assert.equal(capturedHeaders["anthropic-version"], "2023-06-01");
    assert.equal(remoteSchema.properties.source_plan.minItems, undefined);
    assert.equal(remoteSchema.properties.confidence_without_retrieval.minimum, undefined);
    assert.equal(remoteSchema.properties.confidence_without_retrieval.maximum, undefined);
    assert.equal(remoteSchema.additionalProperties, false);
    assert.equal(plannerSpec.jsonSchema.properties.source_plan.minItems, 1);
    assert.equal(plannerSpec.jsonSchema.properties.confidence_without_retrieval.minimum, 0);
  } finally {
    restoreEnv(snapshot);
    globalThis.fetch = previousFetch;
  }
});

test("native adapters reject safety, refusal, incomplete, and empty fixtures without caching", async () => {
  const snapshot = {
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
    CLAUDE_MODEL: process.env.CLAUDE_MODEL,
    AI_RETRY_ATTEMPTS: process.env.AI_RETRY_ATTEMPTS
  };
  const previousFetch = globalThis.fetch;
  process.env.AI_API_KEY = "test-gemini-key";
  process.env.AI_MODEL = "gemini-test";
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_MODEL = "openai-test";
  process.env.CLAUDE_API_KEY = "test-claude-key";
  process.env.CLAUDE_MODEL = "claude-test";
  process.env.AI_RETRY_ATTEMPTS = "1";

  const fixtures = [
    {
      provider: "gemini",
      payload: { candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }
    },
    {
      provider: "gemini",
      payload: { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "partial" }] } }] }
    },
    {
      provider: "openai",
      payload: { status: "incomplete", output_text: "partial" }
    },
    {
      provider: "openai",
      payload: {
        status: "completed",
        output_text: "should not bypass refusal",
        output: [{ type: "message", content: [{ type: "refusal", refusal: "policy" }] }]
      }
    },
    {
      provider: "claude",
      payload: { stop_reason: "refusal", content: [{ type: "text", text: "no" }] }
    },
    {
      provider: "claude",
      payload: { stop_reason: "end_turn", content: [] }
    }
  ];

  try {
    for (const fixture of fixtures) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify(fixture.payload), { status: 200 });
      };
      const runtime = createAiRuntime({ cache: new TtlSingleflightCache() });
      const request = { orgId: "org-a", question: `${fixture.provider}-fixture`, context: "context" };
      for (let index = 0; index < 2; index += 1) {
        await assert.rejects(
          () => runtime.generate(request, fixture.provider, { cacheTtlMs: 1_000 }),
          (error) => error instanceof AiProviderError && error.kind === "parse"
        );
      }
      assert.equal(calls, 2, `${fixture.provider} failure must not be cached`);
    }
  } finally {
    restoreEnv(snapshot);
    globalThis.fetch = previousFetch;
  }
});

test("shared deadline bounds a slow injected provider and preserves caller abort taxonomy", async () => {
  const runtime = createAiRuntime({ cache: new TtlSingleflightCache() , adapters: {
    mock: fakeAdapter("mock", async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return response("late");
    })
  }});
  const started = Date.now();
  await assert.rejects(
    () => runtime.generate({ question: "q", context: "c" }, "mock", { timeoutMs: 15, cacheTtlMs: 0 }),
    (error) => error instanceof AiProviderError && error.kind === "timeout"
  );
  assert.ok(Date.now() - started < 90);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => runtime.generate({ question: "q2", context: "c2" }, "mock", { signal: controller.signal, cacheTtlMs: 0 }),
    (error) => error instanceof AiProviderError && error.kind === "aborted"
  );
});

test("provider timeout bounds shared transport work independently of the caller deadline", async () => {
  let providerAborted = false;
  const runtime = createAiRuntime({
    cache: new TtlSingleflightCache(),
    adapters: {
      mock: fakeAdapter("mock", async (_request, { signal }) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          signal.addEventListener("abort", () => {
            providerAborted = true;
            clearTimeout(timer);
            reject(new Error("provider deadline reached"));
          }, { once: true });
        });
        return response("late");
      })
    }
  });
  const started = Date.now();
  await assert.rejects(
    () => runtime.generate({ question: "provider-timeout", context: "c" }, "mock", {
      timeoutMs: 500,
      providerTimeoutMs: 15,
      cacheTtlMs: 0
    }),
    (error) => error instanceof AiProviderError && error.kind === "timeout"
  );
  await waitFor(() => providerAborted);
  assert.ok(Date.now() - started < 200);
});

test("singleflight aborts shared work only after every waiter cancels", async () => {
  const cache = new TtlSingleflightCache();
  let calls = 0;
  let providerAborted = false;
  let startedResolve;
  const started = new Promise((resolve) => { startedResolve = resolve; });
  const runtime = createAiRuntime({
    cache,
    adapters: {
      mock: fakeAdapter("mock", async (_request, { signal }) => {
        calls += 1;
        startedResolve();
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          const onAbort = () => {
            providerAborted = true;
            clearTimeout(timer);
            reject(new Error("shared transport aborted"));
          };
          signal.addEventListener("abort", onAbort, { once: true });
        });
        return response("should not complete");
      })
    }
  });
  const request = { orgId: "org-a", question: "all-waiters", context: "context" };
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = runtime.generate(request, "mock", {
    signal: firstController.signal,
    timeoutMs: 200,
    cacheTtlMs: 1_000
  });
  await started;
  const second = runtime.generate(request, "mock", {
    signal: secondController.signal,
    timeoutMs: 200,
    cacheTtlMs: 1_000
  });
  await sleep(2);
  firstController.abort();
  await assert.rejects(first, (error) => error instanceof AiProviderError && error.kind === "aborted");
  assert.equal(providerAborted, false, "one surviving waiter must keep shared transport alive");
  secondController.abort();
  await assert.rejects(second, (error) => error instanceof AiProviderError && error.kind === "aborted");
  await waitFor(() => providerAborted);
  assert.equal(calls, 1);
  assert.equal(cache.size(), 0);
});

test("runtime limiter enforces global/per-org bounds and rejects a full backpressure queue", async () => {
  const limiter = new InFlightLimiter({ maxGlobal: 2, maxPerOrg: 1, maxPending: 1 });
  const gates = new Map();
  const startedQuestions = new Set();
  let active = 0;
  let maxActive = 0;
  const runtime = createAiRuntime({
    cache: new TtlSingleflightCache(),
    inFlightLimiter: limiter,
    adapters: {
      mock: fakeAdapter("mock", async (request, { signal }) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        startedQuestions.add(request.question);
        await new Promise((resolve, reject) => {
          let settled = false;
          const onAbort = () => {
            if (settled) return;
            settled = true;
            reject(new Error("transport aborted"));
          };
          signal.addEventListener("abort", onAbort, { once: true });
          gates.set(request.question, () => {
            if (settled) return;
            settled = true;
            signal.removeEventListener("abort", onAbort);
            resolve(undefined);
          });
        });
        active -= 1;
        return response(`answer-${request.question}`);
      })
    }
  });
  const makeRequest = (question, orgId) => ({ orgId, question, context: "context" });
  const first = runtime.generate(makeRequest("org-a-1", "org-a"), "mock", { timeoutMs: 500, cacheTtlMs: 0 });
  const queued = runtime.generate(makeRequest("org-a-2", "org-a"), "mock", { timeoutMs: 500, cacheTtlMs: 0 });
  const secondOrg = runtime.generate(makeRequest("org-b-1", "org-b"), "mock", { timeoutMs: 500, cacheTtlMs: 0 });
  await waitFor(() => startedQuestions.has("org-a-1") && startedQuestions.has("org-b-1"));
  await waitFor(() => limiter.getState().pending === 1);

  const full = runtime.generate(makeRequest("org-c-1", "org-c"), "mock", { timeoutMs: 500, cacheTtlMs: 0 });
  await assert.rejects(full, (error) => error instanceof AiProviderError && error.kind === "rate_limit");
  assert.equal(maxActive, 2);
  assert.equal(limiter.getState().globalInFlight, 2);
  assert.equal(limiter.getState().pending, 1);

  gates.get("org-a-1")?.();
  await first;
  await waitFor(() => startedQuestions.has("org-a-2"));
  gates.get("org-a-2")?.();
  gates.get("org-b-1")?.();
  await Promise.all([queued, secondOrg]);
  assert.deepEqual(limiter.getState().orgInFlight, new Map());
  assert.equal(limiter.getState().globalInFlight, 0);
  assert.equal(limiter.getState().pending, 0);
});

test("circuit breaker opens after transient failures and allows no extra provider call", async () => {
  let calls = 0;
  const breaker = new CircuitBreakerRegistry({ failureThreshold: 2, resetMs: 10_000 });
  const runtime = createAiRuntime({ cache: new TtlSingleflightCache(), circuitBreakers: breaker, adapters: {
    mock: fakeAdapter("mock", async () => {
      calls += 1;
      throw new AiProviderError({ kind: "server", provider: "mock", message: "upstream unavailable" });
    })
  }});
  for (let index = 0; index < 2; index += 1) {
    await assert.rejects(() => runtime.generate({ question: `q-${index}`, context: "c" }, "mock", { cacheTtlMs: 0 }), /upstream unavailable/);
  }
  await assert.rejects(
    () => runtime.generate({ question: "q-3", context: "c" }, "mock", { cacheTtlMs: 0 }),
    (error) => error instanceof AiProviderError && error.kind === "circuit_open"
  );
  assert.equal(calls, 2);
  clearCircuitBreakers();
});

test("ensemble keeps partial success, applies configured weights, and marks fallback metadata", async () => {
  const runtime = createAiRuntime({ cache: new TtlSingleflightCache(), adapters: {
    gemini: fakeAdapter("gemini", async () => response("low-weight answer", "g-model", "gemini")),
    openai: fakeAdapter("openai", async () => response("high-weight answer", "o-model", "openai")),
    claude: fakeAdapter("claude", async () => {
      throw new AiProviderError({ kind: "server", provider: "claude", message: "claude down" });
    })
  }});
  const config = {
    strategy: "fan-out-consensus",
    providers: [
      { name: "gemini", weight: 0.1, timeout: 100, fallback: false },
      { name: "openai", weight: 1, timeout: 100, fallback: true },
      { name: "claude", weight: 1, timeout: 100, fallback: true }
    ]
  };
  const result = await ensembleGenerateWithConfig({ orgId: "org-a", question: "q", context: "c" }, config, { runtime, timeoutMs: 300 });
  assert.equal(result.answer, "high-weight answer");
  assert.deepEqual(result.contributors, ["gemini", "openai"]);
  assert.equal(result.degraded, true);
  assert.equal(result.fallback, true);
  assert.equal(result.fallbackReason, "partial_provider_failure");

  const fallbackRuntime = createAiRuntime({ cache: new TtlSingleflightCache(), adapters: {
    gemini: fakeAdapter("gemini", async () => {
      throw new AiProviderError({ kind: "timeout", provider: "gemini", message: "gemini timed out" });
    }),
    openai: fakeAdapter("openai", async () => response("fallback answer", "o-model", "openai"))
  }});
  const fallback = await ensembleGenerateWithConfig({ orgId: "org-a", question: "fallback", context: "c" }, {
    strategy: "primary-fallback",
    providers: [
      { name: "gemini", weight: 1, timeout: 100, fallback: false },
      { name: "openai", weight: 0.5, timeout: 100, fallback: true }
    ]
  }, { runtime: fallbackRuntime, timeoutMs: 300 });
  assert.equal(fallback.answer, "fallback answer");
  assert.equal(fallback.degraded, true);
  assert.equal(fallback.fallbackReason, "gemini:timeout");
});

test("ensemble fails closed for invalid configuration and honors an explicit single provider", async () => {
  const snapshot = {
    AI_PROVIDERS: process.env.AI_PROVIDERS,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_PROVIDER_WEIGHTS: process.env.AI_PROVIDER_WEIGHTS,
    AI_PROVIDER_TIMEOUT_MS: process.env.AI_PROVIDER_TIMEOUT_MS,
    AI_ENSEMBLE_STRATEGY: process.env.AI_ENSEMBLE_STRATEGY
  };
  const runtime = createAiRuntime({
    cache: new TtlSingleflightCache(),
    adapters: {
      openai: fakeAdapter("openai", async () => response("single openai answer", "openai-model", "openai"))
    }
  });
  try {
    process.env.AI_PROVIDERS = "openai,unknown";
    assert.throws(
      () => getEnsembleConfig(),
      (error) => error instanceof AiProviderError && error.kind === "invalid_request"
    );

    const result = await ensembleGenerateWithConfig({ orgId: "org-a", question: "single", context: "c" }, {
      strategy: "fan-out-consensus",
      providers: [{ name: "openai", weight: 1, timeout: 100, fallback: false }]
    }, { runtime, timeoutMs: 300 });
    assert.equal(result.answer, "single openai answer");
    assert.deepEqual(result.contributors, ["openai"]);
    assert.equal(result.provider, "openai");

    await assert.rejects(
      () => ensembleGenerateWithConfig({ question: "q", context: "c" }, {
        strategy: "primary-fallback",
        providers: [{ name: "openai", weight: 1, timeout: 100 }, { name: "openai", weight: 1, timeout: 100 }]
      }),
      (error) => error instanceof AiProviderError && error.kind === "invalid_request"
    );
  } finally {
    restoreEnv(snapshot);
  }
});

test("ensemble does not return a partial fast result after caller abort", async () => {
  const controller = new AbortController();
  const runtime = createAiRuntime({
    cache: new TtlSingleflightCache(),
    adapters: {
      gemini: fakeAdapter("gemini", async () => response("fast", "gemini-model", "gemini")),
      openai: fakeAdapter("openai", async (_request, { signal }) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("slow transport aborted"));
          }, { once: true });
        });
        return response("slow", "openai-model", "openai");
      })
    }
  });
  const pending = ensembleGenerateWithConfig({ orgId: "org-a", question: "abort-fanout", context: "c" }, {
    strategy: "fan-out-consensus",
    providers: [
      { name: "gemini", weight: 1, timeout: 300, fallback: false },
      { name: "openai", weight: 1, timeout: 300, fallback: true }
    ]
  }, { runtime, signal: controller.signal, timeoutMs: 500 });
  await sleep(5);
  controller.abort();
  await assert.rejects(
    pending,
    (error) => error instanceof AiProviderError && error.kind === "aborted"
  );
});

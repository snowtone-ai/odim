import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { reciprocalRankFuse } from "../lib/huginn/cascade.ts";
import { logHuginnEval } from "../lib/huginn/eval-log.ts";
import { writeSycophancyAuditEvent } from "../lib/huginn/grader.ts";
import { buildClaimCitationLedger } from "../lib/huginn/orchestrator/citations.ts";
import { answerHuginnQuestion } from "../lib/huginn/query.ts";
import { buildFixtureMemories } from "../lib/munin/memory.ts";

const envKeys = [
  "AI_PROVIDER",
  "HUGINN_TELEMETRY_LOG",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "ODIM_RUNTIME_ENV",
  "SLEEP_COMPUTE_ENABLED",
  "SUPABASE_SERVICE_ROLE_KEY"
];

async function withEnv(values, run) {
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  try {
    for (const key of envKeys) {
      if (Object.hasOwn(values, key)) {
        if (values[key] === undefined) delete process.env[key];
        else process.env[key] = values[key];
      }
    }
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function evidence(id, content, sourceId = "fixture:source") {
  return {
    id,
    layer: "odim_cache",
    sourceType: "primary_filing",
    content,
    confidence: 0.9,
    sourceRefs: [{ sourceId, title: sourceId, url: `odim://${sourceId}`, observedAt: "2026-01-01T00:00:00.000Z" }]
  };
}

function citedAnswer() {
  return {
    answer: "Laidley LLC water request requires review before official announcement.",
    model: "test-model",
    confidence: 0.8,
    sources: ["fixture:munin"]
  };
}

const cleanGrade = async () => ({ score: 0.9, flags: [] });

test("RRF rewards evidence corroborated across retrieval layers", () => {
  const first = evidence("first", "first independent source");
  const shared = evidence("shared", "corroborated water request");
  const third = evidence("third", "third independent source");
  const fused = reciprocalRankFuse([
    { layer: "munin_core", evidence: [first, shared] },
    { layer: "odim_cache", evidence: [shared, third] }
  ]);

  assert.equal(fused[0].id, "shared");
  assert.deepEqual(new Set(fused.map((item) => item.id)), new Set(["first", "shared", "third"]));
});

test("claim ledger rejects a one-word generic false positive and accepts corroborated lexical support", () => {
  const falsePositive = buildClaimCitationLedger({
    answer: "The evidence supports a commitment conclusion.",
    evidence: [evidence("generic", "Evidence from a separate source describes unrelated maintenance.")],
    asOf: "2026-08-01T00:00:00.000Z"
  });
  assert.equal(falsePositive.grounding.status, "insufficient");
  assert.equal(falsePositive.ledger[0].status, "uncited");

  const supported = buildClaimCitationLedger({
    answer: "Laidley LLC water request requires review before official announcement.",
    evidence: [evidence("laidley", "Laidley LLC water request should be reviewed before official announcement.", "fixture:munin")],
    asOf: "2026-08-01T00:00:00.000Z"
  });
  assert.equal(supported.grounding.status, "grounded");
  assert.deepEqual(supported.ledger[0].sourceIds, ["fixture:munin"]);

  const japaneseSupported = buildClaimCitationLedger({
    answer: "送電線増強計画の提出が確認されました。",
    evidence: [evidence("japanese-supported", "送電線増強計画を提出した記録がある。", "fixture:japanese")],
    asOf: "2026-08-01T00:00:00.000Z"
  });
  assert.equal(japaneseSupported.grounding.status, "grounded");

  const japaneseUnsupported = buildClaimCitationLedger({
    answer: "気象予報の更新が確認されました。",
    evidence: [evidence("japanese-unsupported", "送電線増強計画を提出した記録がある。", "fixture:japanese")],
    asOf: "2026-08-01T00:00:00.000Z"
  });
  assert.equal(japaneseUnsupported.grounding.status, "insufficient");
});

test("claim ledger does not cite evidence with the opposite polarity", () => {
  const cases = [
    ["approved", "rejected"],
    ["increased", "decreased"],
    ["positive", "negative"]
  ];
  for (const [claimPolarity, evidencePolarity] of cases) {
    const ledger = buildClaimCitationLedger({
      answer: `The FERC filing was ${claimPolarity} for the queue.`,
      evidence: [evidence("polarity", `The FERC filing was ${evidencePolarity} for the queue.`, `filing:${claimPolarity}`)],
      asOf: "2026-08-01T00:00:00.000Z"
    });
    assert.equal(ledger.grounding.status, "insufficient", claimPolarity);
    assert.equal(ledger.ledger[0].status, "uncited", claimPolarity);
  }

  const japanese = buildClaimCitationLedger({
    answer: "申請は承認されました。",
    evidence: [evidence("japanese-polarity", "申請は拒否されました。", "filing:japanese-polarity")],
    asOf: "2026-08-01T00:00:00.000Z"
  });
  assert.equal(japanese.grounding.status, "insufficient");
  assert.equal(japanese.ledger[0].status, "uncited");
});

test("narrative persistence stores hashes rather than raw question/content", () => {
  const source = readFileSync(new URL("../lib/huginn/narrative-capture.ts", import.meta.url), "utf8");
  assert.match(source, /contentHash/);
  assert.match(source, /questionHash/);
  assert.doesNotMatch(source, /payload:\s*\{[\s\S]*content:\s*input\.result\.content/);
  assert.match(source, /request\.abortSignal\(input\.signal\)/);
  const gapfill = readFileSync(new URL("../lib/huginn/gapfill.ts", import.meta.url), "utf8");
  assert.match(gapfill, /persistMemoryProposal\(proposal, \{ signal: input\.signal \}\)/);
  const evalLog = readFileSync(new URL("../lib/huginn/eval-log.ts", import.meta.url), "utf8");
  const grader = readFileSync(new URL("../lib/huginn/grader.ts", import.meta.url), "utf8");
  assert.match(evalLog, /request\.abortSignal\(input\.signal\)/);
  assert.match(grader, /request\.abortSignal\(input\.signal\)/);
});

test("Huginn v3 returns typed run/grounding metadata and never auto-saves active facts", async () => {
  await withEnv({ AI_PROVIDER: "mock", SLEEP_COMPUTE_ENABLED: "false" }, async () => {
    const response = await answerHuginnQuestion({
      orgId: "demo-org",
      question: "What does the Laidley LLC water request imply before official announcement?",
      memories: buildFixtureMemories("demo-org"),
      generate: async () => citedAnswer(),
      grade: cleanGrade,
      timeoutMs: 450
    });

    assert.match(response.run.id, /^huginn:/);
    assert.equal(typeof response.run.queryHash, "string");
    assert.equal(response.munin.persisted, false);
    assert.ok(["grounded", "partial", "insufficient", "stale"].includes(response.grounding.status));
    assert.ok(Array.isArray(response.citationLedger));
    assert.ok(["completed", "degraded", "abstained"].includes(response.run.status));
  });
});

test("temporal reader results cannot introduce future-valid facts", async () => {
  await withEnv({ AI_PROVIDER: "mock", SLEEP_COMPUTE_ENABLED: "false" }, async () => {
    const base = buildFixtureMemories("demo-org")[1];
    const future = {
      ...base,
      content: "FUTURE_ONLY_FACT must not be visible before its validFrom timestamp.",
      validFrom: "2099-01-01T00:00:00.000Z",
      retrievalScore: 1,
      scoreParts: { semantic: 1, recency: 1, importance: 1, linkProximity: 0 }
    };
    let capturedContext = "";
    await answerHuginnQuestion({
      orgId: "demo-org",
      question: "What source-backed water request should be reviewed?",
      memories: [],
      asOf: "2026-08-01T00:00:00.000Z",
      temporalMemoryReader: { search: async () => [future] },
      generate: async (request) => {
        capturedContext = request.context;
        return citedAnswer();
      },
      grade: cleanGrade,
      timeoutMs: 450
    });
    assert.doesNotMatch(capturedContext, /FUTURE_ONLY_FACT/);
  });
});

test("request singleflight dedupes only default-budget calls and caller abort does not poison a peer", async () => {
  await withEnv({ AI_PROVIDER: "mock", SLEEP_COMPUTE_ENABLED: "false" }, async () => {
    let dedupedCalls = 0;
    const shared = {
      orgId: "demo-org",
      question: "Which Laidley LLC water request needs review?",
      requestId: "singleflight-v3",
      memories: buildFixtureMemories("demo-org"),
      generate: async () => {
        dedupedCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return citedAnswer();
      },
      grade: cleanGrade
    };
    await Promise.all([answerHuginnQuestion(shared), answerHuginnQuestion(shared)]);
    assert.equal(dedupedCalls, 1);

    const controller = new AbortController();
    const aborted = answerHuginnQuestion({
      ...shared,
      requestId: "caller-abort-v3",
      signal: controller.signal,
      generate: async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return citedAnswer();
      }
    });
    setTimeout(() => controller.abort("caller_cancelled"), 5);
    const healthy = answerHuginnQuestion({
      ...shared,
      requestId: "caller-abort-v3",
      generate: async () => citedAnswer()
    });
    const [abortedResponse, healthyResponse] = await Promise.all([aborted, healthy]);
    assert.equal(abortedResponse.status.code, "aborted");
    assert.notEqual(healthyResponse.status.code, "aborted");
  });
});

test("audit and eval persistence redact question/answer and telemetry never prints them", async () => {
  const question = "PRIVATE_QUESTION_DO_NOT_STORE";
  const answer = "PRIVATE_ANSWER_DO_NOT_STORE";
  await withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      ODIM_RUNTIME_ENV: "local"
    },
    async () => {
      const previousFetch = globalThis.fetch;
      const requestBodies = [];
      globalThis.fetch = async (_url, init) => {
        requestBodies.push(String(init?.body ?? ""));
        return new Response("[]", { status: 201, headers: { "content-type": "application/json" } });
      };
      try {
        await writeSycophancyAuditEvent({ orgId: "demo-org", question, answer, flags: ["sycophancy_suspected"], runId: "run-safe" });
        await logHuginnEval({
          orgId: "demo-org",
          question,
          answer,
          plan: {
            need_retrieval: true,
            source_plan: ["munin"],
            needs_reality_gapfill: false,
            needs_narrative_capture: false,
            confidence_without_retrieval: 0,
            uses_past_opinion: false
          },
          retrieval_layers_used: ["munin_core"],
          sources_count: 1
        });
      } finally {
        globalThis.fetch = previousFetch;
      }
      const payload = requestBodies.join("\n");
      assert.equal(payload.includes(question), false);
      assert.equal(payload.includes(answer), false);
      assert.match(payload, /questionHash/);
      assert.match(payload, /answerHash/);
      assert.match(payload, /\[redacted\]/);
    }
  );

  await withEnv(
    { NEXT_PUBLIC_SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined, ODIM_RUNTIME_ENV: "local" },
    async () => {
      const previousInfo = console.info;
      const logged = [];
      console.info = (...args) => logged.push(args);
      try {
        await logHuginnEval({
          orgId: "demo-org",
          question,
          answer,
          plan: {
            need_retrieval: true,
            source_plan: ["munin"],
            needs_reality_gapfill: false,
            needs_narrative_capture: false,
            confidence_without_retrieval: 0,
            uses_past_opinion: false
          },
          retrieval_layers_used: [],
          sources_count: 0
        });
      } finally {
        console.info = previousInfo;
      }
      const output = JSON.stringify(logged);
      assert.equal(output.includes(question), false);
      assert.equal(output.includes(answer), false);
    }
  );

  await withEnv(
    { AI_PROVIDER: "mock", HUGINN_TELEMETRY_LOG: "true", SLEEP_COMPUTE_ENABLED: "false" },
    async () => {
      const previousInfo = console.info;
      const logged = [];
      console.info = (...args) => logged.push(args);
      try {
        await answerHuginnQuestion({
          orgId: "demo-org",
          question,
          generate: async () => ({ answer, model: "test-model", confidence: 0.8, sources: [] }),
          grade: cleanGrade,
          timeoutMs: 450
        });
      } finally {
        console.info = previousInfo;
      }
      const output = JSON.stringify(logged);
      assert.equal(output.includes(question), false);
      assert.equal(output.includes(answer), false);
      assert.match(output, /queryHash/);
      assert.match(output, /requestIdHash/);
    }
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { cascadeSearch } from "../lib/huginn/cascade.ts";
import { realityGapfillSearch } from "../lib/huginn/gapfill.ts";
import { narrativeCaptureSearch } from "../lib/huginn/narrative-capture.ts";
import { outcomesGrader } from "../lib/huginn/grader.ts";
import { assessQuery } from "../lib/huginn/self-assessment.ts";
import { createSeedMemory, deleteSeedMemory, listSeedMemories, updateSeedMemory } from "../lib/munin/seed.ts";
import { buildFixtureMemories, buildFixtureOpinions, searchMuninMemory, searchOpinions } from "../lib/munin/memory.ts";
import { writeGate } from "../lib/munin/write-gate.ts";
import { dreamJob } from "../lib/munin/dream.ts";
import { findPrecomputedAnswer, seedPrecomputedAnswer } from "../lib/huginn/precompute.ts";

test("writeGate routes v2 memory classes and structurally rejects web_narrative", () => {
  assert.equal(writeGate({ orgId: "demo-org", content: "news", sourceType: "web_narrative", memoryClass: "fact" }).action, "REJECTED_FROM_MEMORY");
  assert.equal(writeGate({ orgId: "demo-org", content: "opinion", sourceType: "huginn_inference", memoryClass: "opinion" }).table, "munin_opinions");
  assert.equal(writeGate({ orgId: "demo-org", content: "fact", sourceType: "primary_filing", memoryClass: "fact" }).status, "active");
  assert.equal(writeGate({ orgId: "demo-org", content: "weak", sourceType: "huginn_inference", memoryClass: "fact", certainty: 0.1 }).status, "archived");
  assert.equal(writeGate({ orgId: "demo-org", content: "seed", sourceType: "user_seed", memoryClass: "seed", certainty: 0.01 }).status, "active");
});

test("Munin v2 search keeps seeds, excludes opinions, archived rows, and MVCC old versions", () => {
  const memories = buildFixtureMemories("demo-org");
  const results = searchMuninMemory({ orgId: "demo-org", question: "unmatched query", memories, topK: 1 });
  assert.ok(results.some((memory) => memory.isSeed));
  assert.ok(results.every((memory) => memory.status === "active"));
  assert.ok(results.every((memory) => memory.validTo === null));
  assert.ok(results.every((memory) => memory.memoryClass !== "opinion"));
  const opinions = searchOpinions({ orgId: "demo-org", question: "prior opinion", opinions: buildFixtureOpinions("demo-org") });
  assert.ok(opinions.length >= 1);
  assert.ok(opinions.every((opinion) => opinion.orgId === "demo-org"));
});

test("Seed Memory CRUD uses write-gate routing and MVCC soft deletion in fallback mode", async () => {
  const orgId = `seed-org-${Date.now()}`;
  const fact = await createSeedMemory({ orgId, content: "Monitor AI power interconnect queues.", memoryClass: "fact" });
  const opinion = await createSeedMemory({ orgId, content: "Prefer primary filings over market commentary.", memoryClass: "opinion" });
  assert.equal(fact.kind, "memory");
  assert.equal(opinion.kind, "opinion");
  const updated = await updateSeedMemory({ id: fact.id, orgId, content: "Monitor FERC interconnect queues." });
  assert.notEqual(updated.id, fact.id);
  await deleteSeedMemory({ id: opinion.id, orgId });
  const active = await listSeedMemories(orgId);
  assert.ok(active.some((seed) => seed.id === updated.id));
  assert.ok(active.every((seed) => seed.id !== opinion.id));
});

test("self-assessment controls cascade, gapfill, narrative capture, and opinion retrieval separation", async () => {
  const plan = await assessQuery({ question: "Use past opinion and FERC filing narrative sentiment" });
  assert.equal(plan.uses_past_opinion, true);
  assert.equal(plan.needs_reality_gapfill, true);
  assert.equal(plan.needs_narrative_capture, true);
  const cascade = await cascadeSearch({
    orgId: "demo-org",
    question: "Use past opinion and FERC filing narrative sentiment",
    plan,
    memories: buildFixtureMemories("demo-org"),
    opinions: buildFixtureOpinions("demo-org")
  });
  assert.ok(cascade.layers_used.includes("opinion_search"));
  assert.ok(cascade.opinions.length >= 1);
  assert.ok(cascade.narrative.every((item) => item.sourceType === "web_narrative"));
  assert.ok(cascade.evidence.every((item) => !item.isNarrative && item.sourceType !== "web_narrative"));
});

test("reality gapfill only accepts allowed primary domains and narrative capture never enters memory", async () => {
  const gapfill = await realityGapfillSearch({
    orgId: "demo-org",
    question: "FERC filing",
    allowedDomains: ["elibrary.ferc.gov"]
  });
  assert.ok(gapfill.length >= 1);
  assert.ok(gapfill.every((item) => item.sourceType === "primary_filing"));
  const narrative = await narrativeCaptureSearch({ orgId: "demo-org", question: "market narrative" });
  assert.ok(narrative.every((item) => writeGate({ orgId: "demo-org", content: item.content, sourceType: item.sourceType, memoryClass: "fact" }).action === "REJECTED_FROM_MEMORY"));
});

test("Outcomes grader is independent of memory context and flags sycophancy in mock mode", async () => {
  const result = await outcomesGrader({ question: "Should I reverse?", answer: "I agree with you completely." });
  assert.ok(result.flags.includes("sycophancy_suspected"));
});

test("Dream excludes seeds/opinions, records MVCC supersede diff, and routes new rows through writeGate", async () => {
  const orgId = "dream-org";
  const memories = buildFixtureMemories(orgId);
  const run = await dreamJob({ orgId, memories });
  assert.equal(run.status, "pending_review");
  assert.ok(Array.isArray(run.diff.immutableInputs));
  assert.ok(Array.isArray(run.diff.supersededByMvcc));
  assert.ok(!run.diff.immutableInputs.includes(memories.find((memory) => memory.isSeed)?.id));
});

test("Sleep-time precompute cache hit skips cascade and writeGate invalidates overlapping entries", async () => {
  const previous = process.env.SLEEP_COMPUTE_ENABLED;
  process.env.SLEEP_COMPUTE_ENABLED = "true";
  try {
    await seedPrecomputedAnswer({
      orgId: "sleep-org",
      questionPattern: "FERC interconnect queue",
      answer: "cached answer",
      evidenceSnapshot: [],
      confidence: 0.8,
      computedAt: new Date(0).toISOString(),
      expiresAt: "2099-01-01T00:00:00.000Z",
      status: "active"
    });
    assert.equal((await findPrecomputedAnswer({ orgId: "sleep-org", question: "FERC interconnect queue status" }))?.answer, "cached answer");
    writeGate({ orgId: "sleep-org", content: "FERC interconnect queue update", sourceType: "primary_filing", memoryClass: "fact" });
    assert.equal(await findPrecomputedAnswer({ orgId: "sleep-org", question: "FERC interconnect queue status" }), undefined);
  } finally {
    if (previous === undefined) delete process.env.SLEEP_COMPUTE_ENABLED;
    else process.env.SLEEP_COMPUTE_ENABLED = previous;
  }
});

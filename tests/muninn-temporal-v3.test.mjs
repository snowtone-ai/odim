import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { realityGapfillSearch } from "../lib/huginn/gapfill.ts";
import {
  computeSourceHash,
  isMemoryCurrentlyUsable,
  normalizeMuninMemory,
  searchMuninMemory,
  semanticScore,
  toMuninMemoryRow,
  tokenize
} from "../lib/munin/memory.ts";
import {
  buildMemoryProposal,
  getFallbackAppliedMuninRecords,
  listMemoryProposals,
  persistMemoryProposal,
  reviewMemoryProposal
} from "../lib/munin/proposals.ts";
import { dreamJob } from "../lib/munin/dream.ts";
import { createSeedMemory, listSeedMemories, updateSeedMemory } from "../lib/munin/seed.ts";

const NOW = new Date("2026-08-24T00:00:00.000Z");
let memoryCounter = 0;

function memory(overrides = {}) {
  return {
    id: overrides.id ?? `memory-${memoryCounter++}`,
    orgId: overrides.orgId ?? "muninn-v3-test-org",
    agentScope: "archival",
    memoryClass: "fact",
    sourceType: "primary_filing",
    content: "東京電力の送電網計画は source-backed infrastructure evidence と確認された。",
    salienceScore: 0.9,
    importance: 0.8,
    decayScore: 1,
    isSeed: false,
    status: "active",
    linkedMemoryIds: [],
    sourceRefs: [],
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastAccessedAt: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}

test("v3 tokenizer and provenance are Unicode-safe and deterministic", () => {
  const tokens = tokenize("東京電力 送電網");
  assert.ok(tokens.has("東京電力"));
  assert.ok(tokens.has("東京"));
  assert.ok(tokens.has("電力"));
  assert.ok(semanticScore("東京電力", "東京電力の送電網") > 0);

  const sourceRefs = [{
    sourceId: "filing:jp-grid-1",
    url: "https://example.test/filing/1",
    title: "Grid filing",
    observedAt: "2026-08-20T00:00:00.000Z"
  }];
  const normalized = normalizeMuninMemory(memory({
    id: "provenance-memory",
    sourceRefs,
    observedAt: "2026-08-20T00:00:00.000Z",
    parentMemoryIds: ["parent-a", "parent-a", "parent-b"],
    supersedes: ["old-a", "old-a"]
  }));
  assert.equal(normalized.sourceHash, computeSourceHash({
    sourceRefs,
    observedAt: "2026-08-20T00:00:00.000Z",
    content: normalized.content
  }));
  assert.deepEqual(normalized.parentMemoryIds, ["parent-a", "parent-b"]);
  assert.deepEqual(normalized.supersedes, ["old-a"]);
  const row = toMuninMemoryRow(normalized);
  assert.equal(row.source_hash, normalized.sourceHash);
  assert.equal(row.review_status, "not_required");
  assert.equal(row.observed_at, "2026-08-20T00:00:00.000Z");
});

test("active approved search enforces validFrom <= now < validTo and rejects pending rows", () => {
  const memories = [
    memory({ id: "approved", reviewStatus: "approved" }),
    memory({ id: "legacy", reviewStatus: undefined }),
    memory({ id: "pending", reviewStatus: "pending_review" }),
    memory({ id: "future", validFrom: "2026-08-25T00:00:00.000Z", reviewStatus: "approved" }),
    memory({ id: "boundary-expired", validTo: "2026-08-24T00:00:00.000Z", reviewStatus: "approved" }),
    memory({ id: "retired", status: "retired", reviewStatus: "approved" }),
    memory({ id: "other-org", orgId: "another-org", reviewStatus: "approved" })
  ];
  const results = searchMuninMemory({
    orgId: "muninn-v3-test-org",
    question: "東京電力",
    memories,
    topK: 20,
    now: NOW
  });
  const ids = results.map((result) => result.id);
  assert.deepEqual(ids.sort(), ["approved", "legacy"].sort());
  assert.equal(isMemoryCurrentlyUsable({ memory: memory({ validFrom: NOW.toISOString(), validTo: NOW.toISOString() }), now: NOW }), false);
  assert.equal(isMemoryCurrentlyUsable({ memory: memory({ validFrom: NOW.toISOString(), validTo: null }), now: NOW }), true);
  assert.equal(
    isMemoryCurrentlyUsable({ memory: memory({ validFrom: "2026-01-01T00:00:00.000Z", observedAt: "2026-08-25T00:00:00.000Z" }), now: NOW }),
    false
  );
});

test("proposal fallback is deterministic, review-gated, and applies only after approval", async () => {
  const orgId = `proposal-v3-${Date.now()}`;
  const input = {
    orgId,
    content: "FERC confirms a new interconnect queue milestone.",
    sourceType: "primary_filing",
    memoryClass: "fact",
    novelty: 1,
    reliability: 1,
    certainty: 1,
    observedAt: NOW.toISOString(),
    now: NOW
  };
  const proposal = buildMemoryProposal(input);
  const sameProposal = buildMemoryProposal(input);
  assert.equal(proposal.id, sameProposal.id);
  assert.equal(proposal.reviewStatus, "pending_review");
  await persistMemoryProposal(proposal);
  assert.equal((await listMemoryProposals(orgId)).length, 1);

  const rejected = await reviewMemoryProposal({
    orgId,
    proposalId: proposal.id,
    decision: "reject",
    reviewerId: "reviewer-1",
    note: "Needs a second filing",
    now: NOW
  });
  assert.equal(rejected.applied, false);
  assert.equal(rejected.proposal.reviewStatus, "rejected");
  assert.equal(getFallbackAppliedMuninRecords(orgId).length, 0);
  await assert.rejects(
    reviewMemoryProposal({ orgId, proposalId: proposal.id, decision: "approve", now: NOW }),
    /no longer pending/
  );

  const approval = buildMemoryProposal({ ...input, content: "FERC confirms a second interconnect queue milestone." });
  await persistMemoryProposal(approval);
  const approved = await reviewMemoryProposal({
    orgId,
    proposalId: approval.id,
    decision: "approve",
    reviewerId: "reviewer-2",
    now: NOW
  });
  assert.equal(approved.applied, true);
  assert.equal(approved.proposal.reviewStatus, "approved");
  assert.equal(approved.record?.reviewStatus, "approved");
  assert.equal(getFallbackAppliedMuninRecords(orgId).length, 1);
  assert.ok(searchMuninMemory({
    orgId,
    question: "FERC interconnect",
    memories: [approved.record],
    now: NOW
  }).some((record) => record.id === approved.record?.id));

  const narrative = buildMemoryProposal({
    ...input,
    content: "A market narrative without primary evidence.",
    sourceType: "web_narrative"
  });
  assert.equal(narrative.reviewStatus, "rejected");
  assert.equal(narrative.rejectionReason?.includes("web_narrative"), true);
});

test("proposal approval is a single CAS transition and compensates a failed record write", async () => {
  const orgId = `proposal-cas-v3-${Date.now()}`;
  const proposal = buildMemoryProposal({
    orgId,
    content: "CAS proposal for an approved filing fact.",
    sourceType: "primary_filing",
    memoryClass: "fact",
    novelty: 1,
    reliability: 1,
    certainty: 1,
    now: NOW
  });
  await persistMemoryProposal(proposal);
  const outcomes = await Promise.allSettled([
    reviewMemoryProposal({ orgId, proposalId: proposal.id, decision: "approve", reviewerId: "a", now: NOW }),
    reviewMemoryProposal({ orgId, proposalId: proposal.id, decision: "approve", reviewerId: "b", now: NOW })
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled" && outcome.value.applied).length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);

  const failedOrgId = `proposal-failure-v3-${Date.now()}`;
  const failed = buildMemoryProposal({
    orgId: failedOrgId,
    content: "Record persistence must fail closed.",
    sourceType: "primary_filing",
    memoryClass: "fact",
    now: NOW
  });
  await persistMemoryProposal(failed);
  await assert.rejects(
    reviewMemoryProposal({
      orgId: failedOrgId,
      proposalId: failed.id,
      decision: "approve",
      now: NOW,
      persistRecord: async () => {
        throw new Error("simulated record write failure");
      }
    }),
    /simulated record write failure/
  );
  const restored = (await listMemoryProposals(failedOrgId)).find((item) => item.id === failed.id);
  assert.equal(restored?.reviewStatus, "pending_review");
  assert.equal(getFallbackAppliedMuninRecords(failedOrgId).length, 0);
});

test("seed update appends a superseding seed and closes the prior validity window", async () => {
  const orgId = `seed-v3-${Date.now()}`;
  const original = await createSeedMemory({
    orgId,
    content: "Keep the original user seed.",
    memoryClass: "fact",
    now: NOW
  });
  const updated = await updateSeedMemory({
    orgId,
    id: original.id,
    content: "Append the revised user seed.",
    now: new Date("2026-08-24T00:01:00.000Z")
  });
  const seeds = await listSeedMemories(orgId);
  assert.equal(seeds.some((seed) => seed.id === original.id), false);
  assert.ok(seeds.some((seed) => seed.id === updated.id));
  assert.ok(updated.provenance?.supersedes.includes(original.id));
  assert.equal(original.validTo, updated.validFrom);
});

test("Dream emits pending proposals only and never mutates, retires, or precomputes inputs", async () => {
  const orgId = `dream-v3-${Date.now()}`;
  const sourceRefs = [{
    sourceId: "filing:dream-v3",
    url: "https://example.test/dream-v3",
    title: "Dream fixture",
    observedAt: NOW.toISOString()
  }];
  const memories = [
    memory({ id: "dream-a", orgId, content: "FERC queue milestone approved for the interconnect project.", sourceRefs }),
    memory({ id: "dream-b", orgId, content: "FERC queue milestone confirmed for the interconnect project.", sourceRefs })
  ];
  const run = await dreamJob({ orgId, memories, now: NOW });
  assert.equal(run.status, "pending_review");
  assert.equal(run.phaseSummary.preCompute.created, 0);
  assert.deepEqual(run.diff.createdRows, []);
  assert.deepEqual(run.diff.supersededByMvcc, []);
  assert.ok(run.proposalIds.length >= 1);
  const proposals = await listMemoryProposals(orgId);
  assert.ok(proposals.length >= 1);
  assert.ok(proposals.every((proposal) => proposal.reviewStatus === "pending_review"));
  assert.ok(memories.every((item) => item.validTo === null));
});

test("migration uses temporal review predicates, partial indexes, and true reciprocal-rank fusion", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0015_huginn_muninn_v3.sql", import.meta.url), "utf8").toLowerCase();
  assert.match(migration, /row_number\(\)\s+over/);
  assert.match(migration, /1\.0\s*\/\s*\(60\.0\s*\+\s*l\.lexical_rank\)/);
  assert.match(migration, /1\.0\s*\/\s*\(60\.0\s*\+\s*s\.semantic_rank\)/);
  assert.match(migration, /when p_query_embedding is null or m\.embedding is null then null/);
  assert.match(migration, /m\.valid_from <= p_now/);
  assert.match(migration, /m\.observed_at <= p_now/);
  assert.match(migration, /m\.review_status in \('approved', 'not_required'\)/);
  assert.match(migration, /using hnsw/);
  assert.match(migration, /using gin/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /alter table munin_memory alter column review_status set default 'pending_review'/);
  assert.match(migration, /update munin_memory set review_status = 'not_required' where review_status is null/);
  assert.match(migration, /alter table munin_opinions alter column review_status set default 'pending_review'/);
  assert.match(migration, /update munin_opinions set review_status = 'not_required' where review_status is null/);
  assert.match(migration, /munin_memory_valid_window_check/);
  assert.match(migration, /munin_opinions_valid_window_check/);
  assert.match(migration, /munin_review_memory_proposal/);
  assert.match(migration, /for update/);
  assert.match(migration, /return jsonb_build_object\('applied'/);
  assert.match(migration, /munin_memory_proposals_payload_immutable/);
  assert.match(migration, /drop trigger if exists munin_memory_proposals_payload_immutable_trigger/);
  assert.match(migration, /munin_try_acquire_dream_lock/);
  assert.match(migration, /munin_release_dream_lock/);
  assert.match(migration, /(?=[\s\S]*revoke execute on function public\.munin_review_memory_proposal\(uuid, uuid, text, text, text, timestamptz, jsonb\) from public, anon, authenticated;)(?=[\s\S]*revoke execute on function public\.munin_supersede_seed\(uuid, uuid, text, timestamptz, jsonb\) from public, anon, authenticated;)(?=[\s\S]*revoke execute on function public\.munin_try_acquire_dream_lock\(uuid, uuid, timestamptz, integer\) from public, anon, authenticated;)(?=[\s\S]*revoke execute on function public\.munin_release_dream_lock\(uuid, uuid\) from public, anon, authenticated;)/);
  assert.match(migration, /pre_computed_answers_confidence_check/);
  assert.match(migration, /pre_computed_answers_expiry_check/);
  assert.doesNotMatch(migration, /0\.6\s*\*\s*ranked/);
});

test("proposal persistence is insert-once and cannot resurrect a rejected lifecycle", async () => {
  const orgId = `proposal-immutable-${Date.now()}`;
  const proposal = buildMemoryProposal({
    orgId,
    content: "An immutable proposal payload remains rejected after a retry.",
    sourceType: "primary_filing",
    memoryClass: "fact",
    now: NOW
  });
  await persistMemoryProposal(proposal);
  await reviewMemoryProposal({ orgId, proposalId: proposal.id, decision: "reject", reviewerId: "reviewer", now: NOW });
  await persistMemoryProposal(proposal);
  const persisted = (await listMemoryProposals(orgId)).find((item) => item.id === proposal.id);
  assert.equal(persisted?.reviewStatus, "rejected");
  assert.equal(persisted?.reviewedBy, "reviewer");
});

test("reality gapfill is proposal-only and never directly writes active Muninn memory", async () => {
  const gapfillSource = readFileSync(new URL("../lib/huginn/gapfill.ts", import.meta.url), "utf8");
  const writeGateSource = readFileSync(new URL("../lib/munin/write-gate.ts", import.meta.url), "utf8");
  const seedSource = readFileSync(new URL("../lib/munin/seed.ts", import.meta.url), "utf8");
  assert.match(gapfillSource, /buildMemoryProposal/);
  assert.match(gapfillSource, /persistMemoryProposal/);
  assert.doesNotMatch(gapfillSource, /toMuninMemoryRow/);
  assert.doesNotMatch(gapfillSource, /from\(["']munin_memory["']\)/);
  assert.match(writeGateSource, /candidate\.reviewStatus \?\? \(candidate\.isSeed \? "approved" : "pending_review"\)/);
  assert.match(seedSource, /reviewStatus: "approved"/);

  const previousProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "mock";
  try {
    const orgId = `gapfill-v3-${Date.now()}`;
    const results = await realityGapfillSearch({
      orgId,
      question: "FERC filing",
      allowedDomains: ["elibrary.ferc.gov"]
    });
    assert.ok(results.length >= 1);
    assert.ok(results.every((result) => result.reviewStatus === "pending_review" && result.proposalId));
    const proposals = await listMemoryProposals(orgId);
    assert.equal(proposals.length, results.length);
    assert.ok(proposals.every((proposal) => proposal.reviewStatus === "pending_review"));
  } finally {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
  }
});

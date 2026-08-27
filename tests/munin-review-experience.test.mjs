import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildFixtureMemories } from "../lib/munin/memory.ts";
import { dreamJob } from "../lib/munin/dream.ts";
import { createMuninTemporalMemoryReader, createSupabaseTemporalMemoryReader } from "../lib/munin/reader.ts";
import { authorizeMuninAdminMember, resolveMuninAdminMember } from "../lib/munin/review-authorization.ts";
import {
  buildMemoryProposal,
  listMemoryProposals,
  listPendingMemoryProposals,
  persistMemoryProposal,
  reviewMemoryProposal
} from "../lib/munin/proposals.ts";

function withEnv(changes) {
  const before = {};
  for (const [key, value] of Object.entries(changes)) {
    before[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test("review contract is admin-scoped, org-isolated, and attributes disabled-mode decisions safely", async () => {
  const restore = withEnv({ ENVIRONMENT: "local", AUTH_REQUIRED: undefined, REPOSITORY_SUPABASE_STRICT: undefined });
  const orgA = "11111111-1111-4111-8111-111111111111";
  const orgB = "22222222-2222-4222-8222-222222222222";
  try {
    const proposalA = buildMemoryProposal({ orgId: orgA, content: "Org A review candidate", sourceType: "primary_filing", memoryClass: "fact" });
    const proposalB = buildMemoryProposal({ orgId: orgB, content: "Org B private candidate", sourceType: "primary_filing", memoryClass: "fact" });
    await persistMemoryProposal(proposalA);
    await persistMemoryProposal(proposalB);

    const listed = await listPendingMemoryProposals(orgA);
    assert.deepEqual(listed.map((item) => item.id), [proposalA.id]);

    await assert.rejects(
      reviewMemoryProposal({ orgId: orgA, proposalId: proposalB.id, decision: "approve" }),
      /not found|org isolation/i
    );

    const rejected = await reviewMemoryProposal({ orgId: orgA, proposalId: proposalA.id, decision: "reject", reviewerId: "odim-admin:disabled", note: "needs a second source" });
    assert.equal(rejected.proposal.reviewStatus, "rejected");
    assert.equal(rejected.proposal.reviewedBy, "odim-admin:disabled");

    assert.deepEqual(await listPendingMemoryProposals(orgA), []);
  } finally {
    restore();
  }
});

test("SSO review authority requires an org-matched admin user and fails closed", async () => {
  const session = { orgId: "11111111-1111-4111-8111-111111111111", email: "admin@example.com" };
  assert.deepEqual(
    authorizeMuninAdminMember(session, {
      id: "user-admin",
      orgId: session.orgId,
      email: "ADMIN@example.com",
      role: "admin"
    }),
    { userId: "user-admin", principal: "ADMIN@example.com" }
  );
  await assert.rejects(
    resolveMuninAdminMember(session, async () => ({
      id: "user-analyst",
      orgId: session.orgId,
      email: session.email,
      role: "analyst"
    })),
    /unauthorized/
  );
  await assert.rejects(resolveMuninAdminMember(session, async () => null), /unauthorized/);
  await assert.rejects(resolveMuninAdminMember(session, async () => ({
    id: "user-other-org",
    orgId: "22222222-2222-4222-8222-222222222222",
    email: session.email,
    role: "admin"
  })), /unauthorized/);
  await assert.rejects(resolveMuninAdminMember(session, async () => {
    throw new Error("database unavailable");
  }), /unauthorized/);
});

test("reject is durable across deterministic Dream retries in fallback storage", async () => {
  const restore = withEnv({ ENVIRONMENT: "local", AUTH_REQUIRED: undefined, REPOSITORY_SUPABASE_STRICT: undefined });
  const orgId = `proposal-retry-${Date.now()}`;
  try {
    const proposal = buildMemoryProposal({ orgId, content: "Retry must not revive a rejected proposal", sourceType: "primary_filing", memoryClass: "fact" });
    await persistMemoryProposal(proposal);
    await reviewMemoryProposal({ orgId, proposalId: proposal.id, decision: "reject", reviewerId: "reviewer-a" });
    await persistMemoryProposal(proposal);
    assert.equal((await listPendingMemoryProposals(orgId)).length, 0);
    assert.equal((await listMemoryProposals(orgId))[0].reviewStatus, "rejected");
  } finally {
    restore();
  }
});

test("Dream lock is per organization: same-org duplicate skips while another org proceeds", async () => {
  const restore = withEnv({ ENVIRONMENT: "local", AUTH_REQUIRED: undefined, REPOSITORY_SUPABASE_STRICT: undefined });
  try {
    const makePair = (orgId) => {
      const source = buildFixtureMemories(orgId).find((memory) => !memory.isSeed && memory.status === "active");
      return [source, { ...source, id: `${source.id}-b`, content: `${source.content} confirmed` }, { ...source, id: `${source.id}-c`, content: `${source.content} approved` }];
    };
    const orgA = `dream-lock-a-${Date.now()}`;
    const orgB = `dream-lock-b-${Date.now()}`;
    const first = dreamJob({ orgId: orgA, memories: makePair(orgA) });
    const duplicate = dreamJob({ orgId: orgA, memories: makePair(orgA) });
    const otherOrg = dreamJob({ orgId: orgB, memories: makePair(orgB) });
    const [run, skipped, other] = await Promise.all([first, duplicate, otherOrg]);
    assert.notEqual(run.phaseSummary.skipped, true);
    assert.equal(skipped.phaseSummary.reason, "concurrent_run");
    assert.notEqual(other.phaseSummary.skipped, true);
  } finally {
    restore();
  }
});

test("production Dream reads current Supabase rows and fails closed on DB failure", async () => {
  const restore = withEnv({
    ENVIRONMENT: "production",
    REPOSITORY_SUPABASE_STRICT: undefined,
    NEXT_PUBLIC_SUPABASE_PRODUCTION_URL: "https://supabase.example.test",
    SUPABASE_PRODUCTION_SERVICE_ROLE_KEY: "service-role-test",
    SUPABASE_PRODUCTION_ANON_KEY: undefined,
    AI_PROVIDER: "mock"
  });
  const previousFetch = globalThis.fetch;
  const now = "2026-08-24T00:00:00.000Z";
  const orgId = "33333333-3333-4333-8333-333333333333";
  const dbRows = [
    {
      id: "db-memory-a",
      org_id: orgId,
      agent_scope: "archival",
      memory_class: "fact",
      source_type: "primary_filing",
      content: "Current FERC queue milestone is approved for the interconnect project.",
      salience_score: 0.9,
      importance: 0.8,
      decay_score: 1,
      is_seed: false,
      status: "active",
      linked_memory_ids: [],
      source_refs: [],
      valid_from: "2026-01-01T00:00:00.000Z",
      valid_to: null,
      created_at: "2026-01-01T00:00:00.000Z",
      last_accessed_at: now,
      observed_at: now,
      review_status: "approved"
    },
    {
      id: "db-memory-b",
      org_id: orgId,
      agent_scope: "archival",
      memory_class: "fact",
      source_type: "primary_filing",
      content: "Current FERC queue milestone is confirmed for the interconnect project.",
      salience_score: 0.9,
      importance: 0.8,
      decay_score: 1,
      is_seed: false,
      status: "active",
      linked_memory_ids: [],
      source_refs: [],
      valid_from: "2026-01-01T00:00:00.000Z",
      valid_to: null,
      created_at: "2026-01-01T00:00:00.000Z",
      last_accessed_at: now,
      observed_at: now,
      review_status: "not_required"
    }
  ];
  try {
    globalThis.fetch = async (url, init = {}) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/rpc/munin_try_acquire_dream_lock")) {
        return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
      }
      if (path.endsWith("/munin_memory") && (init.method ?? "GET") === "GET") {
        return new Response(JSON.stringify(dbRows), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("[]", { status: 201, headers: { "content-type": "application/json" } });
    };
    const run = await dreamJob({
      orgId,
      // This fixture is deliberately unrelated; production must ignore it.
      memories: [{ ...dbRows[0], id: "fixture-should-not-be-read", content: "fixture only" }],
      now: new Date(now)
    });
    assert.ok(run.diff.immutableInputs.includes("db-memory-a"));
    assert.ok(!run.diff.immutableInputs.includes("fixture-should-not-be-read"));
    assert.ok(run.proposalIds.length >= 1);

    globalThis.fetch = async (url, init = {}) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/rpc/munin_try_acquire_dream_lock")) {
        return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
      }
      if (path.endsWith("/munin_memory") && (init.method ?? "GET") === "GET") {
        return new Response(JSON.stringify({ message: "database unavailable" }), { status: 503 });
      }
      return new Response("[]", { status: 201 });
    };
    await assert.rejects(
      dreamJob({ orgId: "44444444-4444-4444-8444-444444444444", memories: buildFixtureMemories("44444444-4444-4444-8444-444444444444"), now: new Date(now) }),
      /memory read failed/i
    );
  } finally {
    globalThis.fetch = previousFetch;
    restore();
  }
});

test("review queue contract stays flat, pending-only, server-authorized, and accessible", () => {
  const component = readFileSync(new URL("../components/ui/munin-review-queue.tsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../app/(dashboard)/settings/page.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../app/actions/munin.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/munin/proposals/route.ts", import.meta.url), "utf8");
  assert.match(component, /reviewStatus === "pending_review"/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /min-h-11/);
  assert.match(component, /motion-reduce:transition-none/);
  assert.match(component, /useState<\{ id: string; decision: Decision \} \| null>/);
  assert.match(component, /aria-busy=\{refreshing \|\| busy !== null\}/);
  assert.doesNotMatch(component, /data-org-id/);
  assert.doesNotMatch(component, /Confidence/);
  assert.match(component, /Relevance/);
  assert.match(component, /Review gate/);
  assert.match(component, /Source/);
  assert.match(component, /As of/);
  assert.match(component, /reviewMuninProposal/);
  assert.match(settings, /listPendingMemoryProposals/);
  assert.match(settings, /getMuninReviewContext/);
  assert.match(action, /verifySsoSession|getMuninReviewContext/);
  const reviewAuth = readFileSync(new URL("../lib/munin/review-auth.ts", import.meta.url), "utf8");
  assert.match(reviewAuth, /from\("users"\)/);
  assert.match(reviewAuth, /\.eq\("org_id", session\.orgId\)/);
  assert.match(reviewAuth, /\.eq\("email", session\.email\)/);
  assert.match(reviewAuth, /role/);
  assert.match(route, /admin:read/);
  assert.match(route, /admin:write/);
  assert.match(route, /reviewerId/);
  assert.match(route, /listPendingMemoryProposals\(auth\.context\.orgId\)/);
  assert.doesNotMatch(settings, /defaultSettingsOrgId/);
  assert.match(settings, /getAdminSettings\(\{ orgId: settingsOrgId \}\)/);
  assert.match(settings, /listSeedMemories\(settingsOrgId\)/);
  assert.match(settings, /listWatchtowerRuns\(\{ orgId: settingsOrgId \}\)/);
  assert.match(settings, /getOrgBilling\(settingsOrgId\)/);
  assert.match(settings, /listInvites\(\{ orgId: settingsOrgId \}\)/);
});

test("proposal storage and migration use insert-once lifecycle fields and audit-safe actor text", () => {
  const proposals = readFileSync(new URL("../lib/munin/proposals.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/0015_huginn_muninn_v3.sql", import.meta.url), "utf8");
  assert.match(proposals, /ignoreDuplicates:\s*true/);
  assert.match(proposals, /if \(!fallbackProposals\.has\(key\)\)/);
  assert.match(migration, /reviewed_by text/);
  assert.match(migration, /alter column reviewed_by type text/);
});

function makeMuninReaderClient(input) {
  const calls = [];
  const client = {
    calls,
    rpc: async (name, args) => {
      calls.push({ kind: "rpc", name, args });
      return { data: input.rpcRows ?? [], error: input.rpcError ?? null };
    },
    from(table) {
      const filters = [];
      const query = {
        select() { return query; },
        eq(column, value) { filters.push([column, value]); return query; },
        in(column, values) { filters.push([column, values]); return query; },
        lte(column, value) { filters.push([column, value]); return query; },
        or(value) { filters.push(["or", value]); return query; },
        limit() { return query; },
        then(resolve, reject) {
          calls.push({ kind: "table", table, filters });
          const idFilter = filters.find(([column]) => column === "id")?.[1];
          const seedOnly = filters.some(([column, value]) => column === "is_seed" && value === true);
          const rows = table === "munin_opinions"
            ? input.opinionRows ?? []
            : (input.memoryRows ?? []).filter((row) => {
                if (seedOnly && row.is_seed !== true) return false;
                if (Array.isArray(idFilter) && !idFilter.includes(row.id)) return false;
                return true;
              });
          return Promise.resolve({ data: rows, error: input.tableError ?? null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  return client;
}

test("production Muninn reader uses hybrid RPC, temporal predicates, seeds, and tenant scope", async () => {
  const orgA = "55555555-5555-4555-8555-555555555555";
  const now = "2026-08-24T00:00:00.000Z";
  const client = makeMuninReaderClient({
    rpcRows: [{ id: "db-memory-a", org_id: orgA, rank: 0.031 }],
    memoryRows: [
      {
        id: "db-memory-a", org_id: orgA, agent_scope: "archival", memory_class: "fact", source_type: "primary_filing",
        content: "DB-only FERC milestone", salience_score: 0.9, importance: 0.8, decay_score: 1, is_seed: false,
        status: "active", linked_memory_ids: [], source_refs: [], valid_from: "2026-01-01T00:00:00.000Z", valid_to: null,
        created_at: "2026-01-01T00:00:00.000Z", last_accessed_at: now, review_status: "approved"
      },
      {
        id: "db-seed-a", org_id: orgA, agent_scope: "core", memory_class: "procedure", source_type: "user_seed",
        content: "DB-only tenant mandate", salience_score: 1, importance: 1, decay_score: 1, is_seed: true,
        status: "active", linked_memory_ids: [], source_refs: [], valid_from: "2026-01-01T00:00:00.000Z", valid_to: null,
        created_at: "2026-01-01T00:00:00.000Z", last_accessed_at: now, review_status: "not_required"
      }
    ]
  });
  const reader = createSupabaseTemporalMemoryReader({ client });
  const result = await reader.search({ orgId: orgA, question: "FERC milestone", asOf: now });
  assert.deepEqual(result.map((memory) => memory.id), ["db-seed-a", "db-memory-a"]);
  assert.ok(result.every((memory) => !memory.content.includes("Fixture")));
  const rpcCall = client.calls.find((call) => call.kind === "rpc");
  assert.equal(rpcCall.name, "munin_hybrid_search");
  assert.deepEqual(rpcCall.args, {
    p_org_id: orgA,
    p_query: "FERC milestone",
    p_query_embedding: null,
    p_match_count: 8,
    p_now: now
  });
  const memoryCall = client.calls.find((call) => call.kind === "table" && call.table === "munin_memory");
  assert.ok(memoryCall.filters.some(([column, value]) => column === "org_id" && value === orgA));
  assert.ok(memoryCall.filters.some(([column, value]) => column === "review_status" && value.includes("approved") && value.includes("not_required")));
  assert.ok(memoryCall.filters.some(([column]) => column === "valid_from"));
  assert.ok(memoryCall.filters.some(([column, value]) => column === "observed_at" && value === now));
  assert.ok(memoryCall.filters.some(([column]) => column === "or"));
});

test("production Muninn reader fails closed on database errors and never falls back to fixtures", async () => {
  const restore = withEnv({
    ENVIRONMENT: "production",
    REPOSITORY_SUPABASE_STRICT: undefined,
    NEXT_PUBLIC_SUPABASE_PRODUCTION_URL: undefined,
    SUPABASE_PRODUCTION_SERVICE_ROLE_KEY: undefined,
    SUPABASE_PRODUCTION_ANON_KEY: undefined,
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined
  });
  try {
    const reader = createMuninTemporalMemoryReader();
    await assert.rejects(
      reader.search({ orgId: "66666666-6666-4666-8666-666666666666", question: "fixture?", asOf: "2026-08-24T00:00:00.000Z" }),
      /fail-closed|Supabase service environment/i
    );
  } finally {
    restore();
  }
});

test("Muninn reader rejects an RPC row from another tenant", async () => {
  const client = makeMuninReaderClient({
    rpcRows: [{ id: "foreign", org_id: "77777777-7777-4777-8777-777777777777", rank: 0.03 }]
  });
  const reader = createSupabaseTemporalMemoryReader({ client });
  await assert.rejects(
    reader.search({ orgId: "88888888-8888-4888-8888-888888888888", question: "tenant", asOf: "2026-08-24T00:00:00.000Z" }),
    /org isolation/i
  );
});

test("Huginn entry points inject the default temporal reader and production planning does not use fixture defaults", () => {
  const query = readFileSync(new URL("../lib/huginn/query.ts", import.meta.url), "utf8");
  const cascade = readFileSync(new URL("../lib/huginn/cascade.ts", import.meta.url), "utf8");
  const action = readFileSync(new URL("../app/actions/huginn.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/huginn/route.ts", import.meta.url), "utf8");
  assert.match(query, /createMuninTemporalMemoryReader/);
  assert.match(query, /readCoreMemoriesForPlanning/);
  assert.match(cascade, /createMuninTemporalMemoryReader/);
  assert.doesNotMatch(cascade, /memories: input\.memories \?\? buildFixtureMemories/);
  assert.match(action, /temporalMemoryReader: createMuninTemporalMemoryReader/);
  assert.match(route, /temporalMemoryReader: createMuninTemporalMemoryReader/);
});

test("Huginn API does not expose caught exception details", () => {
  const route = readFileSync(new URL("../app/api/huginn/route.ts", import.meta.url), "utf8");
  assert.match(route, /console\.error\("\[huginn\] request failed"/);
  assert.match(route, /errorType: err instanceof Error \? err\.name : typeof err/);
  assert.match(route, /Response\.json\(\{ error: "Internal server error" \}, \{ status: 500 \}\)/);
  assert.doesNotMatch(route, /error: err instanceof Error \? err\.message/);
  assert.match(route, /userId: auth\.mode === "disabled" \? body\.userId \?\? auth\.context\.userId : auth\.context\.userId/);
});

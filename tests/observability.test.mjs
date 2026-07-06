import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLogLine,
  redactLogFields,
  requestLoggingEnabled
} from "../lib/observability/logger.ts";
import {
  recordApiError,
  recordApiOutcome,
  resetApiMetrics,
  snapshotApiMetrics
} from "../lib/observability/metrics.ts";
import {
  buildSentryEnvelope,
  errorTrackingEnabled,
  parseSentryDsn,
  reportError
} from "../lib/observability/error-tracking.ts";
import { instrumentApiRoute } from "../lib/observability/instrument.ts";
import { probeSupabase } from "../lib/observability/probes.ts";
import { GET as healthGet } from "../app/api/health/route.ts";
import { GET as observabilityGet } from "../app/api/observability/route.ts";

function withEnv(overrides, run) {
  const saved = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const restore = () => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  return Promise.resolve(run()).finally(restore);
}

// Quiet, tracking-disabled, Supabase-free runtime for route-level tests.
const quietLocalEnv = {
  REQUEST_LOGGING: "false",
  SENTRY_DSN: undefined,
  AUTH_REQUIRED: undefined,
  ENVIRONMENT: undefined,
  ODIM_RUNTIME_ENV: undefined,
  VERCEL_ENV: undefined,
  NEXT_PUBLIC_SUPABASE_URL: undefined,
  SUPABASE_URL: undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  AI_PROVIDER: undefined
};

test("structured logs redact secret-like fields and token-shaped values", () => {
  const fields = redactLogFields({
    apiKey: "odim_key_abc123",
    authorization: "Bearer xyz",
    route: "v1/entities",
    note: "token odim_invite_abc-123 and jwt eyJhbGciOiJIUzI1NiJ9xx inline",
    count: 3,
    skipped: undefined
  });
  assert.equal(fields.apiKey, "[redacted]");
  assert.equal(fields.authorization, "[redacted]");
  assert.equal(fields.route, "v1/entities");
  assert.equal(fields.count, 3);
  assert.ok(!("skipped" in fields));
  assert.doesNotMatch(String(fields.note), /odim_invite|eyJ/);

  const line = formatLogLine("info", "api.request", { route: "v1/alerts", status: 200 }, new Date("2026-07-06T00:00:00.000Z"));
  const parsed = JSON.parse(line);
  assert.equal(parsed.ts, "2026-07-06T00:00:00.000Z");
  assert.equal(parsed.level, "info");
  assert.equal(parsed.event, "api.request");
  assert.equal(parsed.status, 200);
  assert.ok(!line.includes("\n"), "log lines must be single-line JSON");
});

test("request logging is on by default and opt-out via env", async () => {
  await withEnv({ REQUEST_LOGGING: undefined }, () => {
    assert.equal(requestLoggingEnabled(), true);
  });
  await withEnv({ REQUEST_LOGGING: "false" }, () => {
    assert.equal(requestLoggingEnabled(), false);
  });
});

test("sentry DSN parsing accepts valid DSNs and rejects malformed input", () => {
  const dsn = parseSentryDsn("https://publickey123@o4507.ingest.sentry.io/456789");
  assert.deepEqual(dsn, {
    protocol: "https",
    publicKey: "publickey123",
    host: "o4507.ingest.sentry.io",
    projectId: "456789"
  });
  assert.equal(parseSentryDsn(undefined), undefined);
  assert.equal(parseSentryDsn(""), undefined);
  assert.equal(parseSentryDsn("not-a-dsn"), undefined);
  assert.equal(parseSentryDsn("https://host.without.key/123"), undefined);
  assert.equal(parseSentryDsn("https://key@host/not-numeric"), undefined);
  assert.equal(errorTrackingEnabled({}), false, "error tracking is disabled by default");
  assert.equal(errorTrackingEnabled({ SENTRY_DSN: "https://k@h.io/1" }), true);
});

test("sentry envelopes carry the exception and redacted context", () => {
  const { eventId, body } = buildSentryEnvelope({
    error: new TypeError("boom"),
    context: { route: "v1/alerts", apiKey: "odim_key_secretvalue" },
    environment: "local",
    now: new Date("2026-07-06T00:00:00.000Z")
  });
  const [header, item, event] = body.split("\n").map((line) => JSON.parse(line));
  assert.match(eventId, /^[0-9a-f]{32}$/);
  assert.equal(header.event_id, eventId);
  assert.equal(item.type, "event");
  assert.equal(event.level, "error");
  assert.equal(event.environment, "local");
  assert.deepEqual(event.exception.values[0], { type: "TypeError", value: "boom" });
  assert.equal(event.extra.apiKey, "[redacted]");
  assert.equal(event.extra.route, "v1/alerts");
});

test("reportError is a no-op sink without a DSN and never throws on delivery failure", async () => {
  await withEnv({ REQUEST_LOGGING: "false" }, async () => {
    const disabled = await reportError(new Error("x"), {}, { env: {} });
    assert.deepEqual(disabled, { delivered: false, reason: "disabled" });

    const calls = [];
    const okFetch = async (url, init) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    };
    const sent = await reportError(new Error("boom"), { route: "v1/alerts" }, {
      env: { SENTRY_DSN: "https://pubkey@sentry.example.io/42" },
      fetchImpl: okFetch
    });
    assert.deepEqual(sent, { delivered: true, reason: "sent" });
    assert.equal(calls[0].url, "https://sentry.example.io/api/42/envelope/");
    assert.equal(calls[0].init.method, "POST");
    assert.match(calls[0].init.headers["X-Sentry-Auth"], /sentry_key=pubkey/);
    assert.equal(calls[0].init.headers["Content-Type"], "application/x-sentry-envelope");

    const failed = await reportError(new Error("boom"), {}, {
      env: { SENTRY_DSN: "https://pubkey@sentry.example.io/42" },
      fetchImpl: async () => {
        throw new Error("network down");
      }
    });
    assert.deepEqual(failed, { delivered: false, reason: "network" });

    const rejected = await reportError(new Error("boom"), {}, {
      env: { SENTRY_DSN: "https://pubkey@sentry.example.io/42" },
      fetchImpl: async () => new Response("nope", { status: 403 })
    });
    assert.deepEqual(rejected, { delivered: false, reason: "rejected" });

    // AbortSignal.timeout raises a DOMException named TimeoutError, not a plain
    // Error — the never-throws contract must hold for that class too.
    const timedOut = await reportError(new Error("boom"), {}, {
      env: { SENTRY_DSN: "https://pubkey@sentry.example.io/42" },
      fetchImpl: async () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      }
    });
    assert.deepEqual(timedOut, { delivered: false, reason: "network" });
  });
});

test("sentry envelopes scrub token shapes and connection-string credentials from error messages", () => {
  const { body } = buildSentryEnvelope({
    error: new Error('relation missing: postgres://postgres:hunter2@db.example.com/app token odim_key_abc123'),
    environment: "local"
  });
  const event = JSON.parse(body.split("\n")[2]);
  const value = event.exception.values[0].value;
  assert.doesNotMatch(value, /hunter2|odim_key_abc123/);
  assert.match(value, /\[redacted\]@db\.example\.com/);
});

test("api metrics aggregate per-route counters and cap the error ring buffer", () => {
  resetApiMetrics();
  recordApiOutcome("v1/entities", 200);
  recordApiOutcome("v1/entities", 200);
  recordApiOutcome("v1/entities", 500);
  recordApiOutcome("v1/alerts", 429);
  for (let i = 0; i < 25; i += 1) {
    recordApiError("v1/entities", 500, `error ${i} ${"x".repeat(300)}`);
  }
  const snapshot = snapshotApiMetrics();
  assert.equal(snapshot.totalRequests, 4);
  assert.equal(snapshot.totalErrors, 1, "4xx responses are not server errors");
  assert.equal(snapshot.errorRate, 0.25);
  assert.equal(snapshot.routes[0].route, "v1/entities");
  assert.equal(snapshot.routes[0].requests, 3);
  assert.equal(snapshot.recentErrors.length, 20, "ring buffer is capped");
  assert.ok(snapshot.recentErrors.every((entry) => entry.message.length <= 200));
  assert.match(snapshot.recentErrors.at(-1).message, /^error 24/);
  resetApiMetrics();
  assert.equal(snapshotApiMetrics().totalRequests, 0);
});

test("instrumented routes pass responses through and convert crashes to generic 500s", async () => {
  await withEnv(quietLocalEnv, async () => {
    resetApiMetrics();
    const ok = instrumentApiRoute("test/ok", async () => Response.json({ fine: true }, { status: 201 }));
    const okResponse = await ok(new Request("http://localhost/test", { method: "POST" }));
    assert.equal(okResponse.status, 201);

    // The message below is a fixture: it appears in local app.error log output
    // by design (local logs are trusted); the assertion is that it never
    // reaches the HTTP response body.
    const crash = instrumentApiRoute("test/crash", async () => {
      throw new Error("supabase schema detail that must not leak");
    });
    const crashResponse = await crash(new Request("http://localhost/test"));
    assert.equal(crashResponse.status, 500);
    assert.deepEqual(await crashResponse.json(), { error: "Internal server error" });

    const snapshot = snapshotApiMetrics();
    assert.equal(snapshot.totalRequests, 2);
    assert.equal(snapshot.totalErrors, 1);
    assert.equal(snapshot.recentErrors[0].route, "test/crash");
    resetApiMetrics();
  });
});

test("supabase probe reports latency without leaking configuration", async () => {
  const unconfigured = await probeSupabase({ env: {} });
  assert.deepEqual(unconfigured, { configured: false });

  const reachable = await probeSupabase({
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc" },
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://example.supabase.co/rest/v1/");
      assert.equal(init.method, "HEAD");
      return new Response(null, { status: 200 });
    }
  });
  assert.equal(reachable.configured, true);
  assert.equal(reachable.ok, true);
  assert.equal(typeof reachable.latencyMs, "number");

  const down = await probeSupabase({
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc" },
    fetchImpl: async () => {
      throw new Error("timeout");
    }
  });
  assert.deepEqual({ configured: down.configured, ok: down.ok }, { configured: true, ok: false });
});

test("health endpoint exposes dependency probes and aggregate error rates without leaks", async () => {
  await withEnv(quietLocalEnv, async () => {
    const response = await healthGet();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.dependencies.supabase.configured, false);
    assert.equal(typeof body.checks.errorTracking, "boolean");
    assert.equal(typeof body.metrics.requests, "number");
    assert.equal(typeof body.metrics.errors, "number");
    assert.equal(typeof body.metrics.errorRate, "number");
    const raw = JSON.stringify(body);
    assert.doesNotMatch(raw, /key|token|secret|password|postgres|https?:\/\/|eyJ[A-Za-z0-9_-]+/i);
  });
});

test("observability endpoint returns the admin metrics snapshot", async () => {
  await withEnv(quietLocalEnv, async () => {
    resetApiMetrics();
    recordApiOutcome("v1/entities", 200);
    const response = await observabilityGet(new Request("http://localhost/api/observability"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.metrics.totalRequests, 1);
    assert.equal(body.metrics.routes[0].route, "v1/entities");
    assert.equal(body.errorTracking.enabled, false);
    assert.equal(body.requestLogging.enabled, false);
    resetApiMetrics();
  });
});

test("observability endpoint requires an API key when auth is enforced", async () => {
  await withEnv({ ...quietLocalEnv, AUTH_REQUIRED: "true" }, async () => {
    const response = await observabilityGet(new Request("http://localhost/api/observability"));
    assert.equal(response.status, 401, "metrics must not be readable without credentials");
    const body = await response.json();
    assert.ok(!("metrics" in body), "auth failures must not include the snapshot");
  });
});

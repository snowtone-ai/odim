import assert from "node:assert/strict";
import test from "node:test";
import { sendSlackAlert } from "../lib/notifications/slack.ts";

function snapshotEnv() {
  return {
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL
  };
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("sendSlackAlert silently returns when SLACK_WEBHOOK_URL is not set", async () => {
  const prev = snapshotEnv();
  delete process.env.SLACK_WEBHOOK_URL;
  try {
    await assert.doesNotReject(() =>
      sendSlackAlert({
        title: "Test Alert",
        priority: "CRITICAL",
        confidence: 0.92,
        description: "Test description",
        source: "sec-edgar"
      })
    );
  } finally {
    restoreEnv(prev);
  }
});

test("sendSlackAlert sends correct JSON body and does not throw on fetch failure", async () => {
  const prev = snapshotEnv();
  const capturedBodies = [];
  const capturedUrls = [];

  // Override fetch to capture the call and simulate failure (connection refused)
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    capturedUrls.push(String(url));
    capturedBodies.push(JSON.parse(init.body));
    throw new Error("simulated network failure");
  };

  process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/T000/B000/fake";
  try {
    // Should not throw even when fetch fails
    await assert.doesNotReject(() =>
      sendSlackAlert({
        title: "Capital fixation detected",
        priority: "CRITICAL",
        confidence: 0.87,
        description: "SEC 8-K filing indicates capital commitment above threshold.",
        source: "sec-edgar"
      })
    );

    assert.equal(capturedUrls.length, 1, "fetch was called once");
    assert.equal(capturedUrls[0], "https://hooks.slack.test/T000/B000/fake");

    const body = capturedBodies[0];
    assert.ok(Array.isArray(body.attachments), "body has attachments array");
    const attachment = body.attachments[0];
    assert.ok(attachment.title.includes("[CRITICAL]"), "title includes priority");
    assert.ok(attachment.title.includes("Capital fixation detected"), "title includes alert title");
    assert.equal(attachment.color, "#dc2626", "CRITICAL maps to red color");
    assert.ok(attachment.text.includes("SEC 8-K"), "text includes description");
    assert.ok(attachment.fields.some((f) => f.title === "Confidence"), "has Confidence field");
    assert.ok(attachment.fields.some((f) => f.title === "Source"), "has Source field");
    assert.equal(attachment.footer, "Odim Reality Intelligence");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(prev);
  }
});

test("sendSlackAlert uses correct colors for each priority", async () => {
  const prev = snapshotEnv();
  const capturedColors = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_, init) => {
    const body = JSON.parse(init.body);
    capturedColors.push(body.attachments[0].color);
    throw new Error("simulated");
  };

  process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/test";
  try {
    const priorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    for (const priority of priorities) {
      await sendSlackAlert({ title: "t", priority, confidence: 0.5, description: "d", source: "s" });
    }
    assert.equal(capturedColors[0], "#dc2626", "CRITICAL = red");
    assert.equal(capturedColors[1], "#f59e0b", "HIGH = amber");
    assert.equal(capturedColors[2], "#3b82f6", "MEDIUM = blue");
    assert.equal(capturedColors[3], "#6b7280", "LOW = gray");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(prev);
  }
});

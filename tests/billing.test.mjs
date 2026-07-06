import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { plans, planIds, isPlanId, getPlan, purchasablePlanIds } from "../lib/billing/plans.ts";
import { verifyStripeWebhookSignature, billingEnabled, stripePriceIdForPlan } from "../lib/billing/stripe.ts";
import { isSubscriptionActive, isBillingStatus } from "../lib/repositories/billing.ts";
import { billingUpdateFromStripeEvent, POST as webhookPost } from "../app/api/billing/webhook/route.ts";
import { POST as checkoutPost } from "../app/api/billing/checkout/route.ts";

const testOrgId = "22222222-2222-4222-8222-222222222222";

function signedHeader(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

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

const billingDisabledEnv = {
  STRIPE_SECRET_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
  AUTH_REQUIRED: undefined,
  // Force local runtime with no Supabase persistence so fail-closed paths are deterministic.
  ENVIRONMENT: undefined,
  ODIM_RUNTIME_ENV: undefined,
  VERCEL_ENV: undefined,
  NEXT_PUBLIC_SUPABASE_URL: undefined,
  SUPABASE_URL: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined
};

test("plan catalog defines trial, pro, and enterprise with ascending entitlements", () => {
  assert.deepEqual([...planIds], ["trial", "pro", "enterprise"]);
  for (const id of planIds) {
    const plan = plans[id];
    assert.equal(plan.id, id);
    assert.ok(plan.entitlements.seats > 0);
    assert.ok(plan.entitlements.apiRequestsPerMinute > 0);
    assert.ok(plan.entitlements.huginnQueriesPerDay > 0);
    assert.ok(plan.entitlements.watchtowerConcurrentRuns > 0);
  }
  assert.ok(plans.trial.entitlements.apiRequestsPerMinute < plans.pro.entitlements.apiRequestsPerMinute);
  assert.ok(plans.pro.entitlements.apiRequestsPerMinute < plans.enterprise.entitlements.apiRequestsPerMinute);
  assert.ok(plans.trial.priceUsdMonthly === 0 && plans.pro.priceUsdMonthly < plans.enterprise.priceUsdMonthly);
  assert.ok(isPlanId("pro") && !isPlanId("free") && !isPlanId(null));
  assert.equal(getPlan("nonsense").id, "trial");
  assert.deepEqual([...purchasablePlanIds], ["pro", "enterprise"]);
});

test("stripe webhook signature verification accepts valid and rejects invalid signatures", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const now = Math.floor(Date.now() / 1000);

  assert.equal(verifyStripeWebhookSignature(body, signedHeader(body, secret, now), secret, now), true);
  assert.equal(verifyStripeWebhookSignature(body + "tampered", signedHeader(body, secret, now), secret, now), false);
  assert.equal(verifyStripeWebhookSignature(body, signedHeader(body, "whsec_wrong", now), secret, now), false);
  assert.equal(verifyStripeWebhookSignature(body, signedHeader(body, secret, now - 3600), secret, now), false, "stale timestamp must fail");
  assert.equal(verifyStripeWebhookSignature(body, "not-a-signature", secret, now), false);
  assert.equal(verifyStripeWebhookSignature(body, null, secret, now), false);
  assert.equal(verifyStripeWebhookSignature(body, signedHeader(body, secret, now), "", now), false);
});

test("billingUpdateFromStripeEvent maps checkout and subscription lifecycle events", () => {
  const completed = billingUpdateFromStripeEvent({
    type: "checkout.session.completed",
    data: {
      object: {
        client_reference_id: testOrgId,
        customer: "cus_123",
        subscription: "sub_123",
        metadata: { org_id: testOrgId, plan: "pro" }
      }
    }
  });
  assert.deepEqual(
    { orgId: completed.orgId, plan: completed.plan, status: completed.status },
    { orgId: testOrgId, plan: "pro", status: "active" }
  );

  const periodEnd = 1893456000;
  const updated = billingUpdateFromStripeEvent({
    type: "customer.subscription.updated",
    data: { object: { id: "sub_123", status: "past_due", current_period_end: periodEnd, metadata: { org_id: testOrgId, plan: "pro" } } }
  });
  assert.equal(updated.status, "past_due");
  assert.equal(updated.currentPeriodEnd, new Date(periodEnd * 1000).toISOString());

  const deleted = billingUpdateFromStripeEvent({
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_123", metadata: { org_id: testOrgId } } }
  });
  assert.equal(deleted.status, "canceled");

  assert.equal(
    billingUpdateFromStripeEvent({
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "not-a-uuid" } }
    }),
    undefined,
    "invalid org ids must be rejected"
  );
  assert.equal(billingUpdateFromStripeEvent({ type: "invoice.paid", data: { object: {} } }), undefined);
});

test("subscription activity gate blocks canceled subscriptions and expired trials", () => {
  assert.equal(isSubscriptionActive({ plan: "pro", status: "active" }), true);
  assert.equal(isSubscriptionActive({ plan: "pro", status: "past_due" }), true, "past_due keeps grace access");
  assert.equal(isSubscriptionActive({ plan: "pro", status: "canceled" }), false);
  assert.equal(isSubscriptionActive({ plan: "trial", status: "trialing" }), true, "open-ended trials stay active");
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(isSubscriptionActive({ plan: "trial", status: "trialing", trialEndsAt: past }), false);
  assert.equal(isSubscriptionActive({ plan: "trial", status: "trialing", trialEndsAt: future }), true);
  assert.ok(isBillingStatus("active") && !isBillingStatus("expired"));
});

test("checkout route validates plan and fails closed when billing is not configured", async () => {
  await withEnv(billingDisabledEnv, async () => {
    assert.equal(billingEnabled(), false);
    assert.equal(stripePriceIdForPlan("trial"), undefined);

    const badPlan = await checkoutPost(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "x-odim-org-id": testOrgId },
        body: JSON.stringify({ plan: "trial" })
      })
    );
    assert.equal(badPlan.status, 400);

    const noOrg = await checkoutPost(
      new Request("http://localhost/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: "pro" }) })
    );
    assert.equal(noOrg.status, 400);

    const disabled = await checkoutPost(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "x-odim-org-id": testOrgId },
        body: JSON.stringify({ plan: "pro" })
      })
    );
    assert.equal(disabled.status, 503);
    const body = await disabled.json();
    assert.match(body.error, /not enabled/i);
  });
});

test("webhook route fails closed without billing env and rejects bad signatures", async () => {
  await withEnv(billingDisabledEnv, async () => {
    const disabled = await webhookPost(new Request("http://localhost/api/billing/webhook", { method: "POST", body: "{}" }));
    assert.equal(disabled.status, 503);
  });

  await withEnv({ ...billingDisabledEnv, STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_test_secret" }, async () => {
    const unsigned = await webhookPost(new Request("http://localhost/api/billing/webhook", { method: "POST", body: "{}" }));
    assert.equal(unsigned.status, 400);

    const rawBody = JSON.stringify({ id: "evt_test", type: "invoice.paid", data: { object: {} } });
    const forged = await webhookPost(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": signedHeader(rawBody, "whsec_wrong") },
        body: rawBody
      })
    );
    assert.equal(forged.status, 400);

    // Correctly signed but no Supabase write env: persistence must fail closed.
    const signed = await webhookPost(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": signedHeader(rawBody, "whsec_test_secret") },
        body: rawBody
      })
    );
    assert.equal(signed.status, 503);
  });
});

test("stripe webhook is exempt from SSO middleware and migration 0012 is registered", () => {
  const middleware = readFileSync("proxy.ts", "utf8");
  assert.match(middleware, /\/api\/billing\/webhook/);

  const runner = readFileSync("scripts/apply-db-migrations.mjs", "utf8");
  assert.match(runner, /0012_billing_entitlements\.sql/);

  const migration = readFileSync("supabase/migrations/0012_billing_entitlements.sql", "utf8");
  assert.match(migration, /alter table org_billing enable row level security/);
  assert.match(migration, /alter table billing_events enable row level security/);
  assert.match(migration, /stripe_event_id text not null unique/);
});

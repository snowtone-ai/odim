import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanId } from "./plans.ts";

const STRIPE_API_BASE = "https://api.stripe.com";
const STRIPE_TIMEOUT_MS = 10_000;

export function stripeSecretConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function stripeWebhookConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.STRIPE_WEBHOOK_SECRET);
}

/** Billing is opt-in per environment: both Stripe secrets must be present. */
export function billingEnabled(env: NodeJS.ProcessEnv = process.env) {
  return stripeSecretConfigured(env) && stripeWebhookConfigured(env);
}

export function stripePriceIdForPlan(plan: PlanId, env: NodeJS.ProcessEnv = process.env) {
  if (plan === "pro") return env.STRIPE_PRICE_PRO;
  if (plan === "enterprise") return env.STRIPE_PRICE_ENTERPRISE;
  return undefined;
}

export type CheckoutSession = {
  id: string;
  url: string;
};

export async function createCheckoutSession(input: {
  orgId: string;
  plan: PlanId;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  const priceId = stripePriceIdForPlan(input.plan);
  if (!priceId) throw new Error(`Stripe price id for plan ${input.plan} is not configured`);

  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.orgId,
    "metadata[org_id]": input.orgId,
    "metadata[plan]": input.plan,
    "subscription_data[metadata][org_id]": input.orgId,
    "subscription_data[metadata][plan]": input.plan
  });

  const response = await fetch(`${STRIPE_API_BASE}/v1/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS)
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const detail = (payload.error as Record<string, unknown> | undefined)?.message;
    throw new Error(`Stripe checkout session failed (${response.status})${detail ? `: ${String(detail)}` : ""}`);
  }
  if (typeof payload.id !== "string" || typeof payload.url !== "string") {
    throw new Error("Stripe checkout session response is missing id or url");
  }
  return { id: payload.id, url: payload.url };
}

const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Verifies a Stripe webhook signature header (t=timestamp,v1=hex HMAC-SHA256 of
 * `${timestamp}.${rawBody}`) with a replay-window tolerance. Pure so it is
 * directly testable without network access.
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = new Map<string, string[]>();
  for (const segment of signatureHeader.split(",")) {
    const [key, value] = segment.split("=", 2).map((part) => part?.trim());
    if (!key || !value) continue;
    const existing = parts.get(key) ?? [];
    existing.push(value);
    parts.set(key, existing);
  }
  const timestamp = Number(parts.get("t")?.[0]);
  const candidates = parts.get("v1") ?? [];
  if (!Number.isFinite(timestamp) || candidates.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return candidates.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "utf8");
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

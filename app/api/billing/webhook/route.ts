import { isPlanId, type PlanId } from "../../../../lib/billing/plans.ts";
import { billingEnabled, verifyStripeWebhookSignature } from "../../../../lib/billing/stripe.ts";
import {
  isBillingStatus,
  recordBillingEvent,
  releaseBillingEvent,
  resetBillingEntitlementCache,
  upsertOrgBilling,
  type BillingStatus
} from "../../../../lib/repositories/billing.ts";
import { hasSupabaseWriteEnv } from "../../../../lib/supabase/client.ts";

export const dynamic = "force-dynamic";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function mapStripeSubscriptionStatus(status: string | undefined): BillingStatus {
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "canceled";
}

type BillingUpdate = Parameters<typeof upsertOrgBilling>[0];

/**
 * Maps a verified Stripe event to an org_billing update, or undefined when the
 * event type is not billing-relevant or lacks a valid org reference. Exported
 * for direct unit testing; never trusts unvalidated ids.
 */
export function billingUpdateFromStripeEvent(event: Record<string, unknown>): BillingUpdate | undefined {
  const type = stringField(event.type);
  const object = ((event.data as Record<string, unknown> | undefined)?.object ?? {}) as Record<string, unknown>;
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const metadataPlan = stringField(metadata.plan);
  const plan: PlanId | undefined = isPlanId(metadataPlan) ? metadataPlan : undefined;

  if (type === "checkout.session.completed") {
    const orgId = stringField(object.client_reference_id) ?? stringField(metadata.org_id);
    if (!orgId || !uuidV4Pattern.test(orgId)) return undefined;
    return {
      orgId,
      plan,
      status: "active",
      stripeCustomerId: stringField(object.customer),
      stripeSubscriptionId: stringField(object.subscription)
    };
  }

  if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    const orgId = stringField(metadata.org_id);
    if (!orgId || !uuidV4Pattern.test(orgId)) return undefined;
    const status =
      type === "customer.subscription.deleted" ? "canceled" : mapStripeSubscriptionStatus(stringField(object.status));
    if (!isBillingStatus(status)) return undefined;
    const periodEnd = typeof object.current_period_end === "number" ? object.current_period_end : undefined;
    return {
      orgId,
      plan,
      status,
      stripeCustomerId: stringField(object.customer),
      stripeSubscriptionId: stringField(object.id),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined
    };
  }

  return undefined;
}

export async function POST(request: Request) {
  try {
    if (!billingEnabled()) {
      return Response.json({ error: "Billing is not enabled in this environment" }, { status: 503 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    if (!verifyStripeWebhookSignature(rawBody, signature, secret)) {
      return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
    }
    const eventId = stringField(event.id);
    const eventType = stringField(event.type);
    if (!eventId || !eventType) {
      return Response.json({ error: "Webhook event id and type are required" }, { status: 400 });
    }
    if (!hasSupabaseWriteEnv()) {
      return Response.json({ error: "Billing persistence is not configured" }, { status: 503 });
    }

    const update = billingUpdateFromStripeEvent(event);
    const firstDelivery = await recordBillingEvent({ stripeEventId: eventId, eventType, orgId: update?.orgId });
    if (!firstDelivery) {
      return Response.json({ received: true, duplicate: true });
    }
    if (!update) {
      // Signature-verified but not billing-relevant (or missing org metadata):
      // acknowledge so Stripe does not retry, and leave the audit row in place.
      return Response.json({ received: true, ignored: true });
    }

    try {
      await upsertOrgBilling(update);
    } catch (error) {
      // Undo the idempotency record so Stripe's retry can re-apply the update;
      // if the release also fails, the event stays recorded and the loss is logged.
      await releaseBillingEvent(eventId).catch((releaseError) => {
        console.error("billing webhook could not release event after failed upsert", eventId, releaseError);
      });
      throw error;
    }
    resetBillingEntitlementCache();
    return Response.json({ received: true });
  } catch (error) {
    console.error("billing webhook route failed", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

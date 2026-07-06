import { getPlan, isPlanId, type PlanId } from "../billing/plans.ts";
import {
  createServerSupabaseReadClient,
  createServiceSupabaseClient,
  hasSupabaseReadEnv,
  hasSupabaseWriteEnv
} from "../supabase/client.ts";

export type BillingStatus = "trialing" | "active" | "past_due" | "canceled";

export type OrgBillingState = {
  orgId?: string;
  plan: PlanId;
  status: BillingStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  source: "supabase" | "default" | "local";
};

const billingStatuses: readonly BillingStatus[] = ["trialing", "active", "past_due", "canceled"];

export function isBillingStatus(value: unknown): value is BillingStatus {
  return typeof value === "string" && (billingStatuses as readonly string[]).includes(value);
}

/**
 * Whether the org may use paid surfaces. Canceled subscriptions and expired
 * trials are blocked; past_due keeps access (dunning grace) until Stripe
 * transitions the subscription to canceled.
 */
export function isSubscriptionActive(state: Pick<OrgBillingState, "plan" | "status" | "trialEndsAt">, now = new Date()): boolean {
  if (state.status === "canceled") return false;
  if (state.plan === "trial" && state.trialEndsAt) {
    return new Date(state.trialEndsAt).getTime() > now.getTime();
  }
  return true;
}

function defaultState(orgId?: string): OrgBillingState {
  return { orgId, plan: "trial", status: "trialing", source: "default" };
}

/** Local development stays free and fully open when Supabase is not configured. */
function localState(orgId?: string): OrgBillingState {
  return { orgId, plan: "enterprise", status: "active", source: "local" };
}

function toState(orgId: string, row: Record<string, unknown>): OrgBillingState {
  return {
    orgId,
    plan: isPlanId(row.plan) ? row.plan : "trial",
    status: isBillingStatus(row.status) ? row.status : "trialing",
    stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : undefined,
    stripeSubscriptionId: row.stripe_subscription_id ? String(row.stripe_subscription_id) : undefined,
    currentPeriodEnd: row.current_period_end ? String(row.current_period_end) : undefined,
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : undefined,
    source: "supabase"
  };
}

export async function getOrgBilling(orgId?: string): Promise<OrgBillingState> {
  if (!hasSupabaseReadEnv()) return localState(orgId);
  if (!orgId) return defaultState(orgId);
  const { data, error } = await createServerSupabaseReadClient()
    .from("org_billing")
    .select("plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, trial_ends_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(`org billing read failed: ${error.message}`);
  if (!data) return defaultState(orgId);
  return toState(orgId, data as Record<string, unknown>);
}

export type OrgBillingUpsert = {
  orgId: string;
  plan?: PlanId;
  status: BillingStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
};

export async function upsertOrgBilling(input: OrgBillingUpsert): Promise<void> {
  if (!hasSupabaseWriteEnv()) {
    throw new Error("Supabase write environment is required for billing updates");
  }
  const row: Record<string, unknown> = {
    org_id: input.orgId,
    status: input.status
  };
  if (input.plan) row.plan = input.plan;
  if (input.stripeCustomerId) row.stripe_customer_id = input.stripeCustomerId;
  if (input.stripeSubscriptionId) row.stripe_subscription_id = input.stripeSubscriptionId;
  if (input.currentPeriodEnd) row.current_period_end = input.currentPeriodEnd;
  if (input.trialEndsAt) row.trial_ends_at = input.trialEndsAt;
  const { error } = await createServiceSupabaseClient().from("org_billing").upsert(row, { onConflict: "org_id" });
  if (error) throw new Error(`org billing upsert failed: ${error.message}`);
}

/**
 * Records a Stripe webhook event id append-only. Returns false when the event
 * was already processed (unique violation), making webhook handling idempotent.
 */
export async function recordBillingEvent(input: { stripeEventId: string; eventType: string; orgId?: string }): Promise<boolean> {
  if (!hasSupabaseWriteEnv()) {
    throw new Error("Supabase write environment is required for billing events");
  }
  const { error } = await createServiceSupabaseClient().from("billing_events").insert({
    stripe_event_id: input.stripeEventId,
    event_type: input.eventType,
    org_id: input.orgId ?? null
  });
  if (error) {
    if (error.code === "23505") return false;
    throw new Error(`billing event insert failed: ${error.message}`);
  }
  return true;
}

/**
 * Compensating delete for a recorded billing event whose state update failed.
 * Lets Stripe's retry re-process the event instead of hitting the idempotency
 * guard and silently dropping the update.
 */
export async function releaseBillingEvent(stripeEventId: string): Promise<void> {
  if (!hasSupabaseWriteEnv()) return;
  const { error } = await createServiceSupabaseClient().from("billing_events").delete().eq("stripe_event_id", stripeEventId);
  if (error) throw new Error(`billing event release failed: ${error.message}`);
}

/**
 * Cached entitlement resolution for the per-request auth gate. A short TTL
 * keeps webhook-driven plan changes visible within a minute without adding a
 * Supabase read to every API request.
 */
const entitlementCacheTtlMs = 60_000;
const entitlementCache = new Map<string, { state: OrgBillingState; expiresAt: number }>();

export function resetBillingEntitlementCache() {
  entitlementCache.clear();
}

export async function getCachedOrgBilling(orgId: string, now = Date.now()): Promise<OrgBillingState> {
  const cached = entitlementCache.get(orgId);
  if (cached && cached.expiresAt > now) return cached.state;
  const state = await getOrgBilling(orgId);
  entitlementCache.set(orgId, { state, expiresAt: now + entitlementCacheTtlMs });
  return state;
}

export function billingEnforced(env: NodeJS.ProcessEnv = process.env) {
  return env.BILLING_ENFORCED === "true";
}

export { getPlan };

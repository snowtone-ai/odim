import { checkRequestRateLimit } from "../../../../lib/api/rate-limit.ts";
import { authorizeApiRequest } from "../../../../lib/auth/request.ts";
import { isPlanId, purchasablePlanIds } from "../../../../lib/billing/plans.ts";
import { billingEnabled, createCheckoutSession } from "../../../../lib/billing/stripe.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const rateLimit = checkRequestRateLimit(auth.context.orgId, "billing:checkout", { maxRequests: 10, windowMs: 60_000 });
    if (!rateLimit.ok) {
      return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const plan = body.plan;
    if (!isPlanId(plan) || !(purchasablePlanIds as readonly string[]).includes(plan)) {
      return Response.json({ error: `plan must be one of: ${purchasablePlanIds.join(", ")}` }, { status: 400 });
    }
    const orgId = auth.context.orgId;
    if (!orgId) {
      return Response.json({ error: "An org context is required to start checkout" }, { status: 400 });
    }
    if (!billingEnabled()) {
      return Response.json({ error: "Billing is not enabled in this environment" }, { status: 503 });
    }

    // Redirect targets are never taken from the request body. Prefer the
    // configured public app URL; request origin can be an internal host behind
    // a reverse proxy.
    const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    const origin = configured || new URL(request.url).origin;
    const session = await createCheckoutSession({
      orgId,
      plan,
      successUrl: `${origin}/settings?billing=success`,
      cancelUrl: `${origin}/settings?billing=canceled`
    });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("billing checkout route failed", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

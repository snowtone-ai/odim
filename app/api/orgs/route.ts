import { checkRequestRateLimit, clientIpFromRequest } from "../../../lib/api/rate-limit.ts";
import { issueSsoSession, ssoCookieName, ssoEnabled } from "../../../lib/auth/sso.ts";
import { normalizeInviteEmail } from "../../../lib/onboarding/invites.ts";
import { normalizeDisplayName, normalizeOrgName, selfServeSignupEnabled } from "../../../lib/onboarding/signup.ts";
import { createOrgWithAdmin } from "../../../lib/repositories/onboarding.ts";

export async function POST(request: Request) {
  try {
    // Per-client plus global ceilings: spoofed client IPs cannot scale abuse
    // past the instance-wide bucket.
    const rateLimit = checkRequestRateLimit(clientIpFromRequest(request), "org-signup", { maxRequests: 5, windowMs: 3_600_000 });
    const globalLimit = checkRequestRateLimit("global", "org-signup-global", { maxRequests: 30, windowMs: 3_600_000 });
    if (!rateLimit.ok || !globalLimit.ok) {
      const retryAfter = Math.max(rateLimit.retryAfter, globalLimit.retryAfter);
      return Response.json(
        { error: "Too many signup attempts" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    if (!selfServeSignupEnabled()) {
      return Response.json({ error: "Self-serve signup is not enabled" }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as { orgName?: string; email?: string; displayName?: string };
    const name = normalizeOrgName(body.orgName);
    if (!name) return Response.json({ error: "orgName must be 2-80 characters" }, { status: 400 });
    const email = normalizeInviteEmail(body.email);
    if (!email) return Response.json({ error: "a valid email is required" }, { status: 400 });

    const created = await createOrgWithAdmin({ name, email, displayName: normalizeDisplayName(body.displayName, email) });
    const headers = new Headers({ "Content-Type": "application/json" });
    if (ssoEnabled()) {
      const session = await issueSsoSession({ email, orgId: created.org.id, provider: "selfserve" });
      headers.set(
        "Set-Cookie",
        `${ssoCookieName()}=${session}; Path=/; Max-Age=${12 * 60 * 60}; HttpOnly; Secure; SameSite=Lax`
      );
    }
    return new Response(
      JSON.stringify({
        source: created.source,
        orgId: created.org.id,
        orgName: created.org.name,
        trialEndsAt: created.trialEndsAt,
        admin: {
          id: created.admin.id,
          email: created.admin.email,
          displayName: created.admin.displayName,
          role: created.admin.role
        }
      }),
      { status: 201, headers }
    );
  } catch (err) {
    // Public endpoint: never echo internal error details to unauthenticated clients.
    console.error("[orgs] signup failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

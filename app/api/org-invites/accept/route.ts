import { checkRequestRateLimit, clientIpFromRequest } from "../../../../lib/api/rate-limit.ts";
import { issueSsoSession, ssoCookieName, ssoEnabled } from "../../../../lib/auth/sso.ts";
import { acceptInvite } from "../../../../lib/repositories/onboarding.ts";

export async function POST(request: Request) {
  try {
    // Per-client plus global ceilings: spoofed client IPs cannot scale abuse
    // past the instance-wide bucket.
    const rateLimit = checkRequestRateLimit(clientIpFromRequest(request), "invite-accept", { maxRequests: 10, windowMs: 60_000 });
    const globalLimit = checkRequestRateLimit("global", "invite-accept-global", { maxRequests: 100, windowMs: 60_000 });
    if (!rateLimit.ok || !globalLimit.ok) {
      const retryAfter = Math.max(rateLimit.retryAfter, globalLimit.retryAfter);
      return Response.json(
        { error: "Too many attempts" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    const body = (await request.json().catch(() => ({}))) as { token?: string; displayName?: string };
    if (!body.token || typeof body.token !== "string") {
      return Response.json({ error: "token is required" }, { status: 400 });
    }

    let result;
    try {
      result = await acceptInvite({ token: body.token, displayName: body.displayName });
    } catch (error) {
      if (error instanceof Error && /API_KEY_PEPPER/.test(error.message)) {
        return Response.json({ error: "Invite acceptance is not configured" }, { status: 503 });
      }
      throw error;
    }
    // A single generic failure keeps revoked/expired/unknown tokens indistinguishable.
    if (!result.ok) return Response.json({ error: "Invalid or expired invite" }, { status: 401 });

    const headers = new Headers({ "Content-Type": "application/json" });
    if (ssoEnabled()) {
      const session = await issueSsoSession({ email: result.email, orgId: result.orgId, provider: "selfserve" });
      headers.set(
        "Set-Cookie",
        `${ssoCookieName()}=${session}; Path=/; Max-Age=${12 * 60 * 60}; HttpOnly; Secure; SameSite=Lax`
      );
    }
    return new Response(JSON.stringify({ orgId: result.orgId, role: result.role }), { status: 200, headers });
  } catch (err) {
    // Public endpoint: never echo internal error details to unauthenticated clients.
    console.error("[org-invites] accept failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

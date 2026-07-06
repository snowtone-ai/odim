import { checkRequestRateLimit } from "../../../../lib/api/rate-limit.ts";
import { issueSsoSession, ssoCookieName, ssoEnabled } from "../../../../lib/auth/sso.ts";
import { acceptInvite } from "../../../../lib/repositories/onboarding.ts";

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  try {
    const rateLimit = checkRequestRateLimit(clientIp(request), "invite-accept", { maxRequests: 10, windowMs: 60_000 });
    if (!rateLimit.ok) {
      return Response.json(
        { error: "Too many attempts" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
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
    return Response.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

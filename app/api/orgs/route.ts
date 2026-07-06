import { checkRequestRateLimit } from "../../../lib/api/rate-limit.ts";
import { issueSsoSession, ssoCookieName, ssoEnabled } from "../../../lib/auth/sso.ts";
import { normalizeInviteEmail } from "../../../lib/onboarding/invites.ts";
import { normalizeDisplayName, normalizeOrgName, selfServeSignupEnabled } from "../../../lib/onboarding/signup.ts";
import { createOrgWithAdmin } from "../../../lib/repositories/onboarding.ts";

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  try {
    const rateLimit = checkRequestRateLimit(clientIp(request), "org-signup", { maxRequests: 5, windowMs: 3_600_000 });
    if (!rateLimit.ok) {
      return Response.json(
        { error: "Too many signup attempts" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
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
    return Response.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

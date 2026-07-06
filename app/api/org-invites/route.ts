import { checkRequestRateLimit } from "../../../lib/api/rate-limit.ts";
import { authorizeApiRequest } from "../../../lib/auth/request.ts";
import { isOrgInviteRole, normalizeInviteEmail } from "../../../lib/onboarding/invites.ts";
import { createInvite, listInvites, revokeInvite } from "../../../lib/repositories/onboarding.ts";

export async function GET(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:read");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const rateLimit = checkRequestRateLimit(auth.context.orgId, "org-invites", { maxRequests: 10, windowMs: 60_000 });
    if (!rateLimit.ok) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }
    return Response.json({ invites: await listInvites(auth.context) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const rateLimit = checkRequestRateLimit(auth.context.orgId, "org-invites", { maxRequests: 10, windowMs: 60_000 });
    if (!rateLimit.ok) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }
    const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string; invitedBy?: string };
    const email = normalizeInviteEmail(body.email);
    if (!email) return Response.json({ error: "a valid email is required" }, { status: 400 });
    const role = body.role ?? "analyst";
    if (!isOrgInviteRole(role)) return Response.json({ error: "role must be analyst or admin" }, { status: 400 });

    const result = await createInvite(auth.context, {
      email,
      role,
      // Audit metadata only; capped so arbitrary payloads cannot inflate rows.
      invitedBy: typeof body.invitedBy === "string" ? body.invitedBy.slice(0, 80) : undefined
    });
    if (!result.ok) {
      return Response.json({ error: "Seat limit reached for the current plan" }, { status: 403 });
    }
    return Response.json({ source: result.source, token: result.token, invite: result.invite }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const rateLimit = checkRequestRateLimit(auth.context.orgId, "org-invites", { maxRequests: 10, windowMs: 60_000 });
    if (!rateLimit.ok) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    if (!body.id) return Response.json({ error: "id is required" }, { status: 400 });
    return Response.json(await revokeInvite(auth.context, { id: body.id }));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

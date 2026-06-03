import { checkRequestRateLimit } from "@/lib/api/rate-limit";
import { authorizeApiRequest } from "@/lib/auth/request";
import { queryRealityEvidenceGraph } from "@/lib/repositories/evidence-graph";

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function allowsAuthDisabledOrgOverride() {
  return process.env.GRAPHRAG_ALLOW_AUTH_DISABLED_ORG_OVERRIDE === "true";
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "entities:read");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const rateLimit = checkRequestRateLimit(auth.context.orgId, "graphrag", { maxRequests: 30, windowMs: 60_000 });
    if (!rateLimit.ok) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const orgId = cleanString(body.orgId, 80) ?? auth.context.orgId;
    if (auth.mode !== "disabled" && body.orgId && orgId !== auth.context.orgId) {
      return Response.json({ error: "orgId override is not allowed" }, { status: 403 });
    }
    if (auth.mode === "disabled" && body.orgId && orgId !== auth.context.orgId && !allowsAuthDisabledOrgOverride()) {
      console.warn("graphrag orgId override blocked while auth is disabled", { requestedOrgId: orgId });
      return Response.json({ error: "orgId override requires GRAPHRAG_ALLOW_AUTH_DISABLED_ORG_OVERRIDE=true" }, { status: 403 });
    }
    if (auth.mode !== "disabled" && !orgId) {
      return Response.json({ error: "orgId is required" }, { status: 403 });
    }
    const question = cleanString(body.question, 2000);
    const entityId = cleanString(body.entityId, 120);
    const alertId = cleanString(body.alertId, 120);
    if (!question && !entityId && !alertId) {
      return Response.json({ error: "question, entityId, or alertId is required" }, { status: 400 });
    }
    const limit = Math.min(12, Math.max(1, Number(body.limit ?? 5)));
    const result = await queryRealityEvidenceGraph({ question, entityId, alertId, limit }, { orgId });
    return Response.json(result);
  } catch (error) {
    console.error("graphrag query route failed", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

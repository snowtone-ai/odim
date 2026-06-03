import { checkRequestRateLimit } from "@/lib/api/rate-limit";
import { authorizeApiRequest } from "@/lib/auth/request";
import { updateWatchtowerApproval } from "@/lib/repositories/watchtower";

function stringValue(value: unknown, maxLength = 160) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const rateLimit = checkRequestRateLimit(auth.context.orgId, "watchtower:approval", { maxRequests: 30, windowMs: 60_000 });
    if (!rateLimit.ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const runId = stringValue(body.runId);
    const approvalId = stringValue(body.approvalId);
    const decision = stringValue(body.decision, 20);
    if (!runId || !approvalId || (decision !== "approve" && decision !== "reject")) {
      return Response.json({ error: "runId, approvalId, and decision=approve|reject are required" }, { status: 400 });
    }
    const run = await updateWatchtowerApproval(
      {
        runId,
        approvalId,
        decision,
        actor: stringValue(body.actor) ?? "api",
        note: stringValue(body.note, 500)
      },
      auth.context
    );
    return Response.json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: /not found/i.test(message) ? 404 : 500 });
  }
}

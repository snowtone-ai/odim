import { checkRequestRateLimit } from "@/lib/api/rate-limit";
import { authorizeApiRequest } from "@/lib/auth/request";
import { rerunWatchtower } from "@/lib/repositories/watchtower";

function stringValue(value: unknown, maxLength = 160) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const rateLimit = checkRequestRateLimit(auth.context.orgId, "watchtower:rerun", { maxRequests: 20, windowMs: 60_000 });
    if (!rateLimit.ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const runId = stringValue(body.runId);
    if (!runId) return Response.json({ error: "runId is required" }, { status: 400 });
    const run = await rerunWatchtower({ runId, actor: stringValue(body.actor) ?? "api" }, auth.context);
    return Response.json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: /not found/i.test(message) ? 404 : 500 });
  }
}

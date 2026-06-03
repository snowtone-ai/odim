import { checkRequestRateLimit } from "@/lib/api/rate-limit";
import { authorizeApiRequest } from "@/lib/auth/request";
import { listWatchtowerPlaybooks, listWatchtowerRuns, startWatchtowerRun } from "@/lib/repositories/watchtower";

function stringValue(value: unknown, maxLength = 120) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "alerts:read");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const rateLimit = checkRequestRateLimit(auth.context.orgId, "watchtower:runs", { maxRequests: 60, windowMs: 60_000 });
    if (!rateLimit.ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } });
    const payload = await listWatchtowerRuns(auth.context);
    return Response.json({
      runs: payload.runs,
      playbooks: listWatchtowerPlaybooks(),
      source: payload.source
    });
  } catch (error) {
    console.error("watchtower runs route failed", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const rateLimit = checkRequestRateLimit(auth.context.orgId, "watchtower:start", { maxRequests: 20, windowMs: 60_000 });
    if (!rateLimit.ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const playbookId = stringValue(body.playbookId);
    if (!playbookId) return Response.json({ error: "playbookId is required" }, { status: 400 });
    const orgId = stringValue(body.orgId, 80) ?? auth.context.orgId;
    if (auth.mode !== "disabled" && body.orgId && orgId !== auth.context.orgId) {
      return Response.json({ error: "orgId override is not allowed" }, { status: 403 });
    }
    const run = await startWatchtowerRun(
      {
        playbookId,
        alertId: stringValue(body.alertId),
        orgId,
        actor: stringValue(body.actor) ?? "api"
      },
      { orgId }
    );
    return Response.json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: /Unknown|No alert|not found/i.test(message) ? 400 : 500 });
  }
}

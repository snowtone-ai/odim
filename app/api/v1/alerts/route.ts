import { jsonApiResponse, parsePagination, authorizeV1Request, enforceV1RateLimit } from "@/lib/api/v1-router";
import { listAlerts } from "@/lib/repositories/reality";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await authorizeV1Request(request, "alerts:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rl = enforceV1RateLimit(auth.context.orgId, "alerts");
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
    const url = new URL(request.url);
    const { page, perPage } = parsePagination(url);
    const priority = url.searchParams.get("priority")?.toLowerCase();
    const payload = await listAlerts(auth.context);
    const rows = payload.alerts.filter((alert) => (!priority || alert.priority.toLowerCase() === priority));
    return jsonApiResponse(url, rows, page, perPage);
  } catch (error) {
    console.error("v1 alerts route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

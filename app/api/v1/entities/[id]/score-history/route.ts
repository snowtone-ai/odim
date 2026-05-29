import { authorizeV1Request, enforceV1RateLimit } from "@/lib/api/v1-router";
import { getEntityScoreHistory } from "@/lib/repositories/reality";
import { NextResponse } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorizeV1Request(request, "entities:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rl = enforceV1RateLimit(auth.context.orgId, "entity-history");
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
    const params = await context.params;
    const url = new URL(request.url);
    const days = Math.min(365, Math.max(7, Number(url.searchParams.get("days") ?? "30")));
    const history = await getEntityScoreHistory(params.id, days, auth.context);
    return NextResponse.json({
      data: history,
      meta: { total: history.length, page: 1, per_page: history.length, timestamp: new Date().toISOString() },
      links: { next: null, prev: null }
    });
  } catch (error) {
    console.error("v1 entity history route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

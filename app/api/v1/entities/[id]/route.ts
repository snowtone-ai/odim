import { authorizeV1Request, enforceV1RateLimit } from "@/lib/api/v1-router";
import { getEntityDetail } from "@/lib/repositories/reality";
import { NextResponse } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorizeV1Request(request, "entities:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rl = enforceV1RateLimit(auth.context.orgId, "entity-detail");
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
    const params = await context.params;
    const entity = await getEntityDetail(params.id, auth.context);
    if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: entity, meta: { timestamp: new Date().toISOString() } });
  } catch (error) {
    console.error("v1 entity detail route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

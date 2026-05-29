import { jsonApiResponse, parsePagination, authorizeV1Request, enforceV1RateLimit } from "@/lib/api/v1-router";
import { listEntities } from "@/lib/repositories/reality";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await authorizeV1Request(request, "entities:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rl = enforceV1RateLimit(auth.context.orgId, "entities");
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
    const url = new URL(request.url);
    const { page, perPage } = parsePagination(url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const minScore = Number(url.searchParams.get("min_score") ?? "0");
    const payload = await listEntities(auth.context);
    const rows = payload.entities
      .filter((entity) => (!q ? true : entity.name.toLowerCase().includes(q)))
      .filter((entity) => entity.score >= minScore);
    return jsonApiResponse(url, rows, page, perPage);
  } catch (error) {
    console.error("v1 entities route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { enforceV1RateLimit, authorizeV1Request, parsePagination, paginateRows, buildLinks } from "@/lib/api/v1-router";
import { instrumentApiRoute } from "@/lib/observability/instrument";
import { listWatchtowerRuns } from "@/lib/repositories/watchtower";
import { NextResponse } from "next/server";

async function handleGet(request: Request) {
  try {
    const auth = await authorizeV1Request(request, "alerts:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rl = enforceV1RateLimit(auth.context.orgId, "watchtower-runs");
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
    const url = new URL(request.url);
    const { page, perPage } = parsePagination(url);
    const status = url.searchParams.get("status");
    const payload = await listWatchtowerRuns(auth.context);
    const rows = payload.runs.filter((run) => !status || run.status === status);
    return NextResponse.json({
      data: paginateRows(rows, page, perPage),
      meta: {
        total: rows.length,
        page,
        per_page: perPage,
        timestamp: new Date().toISOString(),
        source: payload.source
      },
      links: buildLinks(url, page, perPage, rows.length)
    });
  } catch (error) {
    console.error("v1 watchtower runs route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = instrumentApiRoute("v1/watchtower-runs", handleGet);

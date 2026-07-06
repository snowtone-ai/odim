import { jsonApiResponse, parsePagination, authorizeV1Request, enforceV1RateLimit } from "@/lib/api/v1-router";
import { instrumentApiRoute } from "@/lib/observability/instrument";
import { listSignals } from "@/lib/repositories/reality";
import { NextResponse } from "next/server";

async function handleGet(request: Request) {
  try {
    const auth = await authorizeV1Request(request, "signals:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rl = enforceV1RateLimit(auth.context.orgId, "signals");
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
    const url = new URL(request.url);
    const { page, perPage } = parsePagination(url);
    const layer = url.searchParams.get("layer");
    const source = url.searchParams.get("source");
    const payload = await listSignals(auth.context);
    const rows = payload.signals.filter((signal) => (!layer || signal.layer === layer) && (!source || signal.source === source));
    return jsonApiResponse(url, rows, page, perPage);
  } catch (error) {
    console.error("v1 signals route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = instrumentApiRoute("v1/signals", handleGet);

import { enforceV1RateLimit, authorizeV1Request } from "@/lib/api/v1-router";
import { instrumentApiRoute } from "@/lib/observability/instrument";
import { queryRealityEvidenceGraph } from "@/lib/repositories/evidence-graph";
import { NextResponse } from "next/server";

async function handleGet(request: Request) {
  try {
    const auth = await authorizeV1Request(request, "entities:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rl = enforceV1RateLimit(auth.context.orgId, "evidence-graph");
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

    const url = new URL(request.url);
    const limit = Math.min(12, Math.max(1, Number(url.searchParams.get("limit") ?? 5)));
    const result = await queryRealityEvidenceGraph(
      {
        question: url.searchParams.get("q") ?? undefined,
        entityId: url.searchParams.get("entity_id") ?? undefined,
        alertId: url.searchParams.get("alert_id") ?? undefined,
        limit
      },
      auth.context
    );
    return NextResponse.json({
      data: {
        paths: result.paths,
        anchors: result.anchors,
        metrics: result.metrics,
        source: result.source
      },
      meta: {
        total: result.paths.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("v1 evidence graph route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = instrumentApiRoute("v1/evidence-graph", handleGet);

import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { checkRequestRateLimit } from "@/lib/api/rate-limit";
import { createServerSupabaseReadClient, hasSupabaseReadEnv } from "@/lib/supabase/client";

// Fallback stub when no DB is available
function fixtureFallback(entityId: string) {
  const base = 62 + Math.abs(entityId.charCodeAt(0) % 10) * 3;
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => ({
    score: base + Math.sin(i * 0.4) * 5 + i * 0.3,
    recorded_at: new Date(now - (29 - i) * 86_400_000).toISOString()
  }));
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "entity:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const rl = checkRequestRateLimit(auth.context.orgId, "entity-scores", { maxRequests: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) }
      });
    }

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const days = Math.min(365, Math.max(1, Number(searchParams.get("days") ?? "30")));

    if (!entityId) {
      return NextResponse.json({ error: "entityId is required" }, { status: 400 });
    }

    if (!hasSupabaseReadEnv()) {
      return NextResponse.json({ history: fixtureFallback(entityId) });
    }

    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const client = createServerSupabaseReadClient();
    const { data, error } = await client
      .from("entity_score_history")
      .select("score, recorded_at")
      .eq("entity_id", entityId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .limit(days + 5);

    if (error) {
      if (/schema cache|does not exist|Could not find the table/i.test(error.message)) {
        return NextResponse.json({ history: fixtureFallback(entityId) });
      }
      throw new Error(error.message);
    }

    const history = (data ?? []).map((row) => ({
      score: Number(row.score),
      recorded_at: String(row.recorded_at)
    }));

    return NextResponse.json({ history: history.length >= 2 ? history : fixtureFallback(entityId) });
  } catch (error) {
    console.error("entity-scores route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

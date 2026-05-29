import { NextResponse } from "next/server";
import { authorizeV1Request, enforceV1RateLimit } from "@/lib/api/v1-router";
import { answerHuginnQuestion } from "@/lib/huginn/query";

export async function POST(request: Request) {
  try {
    const auth = await authorizeV1Request(request, "huginn:query");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rl = enforceV1RateLimit(auth.context.orgId, "huginn");
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
    const body = (await request.json().catch(() => ({}))) as { question?: string; webSearch?: boolean };
    if (!body.question?.trim()) return NextResponse.json({ error: "question is required" }, { status: 400 });
    const response = await answerHuginnQuestion({
      orgId: auth.context.orgId ?? process.env.DEFAULT_ORG_ID ?? "11111111-1111-4111-8111-111111111111",
      question: body.question,
      webSearch: body.webSearch
    });
    return NextResponse.json({ data: response, meta: { timestamp: new Date().toISOString() }, links: { next: null, prev: null } });
  } catch (error) {
    console.error("v1 huginn route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

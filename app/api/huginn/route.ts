import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { answerHuginnQuestion } from "@/lib/huginn/query";

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "huginn:query");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = (await request.json().catch(() => ({}))) as { question?: string; orgId?: string; userId?: string };
    if (!body.question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }
    const orgId = auth.context.orgId ?? body.orgId;
    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const result = await answerHuginnQuestion({
      orgId,
      question: body.question,
      userId: body.userId
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

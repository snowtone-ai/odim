import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { answerHuginnQuestion } from "@/lib/huginn/query";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "huginn:query");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = (await request.json().catch(() => ({}))) as { question?: string; orgId?: string; userId?: string };
    if (!body.question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }
    if (body.question.length > 2000) {
      return NextResponse.json({ error: "question must be 2000 characters or fewer" }, { status: 400 });
    }
    if (body.orgId && !uuidV4Pattern.test(body.orgId)) {
      return NextResponse.json({ error: "orgId must be a UUID v4" }, { status: 400 });
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

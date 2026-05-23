import { NextResponse } from "next/server";
import { generateAnswer } from "@/lib/ai/provider";

export async function POST(request: Request) {
  const body = (await request.json()) as { question?: string; orgId?: string };
  if (!body.question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const result = await generateAnswer({
    question: body.question,
    context: `org_id=${body.orgId ?? "demo"}; answer with confidence and sources.`
  });

  return NextResponse.json(result);
}

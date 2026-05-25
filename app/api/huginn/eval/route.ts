import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { updateHuginnEvalRating } from "@/lib/huginn/eval-log";

export async function PATCH(request: Request) {
  const auth = await authorizeApiRequest(request, "huginn:query");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json()) as { eval_log_id?: string; user_rating?: number; user_note?: string; orgId?: string };
  const orgId = auth.context.orgId ?? body.orgId;
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  if (!body.eval_log_id) return NextResponse.json({ error: "eval_log_id is required" }, { status: 400 });
  const userRating = body.user_rating;
  if (!Number.isInteger(userRating) || (userRating ?? 0) < 1 || (userRating ?? 0) > 5) {
    return NextResponse.json({ error: "user_rating must be 1-5" }, { status: 400 });
  }
  const result = await updateHuginnEvalRating({
    orgId,
    evalLogId: body.eval_log_id,
    userRating: userRating as number,
    userNote: body.user_note
  });
  return NextResponse.json(result);
}

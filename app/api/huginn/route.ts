import { checkRequestRateLimit } from "../../../lib/api/rate-limit.ts";
import { authorizeApiRequest } from "../../../lib/auth/request.ts";
import { answerHuginnQuestion } from "../../../lib/huginn/query.ts";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "huginn:query");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    const rateLimit = checkRequestRateLimit(auth.context.orgId, "huginn", { maxRequests: 10, windowMs: 60_000 });
    if (!rateLimit.ok) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }
    const body = (await request.json().catch(() => ({}))) as { question?: string; orgId?: string; userId?: string };
    if (!body.question) {
      return Response.json({ error: "question is required" }, { status: 400 });
    }
    if (body.question.length > 2000) {
      return Response.json({ error: "question must be 2000 characters or fewer" }, { status: 400 });
    }
    if (body.orgId && !uuidV4Pattern.test(body.orgId)) {
      return Response.json({ error: "orgId must be a UUID v4" }, { status: 400 });
    }
    if (auth.mode !== "disabled" && body.orgId && auth.context.orgId !== body.orgId) {
      return Response.json({ error: "orgId override is not allowed" }, { status: 403 });
    }
    let orgId = auth.context.orgId;
    if (!orgId && auth.mode !== "disabled") {
      return Response.json({ error: "orgId is required" }, { status: 403 });
    }
    orgId ??= body.orgId;
    if (!orgId) {
      return Response.json({ error: "orgId is required" }, { status: 400 });
    }

    const result = await answerHuginnQuestion({
      orgId,
      question: body.question,
      userId: body.userId
    });

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

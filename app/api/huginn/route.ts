import { checkRequestRateLimit } from "../../../lib/api/rate-limit.ts";
import { authorizeApiRequest } from "../../../lib/auth/request.ts";
import { answerHuginnQuestion } from "../../../lib/huginn/query.ts";
import { createMuninTemporalMemoryReader } from "../../../lib/munin/reader.ts";

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
    if (typeof body.question !== "string" || !body.question.trim()) {
      return Response.json({ error: "question is required" }, { status: 400 });
    }
    if (body.orgId !== undefined && typeof body.orgId !== "string") {
      return Response.json({ error: "orgId must be a string" }, { status: 400 });
    }
    if (body.userId !== undefined && typeof body.userId !== "string") {
      return Response.json({ error: "userId must be a string" }, { status: 400 });
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
      // API callers cannot impersonate another principal through the DTO.
      // Disabled/local mode keeps the legacy body field for deterministic
      // development fixtures only.
      userId: auth.mode === "disabled" ? body.userId ?? auth.context.userId : auth.context.userId,
      temporalMemoryReader: createMuninTemporalMemoryReader()
    });

    return Response.json(result);
  } catch (err) {
    // Keep provider/database details out of the client response. Exception
    // messages may contain prompts, tokens, or other request data.
    console.error("[huginn] request failed", {
      errorType: err instanceof Error ? err.name : typeof err
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

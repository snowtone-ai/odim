import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { listAuditEvents } from "@/lib/repositories/reality";

export async function GET(request: Request) {
  const auth = await authorizeApiRequest(request, "audit:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await listAuditEvents(auth.context));
}

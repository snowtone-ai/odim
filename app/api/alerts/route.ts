import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { listAlerts } from "@/lib/repositories/reality";

export async function GET(request: Request) {
  const auth = await authorizeApiRequest(request, "alerts:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await listAlerts(auth.context));
}

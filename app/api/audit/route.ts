import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { listAuditEvents } from "@/lib/repositories/reality";

export async function GET(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "audit:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    return NextResponse.json(await listAuditEvents(auth.context));
  } catch (error) {
    console.error("audit route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

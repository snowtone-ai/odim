import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { getAdminSettings } from "@/lib/repositories/admin";

export async function GET(request: Request) {
  const auth = await authorizeApiRequest(request, "admin:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await getAdminSettings(auth.context));
}

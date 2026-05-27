import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { getAdminSettings } from "@/lib/repositories/admin";

export async function GET(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    return NextResponse.json(await getAdminSettings(auth.context));
  } catch (error) {
    console.error("settings route failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

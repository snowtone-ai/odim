import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { createApiKey, getAdminSettings, revokeApiKey } from "@/lib/repositories/admin";

export async function GET(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const settings = await getAdminSettings(auth.context);
    return NextResponse.json({ source: settings.source, apiKeys: settings.apiKeys });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = (await request.json().catch(() => ({}))) as { name?: string; scopes?: string[]; createdBy?: string };
    if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    return NextResponse.json(
      await createApiKey(auth.context, {
        name: body.name,
        scopes: body.scopes,
        createdBy: body.createdBy
      }),
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    return NextResponse.json(await revokeApiKey(auth.context, { id: body.id }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

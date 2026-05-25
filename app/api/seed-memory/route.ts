import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { createSeedMemory, deleteSeedMemory, listSeedMemories, updateSeedMemory } from "@/lib/munin/seed";

async function requireAdmin(request: Request) {
  const auth = await authorizeApiRequest(request, "admin:write");
  if (!auth.ok) return auth;
  const orgId = auth.context.orgId ?? new URL(request.url).searchParams.get("orgId") ?? undefined;
  if (!orgId) return { ok: false as const, status: 400 as const, error: "orgId is required" };
  return { ...auth, orgId };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ seeds: await listSeedMemories(auth.orgId) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json()) as { content?: string; memoryClass?: "fact" | "opinion"; userId?: string };
  if (!body.content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 });
  const seed = await createSeedMemory({
    orgId: auth.orgId,
    userId: body.userId,
    content: body.content.trim(),
    memoryClass: body.memoryClass === "opinion" ? "opinion" : "fact"
  });
  return NextResponse.json({ seed }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json()) as { id?: string; content?: string };
  if (!body.id || !body.content?.trim()) return NextResponse.json({ error: "id and content are required" }, { status: 400 });
  return NextResponse.json({ seed: await updateSeedMemory({ id: body.id, orgId: auth.orgId, content: body.content.trim() }) });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  return NextResponse.json({ seed: await deleteSeedMemory({ id, orgId: auth.orgId }) });
}

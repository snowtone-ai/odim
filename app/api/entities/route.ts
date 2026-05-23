import { NextResponse } from "next/server";
import { entities } from "@/lib/data";

export function GET() {
  return NextResponse.json({ entities });
}

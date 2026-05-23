import { NextResponse } from "next/server";
import { alerts } from "@/lib/data";

export function GET() {
  return NextResponse.json({ signals: alerts });
}

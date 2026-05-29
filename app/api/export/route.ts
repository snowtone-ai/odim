import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { listAlerts, listEntities, listSignals } from "@/lib/repositories/reality";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

export async function GET(request: Request) {
  const auth = await authorizeApiRequest(request, "entities:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "entities";
  const format = url.searchParams.get("format") ?? "json";
  let rows: Record<string, unknown>[];

  if (type === "alerts") rows = (await listAlerts(auth.context)).alerts;
  else if (type === "signals") rows = (await listSignals(auth.context)).signals;
  else rows = (await listEntities(auth.context)).entities;

  if (format === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${type}.csv"`
      }
    });
  }

  return NextResponse.json(
    {
      data: rows,
      meta: { total: rows.length, exported_at: new Date().toISOString(), time_range: url.searchParams.get("timeRange") ?? "30d" }
    },
    {
      headers: {
        "content-disposition": `attachment; filename="${type}.json"`
      }
    }
  );
}

import { NextResponse } from "next/server";
import { checkRequestRateLimit } from "@/lib/api/rate-limit";
import { authorizeApiRequest } from "@/lib/auth/request";
import { listAuditEvents } from "@/lib/repositories/reality";

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
  const auth = await authorizeApiRequest(request, "admin:*");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limit = checkRequestRateLimit(auth.context.orgId, "audit-export", { maxRequests: 1, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }

  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const { auditEvents } = await listAuditEvents(auth.context);

  const rows = auditEvents
    .filter((event) => {
      const eventDate = String((event as Record<string, unknown>).createdAt ?? "");
      if (start && eventDate && eventDate < `${start}T00:00:00.000Z`) return false;
      if (end && eventDate && eventDate > `${end}T23:59:59.999Z`) return false;
      return true;
    })
    .map((event) => ({
      timestamp: String((event as Record<string, unknown>).createdAt ?? ""),
      event_type: event.event,
      actor: event.actor,
      object_id: String((event as Record<string, unknown>).objectId ?? ""),
      detail: JSON.stringify((event as Record<string, unknown>).detail ?? {}),
      confidence: event.confidence,
      source_refs: event.source
    }));

  if (format === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="audit-log.csv"'
      }
    });
  }

  return NextResponse.json(
    {
      data: rows,
      meta: { total: rows.length, exported_at: new Date().toISOString(), start, end }
    },
    {
      headers: {
        "content-disposition": 'attachment; filename="audit-log.json"'
      }
    }
  );
}

import { NextResponse } from "next/server";
import { authorizeApiRequest } from "../auth/request.ts";
import { checkRequestRateLimit } from "./rate-limit.ts";

export type ApiResponseMeta = {
  total: number;
  page: number;
  per_page: number;
  timestamp: string;
};

export function parsePagination(url: URL, defaults?: { page?: number; perPage?: number }) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? defaults?.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page") ?? defaults?.perPage ?? 25)));
  return { page, perPage };
}

export function paginateRows<T>(rows: T[], page: number, perPage: number) {
  const start = (page - 1) * perPage;
  return rows.slice(start, start + perPage);
}

export function buildLinks(url: URL, page: number, perPage: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const make = (targetPage: number) => {
    const next = new URL(url.toString());
    next.searchParams.set("page", String(targetPage));
    next.searchParams.set("per_page", String(perPage));
    return next.toString();
  };
  return {
    next: page < totalPages ? make(page + 1) : null,
    prev: page > 1 ? make(page - 1) : null
  };
}

export function jsonApiResponse<T>(url: URL, rows: T[], page: number, perPage: number) {
  const total = rows.length;
  return NextResponse.json({
    data: paginateRows(rows, page, perPage),
    meta: {
      total,
      page,
      per_page: perPage,
      timestamp: new Date().toISOString()
    } satisfies ApiResponseMeta,
    links: buildLinks(url, page, perPage, total)
  });
}

export async function authorizeV1Request(request: Request, scope: string) {
  return authorizeApiRequest(request, scope);
}

export function enforceV1RateLimit(orgId: string | undefined, endpoint: string) {
  const maxRequests = Number(process.env.API_V1_RATE_LIMIT_RPM ?? 100);
  return checkRequestRateLimit(orgId, `v1:${endpoint}`, { maxRequests, windowMs: 60_000 });
}

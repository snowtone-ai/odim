export type PublicRecord = Record<string, unknown>;

export function getString(record: PublicRecord, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = record[alias];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  return parsed.toISOString();
}

export function parseCsvRows(text: string) {
  const rows = parseCsvTable(text).filter((row) => row.some((value) => value.trim()));
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]))
  );
}

function parseCsvTable(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows;
}

export function applyPagingToUrl(feedUrl: string, options: { limit?: number; offset?: number; page?: number }) {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const page = options.page ?? 1;
  if (feedUrl.includes("{limit}") || feedUrl.includes("{offset}") || feedUrl.includes("{page}")) {
    return feedUrl
      .replaceAll("{limit}", String(limit))
      .replaceAll("{offset}", String(offset))
      .replaceAll("{page}", String(page));
  }

  const url = new URL(feedUrl);
  if (!url.searchParams.has("limit")) url.searchParams.set("limit", String(limit));
  if (!url.searchParams.has("offset")) url.searchParams.set("offset", String(offset));
  if (!url.searchParams.has("page")) url.searchParams.set("page", String(page));
  return url.toString();
}

export async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, init: RequestInit = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${url} request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJsonOrCsvRecords(fetchImpl: typeof fetch, feedUrl: string, headers: Record<string, string> = {}) {
  const response = await fetchWithTimeout(fetchImpl, feedUrl, {
    headers: { accept: "application/json,text/csv;q=0.9,*/*;q=0.1", ...headers }
  });
  if (!response.ok) throw new Error(`${feedUrl} request failed: ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    const payload = (await response.json()) as PublicRecord[] | { results?: PublicRecord[]; data?: PublicRecord[] };
    return Array.isArray(payload) ? payload : (payload.results ?? payload.data ?? []);
  }

  return parseCsvRows(await response.text());
}

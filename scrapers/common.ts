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
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
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

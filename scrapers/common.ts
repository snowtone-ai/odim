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

export async function fetchJsonOrCsvRecords(fetchImpl: typeof fetch, feedUrl: string, headers: Record<string, string> = {}) {
  const response = await fetchImpl(feedUrl, {
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

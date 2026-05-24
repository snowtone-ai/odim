import { createHash } from "node:crypto";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function normalizeForHash(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) return value.map((item) => normalizeForHash(item));

  if (typeof value === "object" && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeForHash(item)])
    );
  }

  return String(value);
}

export function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForHash(value));
}

export function sha256Hex(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function deterministicUuid(scope: string, value: unknown) {
  const hex = sha256Hex({ scope, value }).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}
